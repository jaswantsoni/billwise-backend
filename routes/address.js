const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/addresses:
 *   post:
 *     summary: Add a new address to a customer
 *     tags: [Addresses]
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
 *               - line1
 *               - city
 *               - state
 *               - pincode
 *             properties:
 *               customerId:
 *                 type: string
 *               type:
 *                 type: string
 *               line1:
 *                 type: string
 *               line2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               country:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               isShipping:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Address added successfully
 */
router.post('/', authenticate, addressController.addAddress);

/**
 * @swagger
 * /api/addresses/{id}:
 *   put:
 *     summary: Update an address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Address updated successfully
 */
router.put('/:id', authenticate, addressController.updateAddress);

/**
 * @swagger
 * /api/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Addresses]
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
 *         description: Address deleted successfully
 */
router.delete('/:id', authenticate, addressController.deleteAddress);

/**
 * @swagger
 * /api/addresses/default:
 *   put:
 *     summary: Set default address for a customer
 *     tags: [Addresses]
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
 *         description: Default address set successfully
 */
router.put('/default', authenticate, addressController.setDefaultAddress);

module.exports = router;
