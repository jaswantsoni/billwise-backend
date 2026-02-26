const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/purchases:
 *   post:
 *     summary: Create a new purchase bill
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
 *               billNumber:
 *                 type: string
 *               invoiceNumber:
 *                 type: string
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *               dueDate:
 *                 type: string
 *                 format: date
 *               paymentMode:
 *                 type: string
 *               transportCharges:
 *                 type: number
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     rate:
 *                       type: number
 *                     discount:
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
 *     summary: Get all purchases with filters
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of purchases
 */
router.get('/', authenticate, purchaseController.getPurchases);

/**
 * @swagger
 * /api/purchases/{id}:
 *   get:
 *     summary: Get purchase by ID with items and supplier details
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
 *         description: Purchase details with items and supplier
 */
router.get('/:id', authenticate, purchaseController.getPurchaseById);

/**
 * @swagger
 * /api/purchases/{id}:
 *   put:
 *     summary: Update purchase (only if not finalized)
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplierId:
 *                 type: string
 *               billNumber:
 *                 type: string
 *               invoiceNumber:
 *                 type: string
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *               dueDate:
 *                 type: string
 *                 format: date
 *               paymentMode:
 *                 type: string
 *               transportCharges:
 *                 type: number
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     rate:
 *                       type: number
 *                     discount:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *     responses:
 *       200:
 *         description: Purchase updated successfully
 */
router.put('/:id', authenticate, purchaseController.updatePurchase);

/**
 * @swagger
 * /api/purchases/{id}:
 *   delete:
 *     summary: Delete purchase and reverse stock
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
 *         description: Purchase deleted successfully
 */
router.delete('/:id', authenticate, purchaseController.deletePurchase);

/**
 * @swagger
 * /api/purchases/{id}/finalize:
 *   post:
 *     summary: Finalize purchase (lock editing)
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
 *         description: Purchase finalized successfully
 */
router.post('/:id/finalize', authenticate, purchaseController.finalizePurchase);

module.exports = router;
