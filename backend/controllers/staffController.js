const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get all staff members
exports.getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

// Add a staff member
exports.addStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required',
      });
    }

    if (password.length < 10) {
      return res.status(400).json({
        message: 'Password must contain at least 10 characters',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const staff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'staff',
    });

    res.status(201).json({
      message: 'Staff member added successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add staff member' });
  }
};

// Update staff details
exports.updateStaff = async (req, res) => {
  try {
    const { name, email } = req.body;

    const staff = await User.findOne({
      _id: req.params.id,
      role: 'staff',
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
      staff.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email cannot be empty' });
      }

      const duplicate = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: staff._id },
      });

      if (duplicate) {
        return res.status(409).json({ message: 'Email is already registered' });
      }

      staff.email = normalizedEmail;
    }

    await staff.save();

    res.status(200).json({
      message: 'Staff details updated successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update staff details' });
  }
};

// Activate or deactivate a staff account
exports.toggleStaffStatus = async (req, res) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      role: 'staff',
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.status(200).json({
      message: staff.isActive
        ? 'Staff account activated successfully'
        : 'Staff account deactivated successfully',
      isActive: staff.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change staff status' });
  }
};