const mongoose = require('mongoose');

const supplierTransactionSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },

    transactionType: {
      type: String,
      enum: ['PURCHASE', 'PAYMENT'],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    reference: {
      type: String,
      trim: true,
      default: '',
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'card', 'other'],
      default: undefined,
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Retrieve transactions for a supplier in date order
supplierTransactionSchema.index({
  supplier: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  'SupplierTransaction',
  supplierTransactionSchema
);