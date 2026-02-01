const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/purchases:
 *   post:
 *     summary: Create a new purchase
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supplierId
 *               - purchaseDate
 *               - items
 *             properties:
 *               supplierId:
 *                 type: string
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *               dueDate:
 *                 type: string
 *                 format: date
 *               billNumber:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     rate:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *     responses:
 *       200:
 *         description: Purchase created successfully
 */
router.post('/', authenticate, purchaseController.createPurchase);

/**
 * @swagger
 * /api/purchases:
 *   get:
 *     summary: Get all purchases
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of purchases
 */
router.get('/', authenticate, purchaseController.getPurchases);

/**
 * @swagger
 * /api/purchases/{id}:
 *   get:
 *     summary: Get purchase by ID
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Purchase details
 */
router.get('/:id', authenticate, purchaseController.getPurchase);

/**
 * @swagger
 * /api/purchases/stock-movements/{productId}:
 *   get:
 *     summary: Get stock movements for a product
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stock movement history
 */
router.get('/stock-movements/:productId', authenticate, purchaseController.getStockMovements);

module.exports = router;
