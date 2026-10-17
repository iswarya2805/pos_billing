const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const Product = require('../models/Product');
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'products');

function getImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return '';
}

function validateImage(file) {
  const extension = getImageExtension(file.buffer);
  const expectedTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  if (!extension || expectedTypes[extension] !== file.mimetype) {
    const error = new Error('The uploaded file is not a valid JPG, PNG, or WEBP image.');
    error.status = 400;
    throw error;
  }
  return extension;
}

async function saveProductImage(file) {
  const extension = validateImage(file);
  await fs.mkdir(uploadDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/products/${filename}`;
}

async function deleteProductImageIfUnused(imagePath, excludeProductId) {
  const match = typeof imagePath === 'string' && imagePath.match(/^\/uploads\/products\/([a-f0-9-]+\.(?:jpg|png|webp))$/i);
  if (!match) return;
  const query = { image: imagePath };
  if (excludeProductId) query._id = { $ne: excludeProductId };
  if (await Product.exists(query)) return;
  await fs.rm(path.join(uploadDirectory, path.basename(match[1])), { force: true });
}

module.exports = { saveProductImage, validateImage, deleteProductImageIfUnused };
