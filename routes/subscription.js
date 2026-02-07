const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');

// Remove manual activation - webhooks only
router.post('/webhook-activate', subscriptionController.webhookActivateSubscription);
router.get('/current', authenticate, subscriptionController.getCurrentSubscription);
router.get('/history', authenticate, subscriptionController.getSubscriptionHistory);

module.exports = router;
