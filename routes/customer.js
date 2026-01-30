const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer (auto-fetch from GST if GSTIN provided)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organisationId
 *             properties:
 *               name:
 *                 type: string
 *               gstin:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               organisationId:
 *                 type: string
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Customer created successfully
 */
router.post('/', authenticate, customerController.createCustomer);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers for an organisation
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of customers
 */
router.get('/', authenticate, customerController.getCustomers);

/**
 * @swagger
 * /api/customers/shipping:
 *   put:
 *     summary: Update shipping address for a customer
 *     tags: [Customers]
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
 *               - addressId
 *             properties:
 *               customerId:
 *                 type: string
 *               addressId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shipping address updated
 */
router.put('/shipping', authenticate, customerController.updateShippingAddress);

module.exports = router;
