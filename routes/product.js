const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
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
 *               - sku
 *               - unit
 *               - price
 *               - taxRate
 *               - organisationId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               sku:
 *                 type: string
 *               hsnCode:
 *                 type: string
 *               sacCode:
 *                 type: string
 *               unit:
 *                 type: string
 *               price:
 *                 type: number
 *               taxRate:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *               organisationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product created successfully
 */
router.post('/', authenticate, productController.createProduct);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products for an organisation
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/', authenticate, productController.getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
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
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put('/:id', authenticate, productController.updateProduct);

module.exports = router;
