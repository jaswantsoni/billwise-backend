const express = require('express');
const router = express.Router();
const organisationController = require('../controllers/organisationController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/organisations:
 *   post:
 *     summary: Create a new organisation (First one free, additional require Premium)
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
 *               tradeName:
 *                 type: string
 *               gstin:
 *                 type: string
 *               pan:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               stateCode:
 *                 type: string
 *               pincode:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               logo:
 *                 type: string
 *               bankName:
 *                 type: string
 *               branch:
 *                 type: string
 *               accountHolderName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               ifsc:
 *                 type: string
 *               upi:
 *                 type: string
 *               authorizedSignatory:
 *                 type: string
 *               signatureUrl:
 *                 type: string
 *               companySealUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organisation created successfully
 *       403:
 *         description: Premium plan required for multiple businesses
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

/**
 * @swagger 
 * /api/organisations/{id}:
 *   put:
 *     summary: Update an organisation
 *     tags: [Organisations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Organisation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               tradeName:
 *                 type: string
 *               gstin:
 *                 type: string
 *               pan:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               stateCode:
 *                 type: string
 *               pincode:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               logo:
 *                 type: string
 *               bankName:
 *                 type: string
 *               branch:
 *                 type: string
 *               accountHolderName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               ifsc:
 *                 type: string
 *               upi:
 *                 type: string
 *               authorizedSignatory:
 *                 type: string
 *               signatureUrl:
 *                 type: string
 *               companySealUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organisation updated successfully
 * 
 */

router.put('/:id', authenticate, organisationController.updateOrganisation);


module.exports = router;
