const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const exportService = require('../services/exportService');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/reports/purchase-register:
 *   get:
 *     summary: Generate purchase register report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *         description: Filter by supplier ID
 *     responses:
 *       200:
 *         description: Purchase register report data
 *       500:
 *         description: Server error
 */
router.get('/purchase-register', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, supplierId } = req.query;
    const organisationId = req.user.organisationId;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const filters = {};
    if (supplierId) filters.supplierId = supplierId;

    const report = await reportService.generatePurchaseRegister(
      organisationId,
      dateRange,
      filters
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating purchase register:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/supplier-ledger/{supplierId}:
 *   get:
 *     summary: Generate supplier ledger report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: supplierId
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report
 *     responses:
 *       200:
 *         description: Supplier ledger report data
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Server error
 */
router.get('/supplier-ledger/:supplierId', authenticate, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const report = await reportService.generateSupplierLedger(
      supplierId,
      dateRange
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating supplier ledger:', error);
    const statusCode = error.message === 'Supplier not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/stock-summary:
 *   get:
 *     summary: Generate stock summary report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter for low stock items only
 *     responses:
 *       200:
 *         description: Stock summary report data
 *       500:
 *         description: Server error
 */
router.get('/stock-summary', authenticate, async (req, res) => {
  try {
    const organisationId = req.user.organisationId;
    const { lowStock } = req.query;

    const filters = {};
    if (lowStock === 'true') filters.lowStock = true;

    const report = await reportService.generateStockSummary(
      organisationId,
      filters
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating stock summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/stock-ledger/{productId}:
 *   get:
 *     summary: Generate stock ledger report for a product
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report
 *     responses:
 *       200:
 *         description: Stock ledger report data
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/stock-ledger/:productId', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const report = await reportService.generateStockLedger(
      productId,
      dateRange
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating stock ledger:', error);
    const statusCode = error.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/product-profit:
 *   get:
 *     summary: Generate product profit report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report
 *     responses:
 *       200:
 *         description: Product profit report data
 *       500:
 *         description: Server error
 */
router.get('/product-profit', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const organisationId = req.user.organisationId;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const report = await reportService.generateProductProfit(
      organisationId,
      dateRange
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating product profit report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/monthly-turnover:
 *   get:
 *     summary: Generate monthly turnover report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year for the report
 *     responses:
 *       200:
 *         description: Monthly turnover report data
 *       400:
 *         description: Year parameter is required
 *       500:
 *         description: Server error
 */
router.get('/monthly-turnover', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    const organisationId = req.user.organisationId;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    const report = await reportService.generateMonthlyTurnover(
      organisationId,
      parseInt(year)
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating monthly turnover report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/gst-purchase:
 *   get:
 *     summary: Generate GST purchase report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report
 *     responses:
 *       200:
 *         description: GST purchase report data
 *       500:
 *         description: Server error
 */
router.get('/gst-purchase', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const organisationId = req.user.organisationId;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const report = await reportService.generateGSTPurchaseReport(
      organisationId,
      dateRange
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating GST purchase report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     summary: Export report to PDF or Excel
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - format
 *               - reportData
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [purchase-register, supplier-ledger, stock-summary, stock-ledger, product-profit, monthly-turnover, gst-purchase]
 *                 description: Type of report to export
 *               format:
 *                 type: string
 *                 enum: [pdf, excel]
 *                 description: Export format
 *               reportData:
 *                 type: object
 *                 description: Report data to export
 *     responses:
 *       200:
 *         description: Exported file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.post('/export', authenticate, async (req, res) => {
  try {
    const { reportType, format, reportData } = req.body;

    // Validate required parameters
    if (!reportType || !format || !reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportType, format, and reportData are required'
      });
    }

    // Validate format
    if (!['pdf', 'excel'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'format must be either "pdf" or "excel"'
      });
    }

    // Validate report type
    const validReportTypes = [
      'purchase-register',
      'supplier-ledger',
      'stock-summary',
      'stock-ledger',
      'product-profit',
      'monthly-turnover',
      'gst-purchase'
    ];

    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: `reportType must be one of: ${validReportTypes.join(', ')}`
      });
    }

    let fileBuffer;
    let contentType;
    let filename;

    if (format === 'pdf') {
      fileBuffer = await exportService.exportToPDF(reportData, reportType);
      contentType = 'application/pdf';
      filename = `${reportType}-${Date.now()}.pdf`;
    } else {
      fileBuffer = exportService.exportToExcel(reportData, reportType);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${reportType}-${Date.now()}.xlsx`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
