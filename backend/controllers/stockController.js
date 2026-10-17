const Product = require('../models/Product');
const StockMovement = require('../models/StockMovementModel.js');

// Get all products with their stock quantities
exports.getInventory = async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch inventory',
    });
  }
};

// Get products with low stock (10 or fewer)
exports.getLowStock = async (req, res) => {
  try {
    const products = await Product.find({ stock: { $lte: 10 } })
      .sort({ stock: 1 });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch low-stock products',
    });
  }
};

// Increase or decrease product stock
exports.updateStock = async (req, res) => {
  try {
    const { movementType, quantity, reason } = req.body;

    if (!['STOCK_IN', 'STOCK_OUT'].includes(movementType)) {
      return res.status(400).json({
        message: 'Movement type must be STOCK_IN or STOCK_OUT',
      });
    }

    const amount = Number(quantity);

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        message: 'Quantity must be a positive whole number',
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
      });
    }

    const previousStock = product.stock;

    const newStock =
      movementType === 'STOCK_IN'
        ? previousStock + amount
        : previousStock - amount;

    if (newStock < 0) {
      return res.status(400).json({
        message: 'Insufficient stock',
        availableStock: previousStock,
      });
    }

    // Update the product quantity
    product.stock = newStock;
    await product.save();

    // Record the stock movement
    const movement = await StockMovement.create({
      product: product._id,
      movementType,
      quantity: amount,
      previousStock,
      newStock,
      reason: reason || '',
      performedBy: req.user._id,
    });

    res.status(200).json({
      message: 'Stock updated successfully',
      product: {
        id: product._id,
        name: product.name,
        previousStock,
        newStock,
      },
      movement,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update stock',
    });
  }
};

// View stock movement history
exports.getStockHistory = async (req, res) => {
  try {
    const history = await StockMovement.find()
      .populate('product', 'name productCode')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch stock history',
    });
  }
};