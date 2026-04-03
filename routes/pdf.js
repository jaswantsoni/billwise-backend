const express = require('express');
const router = express.Router();
const queuedPdfService = require('../services/queuedPdfService');

/**
 * @swagger
 * /api/pdf/generate:
 *   post:
 *     summary: Generate PDF from HTML and CSS
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - html
 *             properties:
 *               html:
 *                 type: string
 *                 description: HTML content
 *               css:
 *                 type: string
 *                 description: CSS styles (optional)
 *               options:
 *                 type: object
 *                 properties:
 *                   paperWidth:
 *                     type: string
 *                     default: "8.27"
 *                   paperHeight:
 *                     type: string
 *                     default: "11.7"
 *                   marginTop:
 *                     type: string
 *                     default: "0.39"
 *                   marginBottom:
 *                     type: string
 *                     default: "0.39"
 *                   marginLeft:
 *                     type: string
 *                     default: "0.39"
 *                   marginRight:
 *                     type: string
 *                     default: "0.39"
 *                   printBackground:
 *                     type: string
 *                     default: "true"
 *                   landscape:
 *                     type: string
 *                     default: "false"
 *               filename:
 *                 type: string
 *                 default: "document.pdf"
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/generate', async (req, res) => {
  try {
    const { html, css, options = {}, filename = 'document.pdf' } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log(`[PDF API] Generating PDF: ${filename}`);

    // Default PDF options
    const pdfOptions = {
      paperWidth: '8.27',
      paperHeight: '11.7',
      marginTop: '0.39',
      marginBottom: '0.39',
      marginLeft: '0.39',
      marginRight: '0.39',
      printBackground: 'true',
      landscape: 'false',
      ...options
    };

    // Generate PDF using queued service
    const pdfBuffer = await queuedPdfService.generatePdf(html, css, pdfOptions);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF API] Generation failed:', error);
    res.status(500).json({ 
      error: 'PDF generation failed', 
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/pdf/generate-base64:
 *   post:
 *     summary: Generate PDF and return as base64
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - html
 *             properties:
 *               html:
 *                 type: string
 *               css:
 *                 type: string
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 pdf_base64:
 *                   type: string
 *                 size_bytes:
 *                   type: number
 */
router.post('/generate-base64', async (req, res) => {
  try {
    const { html, css, options = {} } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log(`[PDF API] Generating base64 PDF`);

    // Default PDF options
    const pdfOptions = {
      paperWidth: '8.27',
      paperHeight: '11.7',
      marginTop: '0.39',
      marginBottom: '0.39',
      marginLeft: '0.39',
      marginRight: '0.39',
      printBackground: 'true',
      landscape: 'false',
      ...options
    };

    // Generate PDF using queued service
    const pdfBuffer = await queuedPdfService.generatePdf(html, css, pdfOptions);

    // Convert to base64
    const pdfBase64 = pdfBuffer.toString('base64');

    res.json({
      success: true,
      pdf_base64: pdfBase64,
      size_bytes: pdfBuffer.length
    });

  } catch (error) {
    console.error('[PDF API] Base64 generation failed:', error);
    res.status(500).json({ 
      error: 'PDF generation failed', 
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/pdf/health:
 *   get:
 *     summary: Check PDF service health
 *     tags: [PDF]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await queuedPdfService.healthCheck();
    const stats = queuedPdfService.getQueueStats();
    
    res.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'gotenberg-ec2',
      timestamp: new Date().toISOString(),
      queue: stats,
      gotenberg_url: process.env.GOTENBERG_URL
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/pdf/queue:
 *   get:
 *     summary: Get PDF queue statistics
 *     tags: [PDF]
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get('/queue', (req, res) => {
  try {
    const stats = queuedPdfService.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/pdf/queue/clear:
 *   post:
 *     summary: Clear PDF queue
 *     tags: [PDF]
 *     responses:
 *       200:
 *         description: Queue cleared
 */
router.post('/queue/clear', (req, res) => {
  try {
    const clearedJobs = queuedPdfService.clearQueue();
    res.json({ 
      message: `Cleared ${clearedJobs} jobs from queue`,
      clearedJobs 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;