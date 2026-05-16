const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicInvoiceController');

// No auth required — public endpoints
router.post('/preview', ctrl.previewInvoice);
router.post('/download', ctrl.downloadInvoice);

module.exports = router;
