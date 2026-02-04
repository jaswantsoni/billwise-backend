const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET
});

exports.createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  console.log('[RAZORPAY] Creating order:', { amount, currency, receipt });
  const options = {
    amount: amount * 100,
    currency,
    receipt,
    notes
  };
  const order = await razorpay.orders.create(options);
  console.log('[RAZORPAY] Order created:', order.id);
  return order;
};

exports.verifyPayment = (orderId, paymentId, signature) => {
  console.log('[RAZORPAY] Verifying payment:', { orderId, paymentId });
  const crypto = require('crypto');
  const text = orderId + '|' + paymentId;
  const generated_signature = crypto
    .createHmac('sha256', process.env.RZP_KEY_SECRET)
    .update(text)
    .digest('hex');
  const isValid = generated_signature === signature;
  console.log('[RAZORPAY] Signature verification:', isValid ? 'SUCCESS' : 'FAILED');
  return isValid;
};

exports.capturePayment = async (paymentId, amount) => {
  return await razorpay.payments.capture(paymentId, amount * 100, 'INR');
};

exports.refundPayment = async (paymentId, amount) => {
  const options = amount ? { amount: amount * 100 } : {};
  return await razorpay.payments.refund(paymentId, options);
};

exports.fetchPayment = async (paymentId) => {
  return await razorpay.payments.fetch(paymentId);
};

exports.fetchOrder = async (orderId) => {
  return await razorpay.orders.fetch(orderId);
};

exports.createSubscription = async ({ plan_id, customer_notify, total_count, customer_email, customer_name, customer_phone }) => {
  const options = {
    plan_id,
    customer_notify,
    total_count,
    notes: {
      customer_email,
      customer_name,
      customer_phone
    }
  };
  return await razorpay.subscriptions.create(options);
};

exports.cancelSubscription = async (subscriptionId) => {
  return await razorpay.subscriptions.cancel(subscriptionId);
};

exports.fetchSubscription = async (subscriptionId) => {
  return await razorpay.subscriptions.fetch(subscriptionId);
};
