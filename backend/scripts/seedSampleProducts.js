require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const catalog = [
  ['GRO-001','Premium Basmati Rice 1 kg','Groceries',145,28,'groceries'],
  ['GRO-002','White Sugar 1 kg','Groceries',52,36,'groceries'],
  ['GRO-003','Whole Wheat Flour 5 kg','Groceries',255,18,'groceries'],
  ['GRO-004','Toor Dal 1 kg','Groceries',168,22,'groceries'],
  ['GRO-005','Sunflower Cooking Oil 1 L','Groceries',148,25,'groceries'],
  ['SNK-001','Marie Biscuits 200 g','Snacks and Biscuits',35,42,'snacks'],
  ['SNK-002','Chocolate Cream Biscuits 120 g','Snacks and Biscuits',30,32,'snacks'],
  ['SNK-003','Classic Potato Chips 50 g','Snacks and Biscuits',20,38,'snacks'],
  ['SNK-004','Milk Chocolate Bar 40 g','Snacks and Biscuits',45,26,'snacks'],
  ['SNK-005','Butter Cookies 250 g','Snacks and Biscuits',95,15,'snacks'],
  ['BEV-001','Packaged Drinking Water 1 L','Beverages',20,60,'beverages'],
  ['BEV-002','Orange Juice 1 L','Beverages',120,18,'beverages'],
  ['BEV-003','Apple Juice 1 L','Beverages',130,14,'beverages'],
  ['BEV-004','Lemon Soft Drink 750 ml','Beverages',40,36,'beverages'],
  ['BEV-005','Green Tea 25 Bags','Beverages',165,12,'beverages'],
  ['PER-001','Moisturizing Bath Soap 125 g','Personal Care',42,40,'personal-care'],
  ['PER-002','Nourishing Shampoo 340 ml','Personal Care',225,12,'personal-care'],
  ['PER-003','Fluoride Toothpaste 150 g','Personal Care',105,24,'personal-care'],
  ['PER-004','Soft Toothbrush','Personal Care',55,30,'personal-care'],
  ['PER-005','Gentle Face Wash 100 ml','Personal Care',145,3,'personal-care'],
  ['CLN-001','Detergent Powder 1 kg','Household Cleaning',125,22,'cleaning'],
  ['CLN-002','Dishwashing Liquid 500 ml','Household Cleaning',110,18,'cleaning'],
  ['CLN-003','Lemon Floor Cleaner 1 L','Household Cleaning',155,14,'cleaning'],
  ['CLN-004','Disinfectant Toilet Cleaner 500 ml','Household Cleaning',99,16,'cleaning'],
  ['CLN-005','Kitchen Cleaning Sponge 2 Pack','Household Cleaning',35,25,'cleaning'],
  ['STA-001','Ruled Notebook 200 Pages','Stationery',85,24,'stationery'],
  ['STA-002','Blue Ball Pen','Stationery',12,50,'stationery'],
  ['STA-003','HB Pencil 5 Pack','Stationery',25,35,'stationery'],
  ['STA-004','Eraser 2 Pack','Stationery',10,28,'stationery'],
  ['STA-005','Permanent Marker Black','Stationery',35,18,'stationery'],
  ['DAI-001','Toned Milk 1 L','Dairy Products',68,20,'dairy'],
  ['DAI-002','Salted Butter 100 g','Dairy Products',62,14,'dairy'],
  ['DAI-003','Processed Cheese 200 g','Dairy Products',135,10,'dairy'],
  ['DAI-004','Fresh Curd 500 g','Dairy Products',48,16,'dairy'],
  ['PKG-001','Instant Noodles 70 g','Packaged Foods',15,48,'packaged'],
  ['PKG-002','Penne Pasta 500 g','Packaged Foods',95,16,'packaged'],
  ['PKG-003','Tomato Sauce 500 g','Packaged Foods',85,20,'packaged'],
  ['PKG-004','Corn Flakes Cereal 500 g','Packaged Foods',195,11,'packaged'],
  ['KIT-001','Food Storage Container 1 L','Kitchen Essentials',125,13,'kitchen'],
  ['KIT-002','Aluminium Foil Roll 9 m','Kitchen Essentials',95,17,'kitchen'],
  ['KIT-003','Kitchen Paper Towels 2 Rolls','Kitchen Essentials',115,9,'kitchen'],
  ['ELC-001','USB-A to USB-C Cable 1 m','Electronics Accessories',199,14,'electronics'],
  ['ELC-002','20 W USB-C Phone Charger','Electronics Accessories',599,8,'electronics'],
  ['ELC-003','Wired Earphones with Mic','Electronics Accessories',349,10,'electronics'],
];

async function seedSampleProducts() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Product.find({}, 'name productCode').lean();
  const knownCodes = new Set(existing.map((product) => product.productCode.toLowerCase()));
  const knownNames = new Set(existing.map((product) => product.name.trim().toLowerCase()));
  let inserted = 0;
  let skipped = 0;

  for (const [code, name, category, price, stock, imageKey] of catalog) {
    const productCode = `SMP-${code}`;
    if (knownCodes.has(productCode.toLowerCase()) || knownNames.has(name.toLowerCase())) {
      skipped += 1;
      continue;
    }
    const product = {
      name,
      productCode,
      category,
      price,
      stock,
      image: `/catalog/${imageKey}.svg`,
    };
    await Product.create(product);
    knownCodes.add(productCode.toLowerCase());
    knownNames.add(name.toLowerCase());
    inserted += 1;
  }

  console.log(`Sample catalog seed complete: ${inserted} added, ${skipped} already present, ${existing.length} pre-existing products left untouched.`);
  await mongoose.disconnect();
}

seedSampleProducts().catch(async (error) => {
  console.error('Sample catalog seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
