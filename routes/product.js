const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

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
router.get('/', authenticate, productController.getProducts);

// Specific sub-routes must come before /:id to avoid Express swallowing them
router.get('/search', authenticate, productController.searchProducts);
router.post('/bulk-upload', authenticate, upload.single('file'), productController.bulkUploadProducts);
router.post('/:id/images', authenticate, productController.uploadProductImage);
router.delete('/:id/images', authenticate, productController.deleteProductImage);

router.put('/:id', authenticate, productController.updateProduct);
router.delete('/:id', authenticate, productController.deleteProduct);

module.exports = router;
