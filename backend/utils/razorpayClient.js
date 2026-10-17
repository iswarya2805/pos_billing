const Razorpay = require('razorpay');

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env, then restart the backend.');
    error.status = 503;
    throw error;
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId };
}

module.exports = getRazorpayClient;
