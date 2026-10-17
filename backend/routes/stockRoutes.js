const express = require('express');
const router = express.Router();

const {
  getInventory,
  getLowStock,
  updateStock,
  getStockHistory,
} = require('../controllers/stockController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Require login and admin access
router.use(protect, allowRoles('admin'));

// View all inventory
router.get('/', getInventory);

// View products with 10 or fewer items
router.get('/low-stock', getLowStock);

// View stock movement history
router.get('/history', getStockHistory);

// Increase or decrease stock for a product
router.patch('/:id', updateStock);

module.exports = router;