const express = require('express');
const router = express.Router();

const {
  getSuppliers,
  addSupplier,
  updateSupplier,
  deactivateSupplier,
} = require('../controllers/supplierController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Only admins can manage suppliers
router.use(protect, allowRoles('admin'));

router.get('/', getSuppliers);
router.post('/', addSupplier);
router.put('/:id', updateSupplier);
router.patch('/:id/deactivate', deactivateSupplier);

module.exports = router;