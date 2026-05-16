const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/quickInvoiceController');

router.post('/', authenticate, ctrl.createQuickInvoice);
router.get('/suggest/products', authenticate, ctrl.suggestProducts);
router.get('/suggest/customers', authenticate, ctrl.suggestCustomers);

module.exports = router;
