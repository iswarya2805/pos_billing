const Supplier = require('../models/Supplier');

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });

    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
};

// Add a supplier
exports.addSupplier = async (req, res) => {
  try {
    const { name, companyName, phone, email, address } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: 'Supplier name and phone are required',
      });
    }

    const supplier = await Supplier.create({
      name,
      companyName,
      phone,
      email,
      address,
    });

    res.status(201).json({
      message: 'Supplier added successfully',
      supplier,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add supplier' });
  }
};

// Update a supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { name, companyName, phone, email, address } = req.body;

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { name, companyName, phone, email, address },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.status(200).json({
      message: 'Supplier updated successfully',
      supplier,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update supplier' });
  }
};

// Deactivate a supplier
exports.deactivateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.status(200).json({
      message: 'Supplier deactivated successfully',
      supplier,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to deactivate supplier' });
  }
};