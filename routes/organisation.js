const express = require('express');
const router = express.Router();
const organisationController = require('../controllers/organisationController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/organisations:
 *   post:
 *     summary: Create a new organisation
 *     tags: [Organisations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - phone
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               gstin:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organisation created successfully
 */
router.post('/', authenticate, organisationController.createOrganisation);

/**
 * @swagger
 * /api/organisations:
 *   get:
 *     summary: Get all organisations for logged-in user
 *     tags: [Organisations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organisations
 */
router.get('/', authenticate, organisationController.getOrganisations);

module.exports = router;
