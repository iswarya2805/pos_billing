const mongoose = require('mongoose');

const Return = require('../models/Return');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovementModel');

// Process a product return and refund
const createReturn = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { billId, items, refundMethod, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        message: 'Invalid bill ID',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'At least one return item is required',
      });
    }

    if (!['cash', 'upi', 'card'].includes(refundMethod)) {
      return res.status(400).json({
        message: 'Refund method must be cash, upi, or card',
      });
    }

    // Combine duplicate product IDs in the request
    const requestedItems = new Map();

    for (const item of items) {
      const { productId, quantity } = item;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          message: 'Invalid product ID in return items',
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          message: 'Return quantity must be a positive integer',
        });
      }

      const id = String(productId);

      requestedItems.set(
        id,
        (requestedItems.get(id) || 0) + quantity
      );
    }

    let createdReturn;

    await session.withTransaction(async () => {
      // Load the original bill inside the transaction
      const bill = await Bill.findById(billId).session(session);

      if (!bill) {
        const error = new Error('Original bill not found');
        error.statusCode = 404;
        throw error;
      }

      if (bill.paymentStatus !== 'paid') {
        const error = new Error(
          'Only bills with paid status can be returned'
        );
        error.statusCode = 400;
        throw error;
      }

      const returnItems = [];
      let totalRefund = 0;

      for (const [productId, quantity] of requestedItems) {
        // Find the product in the original bill
        const billItem = bill.items.find(
          (item) => String(item.product) === productId
        );

        if (!billItem) {
          const error = new Error(
            'Product does not belong to the original bill'
          );
          error.statusCode = 400;
          throw error;
        }

        const alreadyReturned = billItem.returnedQuantity || 0;
        const availableToReturn =
          billItem.quantity - alreadyReturned;

        if (quantity > availableToReturn) {
          const error = new Error(
            `Cannot return ${quantity} units of ${billItem.productName}. Only ${availableToReturn} units remain eligible for return.`
          );
          error.statusCode = 400;
          throw error;
        }

        const refundAmount = Number(
          (billItem.price * quantity).toFixed(2)
        );

        billItem.returnedQuantity = alreadyReturned + quantity;

        returnItems.push({
          product: billItem.product,
          productName: billItem.productName,
          quantity,
          refundAmount,
        });

        totalRefund += refundAmount;
      }

      totalRefund = Number(totalRefund.toFixed(2));

      // Save updated returned quantities to prevent repeat returns
      await bill.save({ session });

      // Restore returned products to inventory
      for (const item of returnItems) {
        const product = await Product.findById(item.product)
          .session(session);

        if (!product) {
          const error = new Error(
            `Product ${item.productName} no longer exists`
          );
          error.statusCode = 404;
          throw error;
        }

        const previousStock = product.stock;
        product.stock += item.quantity;

        await product.save({ session });

        // Record the inventory movement
        await StockMovement.create(
          [
            {
              product: product._id,
              movementType: 'STOCK_IN',
              quantity: item.quantity,
              previousStock,
              newStock: product.stock,
              reason: `Customer return for bill ${bill.billNumber}`,
              performedBy: req.user._id,
            },
          ],
          { session }
        );
      }

      // Generate a unique return number
      const returnNumber =
        `RET-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const returns = await Return.create(
        [
          {
            returnNumber,
            originalBill: bill._id,
            items: returnItems,
            totalRefund,
            refundMethod,
            reason: reason || '',
            processedBy: req.user._id,
          },
        ],
        { session }
      );

      createdReturn = returns[0];
    });

    return res.status(201).json({
      message: 'Return processed successfully',
      return: createdReturn,
    });
  } catch (error) {
    console.error('Create return error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to process return',
    });
  } finally {
    await session.endSession();
  }
};

// Get all returns
const getReturns = async (req, res) => {
  try {
    const returns = await Return.find()
      .populate('originalBill', 'billNumber customerName totalAmount')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: returns.length,
      returns,
    });
  } catch (error) {
    console.error('Get returns error:', error);

    return res.status(500).json({
      message: 'Failed to fetch returns',
    });
  }
};

// Get one return by ID
const getReturnById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid return ID',
      });
    }

    const returnRecord = await Return.findById(id)
      .populate('originalBill', 'billNumber customerName customerPhone totalAmount')
      .populate('processedBy', 'name email')
      .populate('items.product', 'name price');

    if (!returnRecord) {
      return res.status(404).json({
        message: 'Return not found',
      });
    }

    return res.status(200).json({
      return: returnRecord,
    });
  } catch (error) {
    console.error('Get return error:', error);

    return res.status(500).json({
      message: 'Failed to fetch return',
    });
  }
};

module.exports = {
  createReturn,
  getReturns,
  getReturnById,
};