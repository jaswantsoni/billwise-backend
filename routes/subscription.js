const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');

router.post('/activate', authenticate, subscriptionController.activateSubscription);
router.post('/webhook-activate', subscriptionController.webhookActivateSubscription);
router.get('/current', authenticate, subscriptionController.getCurrentSubscription);
router.get('/history', authenticate, subscriptionController.getSubscriptionHistory);

module.exports = router;
