const mongoose = require('mongoose');

const Supplier = require('../models/Supplier');
const SupplierTransaction = require('../models/SupplierTransaction');

// Record a supplier purchase or payment
const createTransaction = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      supplierId,
      transactionType,
      amount,
      reference,
      description,
      paymentMethod,
    } = req.body;

    // Validate supplier ID
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({
        message: 'Invalid supplier ID',
      });
    }

    // Validate transaction type
    if (!['PURCHASE', 'PAYMENT'].includes(transactionType)) {
      return res.status(400).json({
        message: 'Transaction type must be PURCHASE or PAYMENT',
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: 'Amount must be a positive number',
      });
    }

    // Validate payment method when provided
    const validPaymentMethods = [
      'cash',
      'upi',
      'bank_transfer',
      'card',
      'other',
    ];

    if (
      transactionType === 'PAYMENT' &&
      !validPaymentMethods.includes(paymentMethod)
    ) {
      return res.status(400).json({
        message: 'Provide a valid payment method for a supplier payment',
      });
    }

    let createdTransaction;

    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        isActive: true,
      }).session(session);

      if (!supplier) {
        const error = new Error('Active supplier not found');
        error.statusCode = 404;
        throw error;
      }

      /*
       * Use the supplier document as a transaction lock.
       * Concurrent ledger operations for the same supplier
       * should conflict instead of calculating from stale balances.
       */
      const lockedSupplier = await Supplier.findOneAndUpdate(
        { _id: supplierId, isActive: true },
        { $inc: { __v: 1 } },
        { returnDocument: "after", session }
      );

      if (!lockedSupplier) {
        const error = new Error('Active supplier not found');
        error.statusCode = 404;
        throw error;
      }

      // Calculate current balance from the ledger
      const totals = await SupplierTransaction.aggregate([
        {
          $match: {
            supplier: new mongoose.Types.ObjectId(supplierId),
          },
        },
        {
          $group: {
            _id: '$transactionType',
            total: { $sum: '$amount' },
          },
        },
      ]).session(session);

      let totalPurchases = 0;
      let totalPayments = 0;

      for (const entry of totals) {
        if (entry._id === 'PURCHASE') {
          totalPurchases = entry.total;
        }

        if (entry._id === 'PAYMENT') {
          totalPayments = entry.total;
        }
      }

      const currentBalance = Number(
        (totalPurchases - totalPayments).toFixed(2)
      );

      let newBalance;

      if (transactionType === 'PURCHASE') {
        newBalance = Number((currentBalance + amount).toFixed(2));
      } else {
        if (amount > currentBalance) {
          const error = new Error(
            `Payment exceeds outstanding balance of ${currentBalance.toFixed(2)}`
          );
          error.statusCode = 400;
          throw error;
        }

        newBalance = Number((currentBalance - amount).toFixed(2));
      }

      const transactions = await SupplierTransaction.create(
        [
          {
            supplier: supplierId,
            transactionType,
            amount,
            reference: reference || '',
            description: description || '',
            paymentMethod:
              transactionType === 'PAYMENT' ? paymentMethod : undefined,
            balanceAfter: newBalance,
            recordedBy: req.user._id,
          },
        ],
        { session }
      );

      createdTransaction = transactions[0];
    });

    return res.status(201).json({
      message: 'Supplier transaction recorded successfully',
      transaction: createdTransaction,
    });
  } catch (error) {
    console.error('Create supplier transaction error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to record supplier transaction',
    });
  } finally {
    await session.endSession();
  }
};

// Get supplier ledger and outstanding balance
const getSupplierLedger = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({
        message: 'Invalid supplier ID',
      });
    }

    const supplier = await Supplier.findById(supplierId).select(
      'name companyName phone email address isActive'
    );

    if (!supplier) {
      return res.status(404).json({
        message: 'Supplier not found',
      });
    }

    const totals = await SupplierTransaction.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(supplierId),
        },
      },
      {
        $group: {
          _id: '$transactionType',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let totalPurchases = 0;
    let totalPayments = 0;

    for (const entry of totals) {
      if (entry._id === 'PURCHASE') {
        totalPurchases = entry.total;
      }

      if (entry._id === 'PAYMENT') {
        totalPayments = entry.total;
      }
    }

    const transactions = await SupplierTransaction.find({
      supplier: supplierId,
    })
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      supplier,
      summary: {
        totalPurchases: Number(totalPurchases.toFixed(2)),
        totalPayments: Number(totalPayments.toFixed(2)),
        outstandingBalance: Number(
          (totalPurchases - totalPayments).toFixed(2)
        ),
      },
      transactionCount: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error('Get supplier ledger error:', error);

    return res.status(500).json({
      message: 'Failed to fetch supplier ledger',
    });
  }
};

// Get ledger transactions for all suppliers
const getAllSupplierTransactions = async (req, res) => {
  try {
    const transactions = await SupplierTransaction.find()
      .populate('supplier', 'name companyName phone')
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error('Get all supplier transactions error:', error);

    return res.status(500).json({
      message: 'Failed to fetch supplier transactions',
    });
  }
};

module.exports = {
  createTransaction,
  getSupplierLedger,
  getAllSupplierTransactions,
};