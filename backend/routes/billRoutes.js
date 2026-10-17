const express = require('express');
const router = express.Router();

const {
  createBill,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyBills,
  getBills,
  getBillById,
} = require('../controllers/billController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Both admins and staff can create bills
router.post('/razorpay/order', protect, allowRoles('admin', 'staff'), createRazorpayOrder);
router.post('/razorpay/verify', protect, allowRoles('admin', 'staff'), verifyRazorpayPayment);
router.post('/', protect, allowRoles('admin', 'staff'), createBill);

router.get('/mine', protect, allowRoles('admin', 'staff'), getMyBills);

// Only admins can view all bills
router.get('/', protect, allowRoles('admin'), getBills);

// Admins and staff can view an individual bill
router.get('/:id', protect, allowRoles('admin', 'staff'), getBillById);

module.exports = router;
