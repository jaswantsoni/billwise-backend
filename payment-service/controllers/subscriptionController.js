const razorpayService = require('../services/razorpay');
const PRODUCTS = require('../config/plans');

exports.createSubscription = async (req, res) => {
  try {
    const { product_code, customer_email, customer_name, customer_phone } = req.body;

    console.log('[CREATE SUBSCRIPTION] Request:', { product_code, customer_email, customer_name });

    if (!product_code || !PRODUCTS[product_code]) {
      console.log('[CREATE SUBSCRIPTION] Error: Invalid product_code:', product_code);
      return res.status(400).json({ error: 'Invalid product_code' });
    }

    const product = PRODUCTS[product_code];
    console.log('[CREATE SUBSCRIPTION] Product:', { name: product.name, price: product.price, tier: product.tier });

    // Create one-time payment order instead of subscription
    const order = await razorpayService.createOrder({
      amount: product.price,
      currency: 'INR',
      receipt: `sub_${Date.now()}`,
      notes: {
        product_code,
        customer_email,
        customer_name,
        customer_phone,
        tier: product.tier,
        interval: product.interval,
        duration_days: product.duration_days
      }
    });

    console.log('[CREATE SUBSCRIPTION] Order created:', { orderId: order.id, amount: order.amount / 100 });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        product_code,
        product_name: product.name,
        tier: product.tier,
        interval: product.interval,
        duration_days: product.duration_days
      },
      key_id: process.env.RZP_KEY_ID
    });
  } catch (error) {
    console.error('[CREATE SUBSCRIPTION] Error:', error.message);
    res.status(500).json({ error: 'Failed to create subscription', details: error.message });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({ error: 'Missing subscription_id' });
    }

    const subscription = await razorpayService.cancelSubscription(subscription_id);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription', details: error.message });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.params;

    const subscription = await razorpayService.fetchSubscription(subscription_id);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        current_start: subscription.current_start,
        current_end: subscription.current_end,
        charge_at: subscription.charge_at
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription', details: error.message });
  }
};

exports.getProducts = (req, res) => {
  console.log('[GET PRODUCTS] Request received');
  
  const products = Object.entries(PRODUCTS).map(([code, product]) => ({
    code,
    name: product.name,
    tier: product.tier,
    interval: product.interval,
    price: product.price,
    duration_days: product.duration_days
  }));

  console.log('[GET PRODUCTS] Returning', products.length, 'products');
  res.json({ success: true, products });
};
