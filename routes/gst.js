const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');
const { authenticate } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');

/**
 * @swagger
 * /api/gst/{gstin}:
 *   get:
 *     summary: Fetch GST details by GSTIN (Premium Feature - 15 day free trial)
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gstin
 *         required: true
 *         schema:
 *           type: string
 *         description: 15-digit GSTIN
 *     responses:
 *       200:
 *         description: GST details fetched successfully
 *       403:
 *         description: Premium plan required
 */
router.get('/:gstin', authenticate, requirePremium, gstController.getGSTDetails);

/**
 * @swagger
 * /api/gst/captcha/image:
 *   get:
 *     summary: Get GST portal captcha image
 *     tags: [GST]
 *     responses:
 *       200:
 *         description: Captcha image
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/captcha/image', gstController.getCaptcha);

/**
 * @swagger
 * /api/gst/verify:
 *   post:
 *     summary: Verify GSTIN with captcha
 *     tags: [GST]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gstin
 *               - captcha
 *             properties:
 *               gstin:
 *                 type: string
 *               captcha:
 *                 type: string
 *               description: Captcha text entered by user
 *     responses:
 *       200:
 *         description: GSTIN verified successfully
 */
router.post('/verify', gstController.verifyGSTIN);

module.exports = router;
