const express = require('express');
const router = express.Router();

const {
  getStaff,
  addStaff,
  updateStaff,
  toggleStaffStatus,
} = require('../controllers/staffController');

const { protect, allowRoles } = require('../middleware/authMiddleware');

// Only admins can manage staff
router.use(protect, allowRoles('admin'));

router.get('/', getStaff);
router.post('/', addStaff);
router.put('/:id', updateStaff);
router.patch('/:id/status', toggleStaffStatus);

module.exports = router;