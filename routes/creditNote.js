const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/credit-notes:
 *   post:
 *     summary: Create a credit note
 *     tags: [Credit Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - issueDate
 *               - items
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: Original invoice ID
 *               issueDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-02-07"
 *               reason:
 *                 type: string
 *                 example: "Sales return - Damaged goods"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - description
 *                     - quantity
 *                     - unit
 *                     - rate
 *                     - taxRate
 *                   properties:
 *                     productId:
 *                       type: string
 *                     description:
 *                       type: string
 *                       example: "Product Name"
 *                     hsnSac:
 *                       type: string
 *                       example: "1234"
 *                     quantity:
 *                       type: number
 *                       example: 2
 *                     unit:
 *                       type: string
 *                       example: "PCS"
 *                     rate:
 *                       type: number
 *                       example: 1000
 *                     taxRate:
 *                       type: number
 *                       example: 18
 *     responses:
 *       200:
 *         description: Credit note created
 *   get:
 *     summary: Get all credit notes
 *     tags: [Credit Notes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of credit notes
 */
router.post('/', authenticate, creditNoteController.createCreditNote);
router.get('/', authenticate, creditNoteController.getCreditNotes);

/**
 * @swagger
 * /api/credit-notes/{id}:
 *   get:
 *     summary: Get credit note by ID
 *     tags: [Credit Notes]
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
 *         description: Credit note details
 * /api/credit-notes/{id}/pdf:
 *   get:
 *     summary: Download credit note PDF
 *     tags: [Credit Notes]
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id', authenticate, creditNoteController.getCreditNote);
router.get('/:id/pdf', authenticate, creditNoteController.getCreditNotePDF);
router.get('/:id/public-pdf', creditNoteController.getCreditNotePDFPublic);

/**
 * @swagger
 * /api/credit-notes/invoice/{invoiceId}:
 *   get:
 *     summary: Get credit notes for an invoice
 *     tags: [Credit Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of credit notes for invoice
 */
router.get('/invoice/:invoiceId', authenticate, creditNoteController.getInvoiceCreditNotes);

module.exports = router;
