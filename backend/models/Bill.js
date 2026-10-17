const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerName: {
      type: String,
      trim: true,
      default: 'Walk-in Customer',
    },

    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },

        productName: {
          type: String,
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },

        // Tracks how many units have already been returned
        returnedQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater', 'bank_transfer', 'emandate', 'nach', 'cardless_emi'],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ['paid', 'pending'],
      default: 'paid',
    },

    razorpayOrderId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },

    billedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Bill', billSchema);
