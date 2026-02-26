const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     summary: Create a new supplier
 *     tags: [Suppliers]
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
 *             properties:
 *               name:
 *                 type: string
 *               gstin:
 *                 type: string
 *               email:
 *                 type: string
 *               mobile:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               openingBalance:
 *                 type: number
 *               paymentTerms:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier created successfully
 */
router.post('/', authenticate, supplierController.createSupplier);

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Get all suppliers with pagination and search
 *     tags: [Suppliers]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of suppliers
 */
router.get('/', authenticate, supplierController.getSuppliers);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID with aggregated data
 *     tags: [Suppliers]
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
 *         description: Supplier details with total purchases and pending payments
 */
router.get('/:id', authenticate, supplierController.getSupplierById);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     summary: Update supplier
 *     tags: [Suppliers]
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
 *               name:
 *                 type: string
 *               gstin:
 *                 type: string
 *               email:
 *                 type: string
 *               mobile:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               openingBalance:
 *                 type: number
 *               paymentTerms:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 */
router.put('/:id', authenticate, supplierController.updateSupplier);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     summary: Delete supplier (soft delete)
 *     tags: [Suppliers]
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
 *         description: Supplier deleted successfully
 */
router.delete('/:id', authenticate, supplierController.deleteSupplier);

/**
 * @swagger
 * /api/suppliers/{id}/purchases:
 *   get:
 *     summary: Get supplier purchase history
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Supplier purchase history
 */
router.get('/:id/purchases', authenticate, supplierController.getSupplierPurchases);

/**
 * @swagger
 * /api/suppliers/{id}/ledger:
 *   get:
 *     summary: Get supplier ledger
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *         description: Supplier ledger with transactions
 */
router.get('/:id/ledger', authenticate, supplierController.getSupplierLedger);

module.exports = router;
