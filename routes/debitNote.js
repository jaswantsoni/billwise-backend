const express = require('express');
const router = express.Router();
const debitNoteController = require('../controllers/debitNoteController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/debit-notes:
 *   post:
 *     summary: Create a debit note
 *     tags: [Debit Notes]
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
 *                 example: "Additional charges"
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
 *                       example: "Extra Item"
 *                     hsnSac:
 *                       type: string
 *                       example: "5678"
 *                     quantity:
 *                       type: number
 *                       example: 1
 *                     unit:
 *                       type: string
 *                       example: "PCS"
 *                     rate:
 *                       type: number
 *                       example: 500
 *                     taxRate:
 *                       type: number
 *                       example: 12
 *     responses:
 *       200:
 *         description: Debit note created
 *   get:
 *     summary: Get all debit notes
 *     tags: [Debit Notes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of debit notes
 */
router.post('/', authenticate, debitNoteController.createDebitNote);
router.get('/', authenticate, debitNoteController.getDebitNotes);

/**
 * @swagger
 * /api/debit-notes/{id}:
 *   get:
 *     summary: Get debit note by ID
 *     tags: [Debit Notes]
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
 *         description: Debit note details
 * /api/debit-notes/{id}/pdf:
 *   get:
 *     summary: Download debit note PDF
 *     tags: [Debit Notes]
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
router.get('/:id', authenticate, debitNoteController.getDebitNote);
router.get('/:id/pdf', authenticate, debitNoteController.getDebitNotePDF);
router.get('/:id/public-pdf', debitNoteController.getDebitNotePDFPublic);

/**
 * @swagger
 * /api/debit-notes/invoice/{invoiceId}:
 *   get:
 *     summary: Get debit notes for an invoice
 *     tags: [Debit Notes]
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
 *         description: List of debit notes for invoice
 */
router.get('/invoice/:invoiceId', authenticate, debitNoteController.getInvoiceDebitNotes);

module.exports = router;
