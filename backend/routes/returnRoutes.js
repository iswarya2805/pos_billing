const express = require('express');
const router = express.Router();

const {
  createReturn,
  getReturns,
  getReturnById,
} = require('../controllers/returnController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Create a return — admin and staff
router.post(
  '/',
  protect,
  allowRoles('admin'),
  createReturn
);

// Get all returns — admin only
router.get(
  '/',
  protect,
  allowRoles('admin'),
  getReturns
);

// Get a single return — admin and staff
router.get(
  '/:id',
  protect,
  allowRoles('admin'),
  getReturnById
);

module.exports = router;
