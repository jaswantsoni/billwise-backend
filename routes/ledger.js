const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ledgerController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ctrl.getLedger);

module.exports = router;
