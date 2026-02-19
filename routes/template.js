const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const mailerEmailController = require('../controllers/mailerEmailController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, templateController.getTemplates);
router.post('/', authenticate, templateController.createTemplate);
router.get('/logs', authenticate, mailerEmailController.getLogs);
router.get('/stats', authenticate, mailerEmailController.getStats);
router.post('/send', authenticate, mailerEmailController.sendEmail);
router.post('/send-invoice', authenticate, mailerEmailController.sendInvoiceEmail);
router.get('/:id', authenticate, templateController.getTemplate);
router.put('/:id', authenticate, templateController.updateTemplate);
router.delete('/:id', authenticate, templateController.deleteTemplate);
router.post('/:id/duplicate', authenticate, templateController.duplicateTemplate);

module.exports = router;
