const express = require('express');
const router = express.Router();
const ewayController = require('../controllers/ewayController');

/**
 * @swagger
 * /api/eway/generate:
 *   post:
 *     summary: Generate E-Way Bill
 *     tags: [E-Way Bill]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: E-Way Bill generated successfully
 */
router.post('/generate', ewayController.generateEWayBill);

/**
 * @swagger
 * /api/eway/{ewbNo}:
 *   get:
 *     summary: Get E-Way Bill details
 *     tags: [E-Way Bill]
 *     parameters:
 *       - in: path
 *         name: ewbNo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: E-Way Bill details
 */
router.get('/:ewbNo', ewayController.getEWayBill);

/**
 * @swagger
 * /api/eway/cancel/{ewbNo}:
 *   post:
 *     summary: Cancel E-Way Bill
 *     tags: [E-Way Bill]
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
 */
router.post('/cancel/:ewbNo', ewayController.cancelEWayBill);

module.exports = router;
