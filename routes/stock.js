const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const costService = require('../services/costService');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/stock/summary:
 *   get:
 *     summary: Get stock summary for all products
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by product category
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter for low stock items only
 *     responses:
 *       200:
 *         description: Stock summary with product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           stockQuantity:
 *                             type: number
 *                           avgCost:
 *                             type: number
 *                           stockValuation:
 *                             type: number
 *                           minStock:
 *                             type: number
 *                           isLowStock:
 *                             type: boolean
 *                     totalValuation:
 *                       type: number
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const organisationId = req.query.organisationId || req.user?.organisationId;
    
    if (!organisationId) {
      return res.status(400).json({
        success: false,
        error: 'Organisation ID is required'
      });
    }
    
    const filters = {
      category: req.query.category,
      lowStock: req.query.lowStock === 'true'
    };

    const summary = await stockService.getStockSummary(organisationId, filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stock summary'
    });
  }
});

/**
 * @swagger
 * /api/stock/ledger/{productId}:
 *   get:
 *     summary: Get stock ledger for a specific product
 *     tags: [Stock]
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
 *         description: Start date for ledger entries
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for ledger entries
 *     responses:
 *       200:
 *         description: Stock ledger with all transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     product:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         sku:
 *                           type: string
 *                     openingStock:
 *                       type: number
 *                     closingStock:
 *                       type: number
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           type:
 *                             type: string
 *                           referenceType:
 *                             type: string
 *                           referenceNumber:
 *                             type: string
 *                           quantityIn:
 *                             type: number
 *                           quantityOut:
 *                             type: number
 *                           balance:
 *                             type: number
 *                           rate:
 *                             type: number
 *                           avgCost:
 *                             type: number
 */
router.get('/ledger/:productId', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;
    const dateRange = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const ledger = await stockService.getStockLedger(productId, dateRange);

    res.json({
      success: true,
      data: ledger
    });
  } catch (error) {
    console.error('Error fetching stock ledger:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stock ledger'
    });
  }
});

/**
 * @swagger
 * /api/stock/low-stock:
 *   get:
 *     summary: Get all products with low stock
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of products below minimum stock level
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           currentStock:
 *                             type: number
 *                           minStock:
 *                             type: number
 *                           deficit:
 *                             type: number
 *                           lastPurchaseDate:
 *                             type: string
 *                     count:
 *                       type: number
 */
router.get('/low-stock', authenticate, async (req, res) => {
  try {
    const organisationId = req.query.organisationId || req.user?.organisationId;
    
    if (!organisationId) {
      return res.status(400).json({
        success: false,
        error: 'Organisation ID is required'
      });
    }

    const lowStockItems = await stockService.checkLowStock(organisationId);

    res.json({
      success: true,
      data: lowStockItems
    });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch low stock items'
    });
  }
});

/**
 * @swagger
 * /api/stock/valuation:
 *   get:
 *     summary: Get total stock valuation for the organisation
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total stock valuation with product breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     organisationId:
 *                       type: string
 *                     totalProducts:
 *                       type: number
 *                     totalValuation:
 *                       type: number
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                           productName:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           stockQuantity:
 *                             type: number
 *                           avgCost:
 *                             type: number
 *                           stockValuation:
 *                             type: number
 */
router.get('/valuation', authenticate, async (req, res) => {
  try {
    const organisationId = req.query.organisationId || req.user?.organisationId;
    
    if (!organisationId) {
      return res.status(400).json({
        success: false,
        error: 'Organisation ID is required'
      });
    }

    const valuation = await costService.getTotalStockValuation(organisationId);

    res.json({
      success: true,
      data: valuation
    });
  } catch (error) {
    console.error('Error fetching stock valuation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stock valuation'
    });
  }
});

module.exports = router;
