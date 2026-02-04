const express = require('express');
const router = express.Router();
const ewayController = require('../controllers/ewayController');
const { authenticate } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');

/**
 * @swagger
 * /api/eway/generate:
 *   post:
 *     summary: Generate E-Way Bill (Premium Feature)
 *     tags: [E-Way Bill]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: E-Way Bill generated successfully
 *       403:
 *         description: Premium plan required
 */
router.post('/generate', authenticate, requirePremium, ewayController.generateEWayBill);

/**
 * @swagger
 * /api/eway/{ewbNo}:
 *   get:
 *     summary: Get E-Way Bill details (Premium Feature)
 *     tags: [E-Way Bill]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ewbNo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: E-Way Bill details
 *       403:
 *         description: Premium plan required
 */
router.get('/:ewbNo', authenticate, requirePremium, ewayController.getEWayBill);

/**
 * @swagger
 * /api/eway/cancel/{ewbNo}:
 *   post:
 *     summary: Cancel E-Way Bill (Premium Feature)
 *     tags: [E-Way Bill]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ewbNo
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancelRsnCode
 *               - cancelRmrk
 *             properties:
 *               cancelRsnCode:
 *                 type: string
 *               cancelRmrk:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-Way Bill cancelled
 *       403:
 *         description: Premium plan required
 */
router.post('/cancel/:ewbNo', authenticate, requirePremium, ewayController.cancelEWayBill);

module.exports = router;
