const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customTemplateController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ctrl.listTemplates);
router.get('/:id/pdf', authenticate, ctrl.generateTemplatePdf);
router.get('/:id', authenticate, ctrl.getTemplate);
router.post('/', authenticate, ctrl.createTemplate);
router.put('/:id', authenticate, ctrl.updateTemplate);
router.patch('/:id/set-default', authenticate, ctrl.setAsDefault);
router.delete('/:id', authenticate, ctrl.deleteTemplate);

module.exports = router;
