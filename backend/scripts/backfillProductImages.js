require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const categoryImages = [
  [/grocer/i, 'groceries'],
  [/snack|biscuit/i, 'snacks'],
  [/beverage|drink/i, 'beverages'],
  [/personal|care/i, 'personal-care'],
  [/clean|household/i, 'cleaning'],
  [/stationery/i, 'stationery'],
  [/dairy/i, 'dairy'],
  [/packaged/i, 'packaged'],
  [/kitchen/i, 'kitchen'],
  [/electronics/i, 'electronics'],
  [/shirt|clothing|apparel/i, 'clothing'],
];

async function backfillProductImages() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ $or: [{ image: { $exists: false } }, { image: '' }, { image: null }] }, 'category').lean();
  let updated = 0;

  for (const product of products) {
    const match = categoryImages.find(([pattern]) => pattern.test(product.category || ''));
    const image = `/catalog/${match ? match[1] : 'general'}.svg`;
    const result = await Product.updateOne(
      { _id: product._id, $or: [{ image: { $exists: false } }, { image: '' }, { image: null }] },
      { $set: { image } }
    );
    updated += result.modifiedCount;
  }

  console.log(`Product image backfill complete: ${updated} missing image${updated === 1 ? '' : 's'} filled; existing images were preserved.`);
  await mongoose.disconnect();
}

backfillProductImages().catch(async (error) => {
  console.error('Product image backfill failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
