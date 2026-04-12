const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ledgerController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ctrl.getPayments);
router.post('/', authenticate, ctrl.createPayment);
router.delete('/:id', authenticate, ctrl.deletePayment);

module.exports = router;
