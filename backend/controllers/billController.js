const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovementModel');
const crypto = require('crypto');
const getRazorpayClient = require('../utils/razorpayClient');

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('At least one product is required');
    error.status = 400;
    throw error;
  }

  const quantities = new Map();
  for (const item of items) {
    const id = String(item.productId || item.product || '');
    const quantity = Number(item.quantity);
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid product ID');
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error('Each quantity must be a positive whole number');
      error.status = 400;
      throw error;
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  return [...quantities.entries()].sort(([first], [second]) => first.localeCompare(second));
}

async function getOrderQuote(items) {
  const quantities = normalizeOrderItems(items);
  const products = await Product.find({ _id: { $in: quantities.map(([id]) => id) } });
  const byId = new Map(products.map((product) => [product._id.toString(), product]));
  let amountPaise = 0;

  for (const [id, quantity] of quantities) {
    const product = byId.get(id);
    if (!product) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }
    if (product.stock < quantity) {
      const error = new Error(`Insufficient stock for ${product.name}. Available stock: ${product.stock}`);
      error.status = 400;
      throw error;
    }
    amountPaise += Math.round(Number(product.price) * 100) * quantity;
  }

  if (amountPaise < 100) {
    const error = new Error('Razorpay UPI payments must be at least ₹1.');
    error.status = 400;
    throw error;
  }
  const itemsHash = crypto.createHash('sha256').update(JSON.stringify(quantities)).digest('hex');
  return { quantities, amountPaise, itemsHash };
}

function signatureMatches(orderId, paymentId, signature) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

// Create a new bill
async function createBill(req, res, verifiedPayment = null) {
  let session;

  try {
    const { customerName, customerPhone, items, paymentMethod } = req.body;
    const effectivePaymentMethod = verifiedPayment ? verifiedPayment.method : paymentMethod;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'At least one product is required',
      });
    }

    const supportedMethods = ['cash', 'upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater', 'bank_transfer', 'emandate', 'nach', 'cardless_emi'];
    if (!supportedMethods.includes(effectivePaymentMethod)) {
      return res.status(400).json({
        message: 'Unsupported payment method',
      });
    }
    if (!verifiedPayment && !['cash', 'card'].includes(effectivePaymentMethod)) {
      return res.status(400).json({ message: 'Online payments must be completed and verified through Razorpay Checkout.' });
    }

    session = await mongoose.startSession();

    // Validate quantities and combine duplicate product IDs
    const quantities = new Map();

    for (const item of items) {
      // Accept the frontend's productId field and the older product alias.
      const id = String(item.productId || item.product || '');

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          message: 'Each quantity must be a positive whole number',
        });
      }

      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }

    let createdBill;

    await session.withTransaction(async () => {
      const billItems = [];
      let totalAmount = 0;

      for (const [productId, quantity] of quantities) {
        const product = await Product.findById(productId).session(session);

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
        }

        if (product.stock < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.stock}`);
        }

        const previousStock = product.stock;
        const newStock = previousStock - quantity;

        product.stock = newStock;
        await product.save({ session });

        billItems.push({
          product: product._id,
          productName: product.name,
          quantity,
          price: product.price,
          subtotal: product.price * quantity,
        });

        totalAmount += product.price * quantity;

        await StockMovement.create(
          [{
            product: product._id,
            movementType: 'STOCK_OUT',
            quantity,
            previousStock,
            newStock,
            reason: 'Sale through POS billing',
            performedBy: req.user._id,
          }],
          { session }
        );
      }

      const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const bills = await Bill.create(
        [{
          billNumber,
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          items: billItems,
          totalAmount,
          paymentMethod: effectivePaymentMethod,
          paymentStatus: 'paid',
          ...(verifiedPayment ? {
            razorpayOrderId: verifiedPayment.orderId,
            razorpayPaymentId: verifiedPayment.paymentId,
          } : {}),
          billedBy: req.user._id,
        }],
        { session }
      );

      createdBill = bills[0];
    });

    res.status(201).json({
      message: 'Bill created successfully',
      bill: createdBill,
    });
  } catch (error) {
    if (error.message?.startsWith('PRODUCT_NOT_FOUND:')) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (error.message?.startsWith('INSUFFICIENT_STOCK:')) {
      const [, productName, available] = error.message.split(':');

      return res.status(400).json({
        message: `Insufficient stock for ${productName}`,
        availableStock: Number(available),
      });
    }

    if (error.code === 20 || error.codeName === 'IllegalOperation') {
      console.error('Bill transaction requires MongoDB replica-set support:', error.message);
      return res.status(503).json({
        message: 'Billing requires MongoDB to run as a replica set. Start MongoDB with --replSet rs0 and initialize rs0.',
      });
    }

    console.error('Create bill error:', error);

    res.status(500).json({
      message: 'Failed to create bill',
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

exports.createBill = (req, res) => createBill(req, res);

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { client, keyId } = getRazorpayClient();
    const quote = await getOrderQuote(req.body.items);
    const order = await client.orders.create({
      amount: quote.amountPaise,
      currency: 'INR',
      receipt: `pos_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      notes: {
        userId: req.user._id.toString(),
        itemsHash: quote.itemsHash,
      },
    });
    res.status(201).json({
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    res.status(error.status || 502).json({ message: error.status ? error.message : 'Unable to create a Razorpay order. Check the payment gateway configuration and try again.' });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { client } = getRazorpayClient();
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!/^order_[A-Za-z0-9]+$/.test(String(orderId || '')) || !/^pay_[A-Za-z0-9]+$/.test(String(paymentId || ''))) {
      return res.status(400).json({ message: 'Invalid Razorpay payment details.' });
    }
    const order = await client.orders.fetch(orderId);
    if (order.id !== orderId || order.notes?.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This Razorpay order does not belong to your account.' });
    }
    if (!signatureMatches(order.id, paymentId, signature)) {
      return res.status(400).json({ message: 'Razorpay payment signature verification failed.' });
    }

    const existingBill = await Bill.findOne({ razorpayOrderId: orderId });
    if (existingBill) {
      if (existingBill.billedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'This payment has already been applied to another account.' });
      }
      if (existingBill.razorpayPaymentId !== paymentId) {
        return res.status(409).json({ message: 'This Razorpay order has already been used for another payment.' });
      }
      return res.status(200).json({ message: 'Payment was already verified.', bill: existingBill });
    }

    const quote = await getOrderQuote(req.body.items);
    if (order.notes?.itemsHash !== quote.itemsHash || order.amount !== quote.amountPaise || order.currency !== 'INR') {
      return res.status(400).json({ message: 'The cart no longer matches this Razorpay order. Please retry checkout.' });
    }

    let payment = await client.payments.fetch(paymentId);
    const supportedGatewayMethods = ['upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater', 'bank_transfer', 'emandate', 'nach', 'cardless_emi'];
    if (payment.order_id !== orderId || payment.amount !== order.amount || payment.currency !== 'INR' || !supportedGatewayMethods.includes(payment.method)) {
      return res.status(400).json({ message: 'The payment does not match this Razorpay order.' });
    }
    if (payment.status === 'authorized') {
      payment = await client.payments.capture(paymentId, order.amount, 'INR');
    }
    if (payment.status !== 'captured') {
      return res.status(402).json({ message: 'The Razorpay payment has not been captured. No bill was created.' });
    }

    const billRequest = {
      ...req,
      body: {
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        items: req.body.items,
      },
    };
    await createBill(billRequest, res, { orderId, paymentId, method: payment.method });
  } catch (error) {
    res.status(error.status || 502).json({ message: error.status ? error.message : 'Unable to verify the Razorpay payment. Please retry verification or check the payment status before charging again.' });
  }
};

// Get all bills
exports.getBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate('billedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bills' });
  }
};

// Scope staff bill history to the authenticated account.
exports.getMyBills = async (req, res) => {
  try {
    const bills = await Bill.find({ billedBy: req.user._id })
      .populate('billedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your bills' });
  }
};

// Get one bill by ID
exports.getBillById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid bill ID' });
    }

    const filter = { _id: req.params.id };
    if (req.user.role === 'staff') filter.billedBy = req.user._id;

    const bill = await Bill.findOne(filter)
      .populate('billedBy', 'name email');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.status(200).json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bill' });
  }
};
