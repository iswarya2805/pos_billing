const express = require('express');
const Product = require('../models/Product');
const { protect, allowRoles } = require('../middleware/authMiddleware');
const uploadProductImage = require('../middleware/productImageUpload');
const { saveProductImage, deleteProductImageIfUnused } = require('../utils/productImage');

const router = express.Router();

// Get all products
router.get('/', protect, allowRoles('admin', 'staff'), async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a product
router.post('/', protect, allowRoles('admin'), uploadProductImage, async (req, res) => {
  let imagePath = '';
  try {
    const productData = { ...req.body };
    if (req.file) {
      imagePath = await saveProductImage(req.file);
      productData.image = imagePath;
    }
    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    if (imagePath) await deleteProductImageIfUnused(imagePath).catch(() => {});
    res.status(400).json({ message: error.message });
  }
});

// Update a product
router.put('/:id', protect, allowRoles('admin'), uploadProductImage, async (req, res) => {
  let newImagePath = '';
  try {
    const previous = await Product.findById(req.params.id);
    if (!previous) return res.status(404).json({ message: 'Product not found' });

    const update = { ...req.body };
    delete update.removeImage;
    if (req.file) {
      newImagePath = await saveProductImage(req.file);
      update.image = newImagePath;
    } else if (String(req.body.removeImage).toLowerCase() === 'true') {
      update.image = '';
    }

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (previous.image && previous.image !== product.image) {
      await deleteProductImageIfUnused(previous.image, product._id).catch(() => {});
    }
    res.status(200).json(product);
  } catch (error) {
    if (newImagePath) await deleteProductImageIfUnused(newImagePath).catch(() => {});
    res.status(400).json({ message: error.message });
  }
});

// Delete a product
router.delete('/:id', protect, allowRoles('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.image) await deleteProductImageIfUnused(product.image).catch(() => {});
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
