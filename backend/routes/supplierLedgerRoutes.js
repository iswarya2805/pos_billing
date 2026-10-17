const express = require('express');
const router = express.Router();

const {
  createTransaction,
  getSupplierLedger,
  getAllSupplierTransactions,
} = require('../controllers/supplierLedgerController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Record a purchase or supplier payment
router.post(
  '/transactions',
  protect,
  allowRoles('admin'),
  createTransaction
);

// Get all supplier transactions
router.get(
  '/transactions',
  protect,
  allowRoles('admin'),
  getAllSupplierTransactions
);

// Get the ledger for a specific supplier
router.get(
  '/:supplierId',
  protect,
  allowRoles('admin'),
  getSupplierLedger
);

module.exports = router;