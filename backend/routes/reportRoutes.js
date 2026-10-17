const express = require('express');

const router = express.Router();

const {
  getSalesSummary,
  getDailySales,
} = require('../controllers/reportController');

const {
  protect,
  allowRoles,
} = require('../middleware/authMiddleware');

// Only admins can view sales reports
router.get('/summary', protect, allowRoles('admin'), getSalesSummary);
router.get('/daily', protect, allowRoles('admin'), getDailySales);

module.exports = router;