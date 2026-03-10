const express = require('express');
const router = express.Router();
const multer = require('multer');
const organisationController = require('../controllers/organisationController');
const { authenticate } = require('../middleware/auth');

// Configure multer for logo upload (base64 or file)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/', authenticate, organisationController.createOrganisation);
router.get('/', authenticate, organisationController.getOrganisations);
router.put('/:id', authenticate, organisationController.updateOrganisation);
router.put('/:id/document-settings', authenticate, organisationController.updateDocumentSettings);
router.post('/:id/logo', authenticate, upload.single('logo'), organisationController.uploadLogo);
router.delete('/:id/logo', authenticate, organisationController.deleteLogo);

module.exports = router;
