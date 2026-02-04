const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

router.get('/products', subscriptionController.getProducts);
router.post('/create', subscriptionController.createSubscription);
router.post('/cancel', subscriptionController.cancelSubscription);
router.get('/:subscription_id', subscriptionController.getSubscription);

module.exports = router;
