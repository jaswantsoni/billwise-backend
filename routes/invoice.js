const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const pdfController = require('../controllers/pdfController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - invoiceDate
 *               - dueDate
 *               - items
 *             properties:
 *               customerId:
 *                 type: string
 *               billingAddressId:
 *                 type: string
 *               shippingAddressId:
 *                 type: string
 *               invoiceDate:
 *                 type: string
 *                 format: date
 *               dueDate:
 *                 type: string
 *                 format: date
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice created successfully
 */
router.post('/', authenticate, invoiceController.createInvoice);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get('/', authenticate, invoiceController.getInvoices);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Invoices]
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
 *         description: Invoice details
 */
router.get('/:id', authenticate, invoiceController.getInvoice);

/**
 * @swagger
 * /api/invoices/{id}/pdf:
 *   get:
 *     summary: Generate invoice PDF
 *     tags: [Invoices]
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
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/pdf', authenticate, pdfController.generateInvoicePDF);

module.exports = router;
