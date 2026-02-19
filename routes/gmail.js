const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');
const { authenticate } = require('../middleware/auth');

router.get('/auth-url', authenticate, gmailController.getAuthUrl);
router.get('/callback', gmailController.handleCallback);
router.get('/status', authenticate, gmailController.getStatus);
router.post('/disconnect', authenticate, gmailController.disconnect);

module.exports = router;
