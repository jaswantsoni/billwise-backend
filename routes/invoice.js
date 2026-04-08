const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const pdfController = require('../controllers/productionPdfController'); // Updated to use production controller
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
 *                 enum: [TAX_INVOICE, BILL_OF_SUPPLY, PROFORMA, DELIVERY_CHALLAN]
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
router.get('/', authenticate, invoiceController.getInvoices);

// Specific sub-routes MUST come before /:id to avoid being swallowed
router.get('/templates', authenticate, pdfController.getInvoiceTemplates);
router.get('/pdf/health', authenticate, pdfController.pdfServiceHealth);
router.get('/pdf/queue', authenticate, pdfController.pdfQueueStats);
router.post('/pdf/queue/clear', authenticate, pdfController.clearPdfQueue);

router.get('/:id/pdf', authenticate, pdfController.getInvoicePDF);
router.get('/:id', authenticate, invoiceController.getInvoice);
router.put('/:id', authenticate, invoiceController.updateInvoice);
router.patch('/:id/cancel', authenticate, invoiceController.cancelInvoice);
router.delete('/:id', authenticate, invoiceController.deleteInvoice);

module.exports = router;
