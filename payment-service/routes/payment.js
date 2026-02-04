const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/capture', paymentController.capturePayment);
router.post('/refund', paymentController.refundPayment);
router.get('/payment/:payment_id', paymentController.getPayment);
router.get('/order/:order_id', paymentController.getOrder);
router.post('/webhook', paymentController.webhook);

module.exports = router;
