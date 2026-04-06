const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dataExportController');
const { authenticate } = require('../middleware/auth');

router.get('/fields/:entity', authenticate, ctrl.getFields);
router.post('/export', authenticate, ctrl.exportData);

module.exports = router;
