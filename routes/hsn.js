const express = require('express');
const router = express.Router();
const hsnController = require('../controllers/hsnController');
const { authenticate } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');

/**
 * @swagger
 * /api/hsn/search:
 *   get:
 *     summary: Search HSN/SAC codes (Premium Feature - 15 day free trial)
 *     tags: [HSN/SAC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Product name or description to search
 *     responses:
 *       200:
 *         description: List of matching HSN codes with GST rates
 *       403:
 *         description: Premium plan required
 */
router.get('/search', authenticate, requirePremium, hsnController.searchHSN);

/**
 * @swagger
 * /api/hsn/{hsnCode}:
 *   get:
 *     summary: Get HSN code details with GST rate
 *     tags: [HSN/SAC]
 *     parameters:
 *       - in: path
 *         name: hsnCode
 *         required: true
 *         schema:
 *           type: string
 *         description: HSN/SAC code
 *     responses:
 *       200:
 *         description: HSN details with GST rate
 */
router.get('/:hsnCode', hsnController.getHSNDetails);

module.exports = router;
