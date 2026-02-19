const express = require('express');
const router = express.Router();
const mailerController = require('../controllers/mailerController');
const { authenticate } = require('../middleware/auth');

router.get('/templates', authenticate, mailerController.getMailerTemplates);
router.post('/send-invoice', authenticate, mailerController.sendInvoiceEmail);
router.get('/token', authenticate, mailerController.getMailerToken);

module.exports = router;
