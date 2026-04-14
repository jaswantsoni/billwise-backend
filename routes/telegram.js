const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/telegramController');
const { authenticate } = require('../middleware/auth');

router.get('/status', authenticate, ctrl.getTelegramStatus);
router.post('/link-token', authenticate, ctrl.generateLinkToken);
router.delete('/unlink', authenticate, ctrl.unlinkTelegram);

module.exports = router;
