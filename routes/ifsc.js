const express = require('express');
const router = express.Router();
const ifscController = require('../controllers/ifscController');

/**
 * @swagger
 * /api/ifsc/{ifsc}:
 *   get:
 *     summary: Lookup bank details by IFSC code
 *     tags: [IFSC]
 *     parameters:
 *       - in: path
 *         name: ifsc
 *         required: true
 *         schema:
 *           type: string
 *         description: 11-character IFSC code
 *         example: KKBK0004329
 *     responses:
 *       200:
 *         description: Bank details found
 *       404:
 *         description: IFSC not found
 *       400:
 *         description: Invalid IFSC format
 */
router.get('/:ifsc', ifscController.lookupIFSC);

module.exports = router;
