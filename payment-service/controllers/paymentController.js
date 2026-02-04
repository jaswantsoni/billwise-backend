const razorpayService = require('../services/razorpay');

exports.createOrder = async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;

    console.log('[CREATE ORDER] Request:', { amount, currency, receipt, notes });

    if (!amount || amount <= 0) {
      console.log('[CREATE ORDER] Error: Invalid amount');
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const order = await razorpayService.createOrder({
      amount,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes
    });

    console.log('[CREATE ORDER] Success:', { orderId: order.id, amount: order.amount / 100 });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: process.env.RZP_KEY_ID
    });
  } catch (error) {
    console.error('[CREATE ORDER] Error:', error.message);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('[VERIFY PAYMENT] Request:', { razorpay_order_id, razorpay_payment_id });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('[VERIFY PAYMENT] Error: Missing payment details');
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const isValid = razorpayService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log('[VERIFY PAYMENT] Signature valid:', isValid);

    if (isValid) {
      const payment = await razorpayService.fetchPayment(razorpay_payment_id);
      console.log('[VERIFY PAYMENT] Success:', { paymentId: payment.id, status: payment.status, amount: payment.amount / 100 });
      
      res.json({
        success: true,
        verified: true,
        payment: {
          id: payment.id,
          amount: payment.amount / 100,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact
        }
      });
    } else {
      console.log('[VERIFY PAYMENT] Error: Invalid signature');
      res.status(400).json({ success: false, verified: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('[VERIFY PAYMENT] Error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
};

exports.capturePayment = async (req, res) => {
  try {
    const { payment_id, amount } = req.body;

    if (!payment_id || !amount) {
      return res.status(400).json({ error: 'Missing payment_id or amount' });
    }

    const payment = await razorpayService.capturePayment(payment_id, amount);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Capture payment error:', error);
    res.status(500).json({ error: 'Failed to capture payment', details: error.message });
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const { payment_id, amount } = req.body;

    if (!payment_id) {
      return res.status(400).json({ error: 'Missing payment_id' });
    }

    const refund = await razorpayService.refundPayment(payment_id, amount);

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({ error: 'Failed to refund payment', details: error.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { payment_id } = req.params;

    const payment = await razorpayService.fetchPayment(payment_id);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        created_at: payment.created_at
      }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment', details: error.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await razorpayService.fetchOrder(order_id);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        status: order.status,
        receipt: order.receipt,
        created_at: order.created_at
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const crypto = require('crypto');
    
    console.log('[WEBHOOK] Received event');

    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature === expectedSignature) {
      const event = req.body.event;
      const payload = req.body.payload;

      console.log('[WEBHOOK] Event:', event);

      if (event === 'payment.captured') {
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        
        // Call main backend to activate subscription
        const axios = require('axios');
        try {
          await axios.post(`${process.env.MAIN_BACKEND_URL}/api/subscriptions/webhook-activate`, {
            orderId,
            paymentId: payment.id,
            amount: payment.amount / 100,
            status: payment.status
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`
            }
          });
          console.log('[WEBHOOK] Subscription activated for order:', orderId);
        } catch (error) {
          console.error('[WEBHOOK] Failed to activate subscription:', error.message);
        }
      }

      res.json({ status: 'ok' });
    } else {
      console.log('[WEBHOOK] Error: Invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('[WEBHOOK] Error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
