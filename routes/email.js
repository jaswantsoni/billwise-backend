const express = require('express');
const router = express.Router();
const emailHelpers = require('../controllers/emailHelpers');
const { authenticate } = require('../middleware/auth');

router.post('/draft', authenticate, emailHelpers.createDraft);
router.post('/send', authenticate, emailHelpers.sendFromDraft);
router.post('/send-direct', authenticate, emailHelpers.sendDirect);
router.get('/read', authenticate, emailHelpers.getEmailLogs);

// Simplified endpoints
router.post('/send-invoice', authenticate, emailHelpers.sendInvoiceEmail);
router.post('/send-credit-note', authenticate, emailHelpers.sendCreditNoteEmail);
router.post('/send-reminder', authenticate, emailHelpers.sendPaymentReminder);

module.exports = router;
