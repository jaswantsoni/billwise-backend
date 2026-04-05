const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, ctrl.submitFeedback);
router.get('/categories', ctrl.getCategories);

module.exports = router;
