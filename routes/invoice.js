const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const pdfController = require('../controllers/pdfController');
const emailController = require('../controllers/emailController');
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
 *               invoiceType:
 *                 type: string
 *                 enum: [TAX_INVOICE, BILL_OF_SUPPLY, PROFORMA]
 *               invoiceCopyType:
 *                 type: string
 *                 enum: [ORIGINAL, DUPLICATE, TRIPLICATE]
 *               placeOfSupply:
 *                 type: string
 *               reverseCharge:
 *                 type: boolean
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     description:
 *                       type: string
 *                     hsnSac:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     rate:
 *                       type: number
 *                     discount:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *               deliveryCharges:
 *                 type: number
 *               packingCharges:
 *                 type: number
 *               otherCharges:
 *                 type: number
 *               modeOfDelivery:
 *                 type: string
 *                 enum: [IN_HAND, COURIER, TRANSPORT, SELF_PICKUP]
 *               vehicleNumber:
 *                 type: string
 *               transportName:
 *                 type: string
 *               lrNumber:
 *                 type: string
 *               ewayBillNumber:
 *                 type: string
 *               placeOfDelivery:
 *                 type: string
 *               deliveryDate:
 *                 type: string
 *                 format: date
 *               freightTerms:
 *                 type: string
 *                 enum: [PAID, TO_PAY]
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, UPI, NEFT, CHEQUE, CARD]
 *               paymentTerms:
 *                 type: string
 *                 enum: [NET_15, NET_30, NET_45, NET_60, IMMEDIATE]
 *               notes:
 *                 type: string
 *               termsConditions:
 *                 type: string
 *               declaration:
 *                 type: string
 *               paymentInstructions:
 *                 type: string
 *               deliveryInstructions:
 *                 type: string
 *               returnPolicy:
 *                 type: string
 *               lateFeePolicy:
 *                 type: string
 *               warrantyInfo:
 *                 type: string
 *               supportContact:
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

/**
 * @swagger
 * /api/invoices/{id}/send:
 *   post:
 *     summary: Send invoice via email
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Override customer email
 *     responses:
 *       200:
 *         description: Invoice sent successfully
 */
router.post('/:id/send', authenticate, emailController.sendInvoiceByEmail);

module.exports = router;
