const express = require('express');
const router = express.Router();
const hsnController = require('../controllers/hsnController');

/**
 * @swagger
 * /api/hsn/search:
 *   get:
 *     summary: Search HSN/SAC codes by product name or description
 *     tags: [HSN/SAC]
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
 */
router.get('/search', hsnController.searchHSN);

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
