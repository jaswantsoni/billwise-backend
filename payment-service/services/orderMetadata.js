const prisma = require('../../../config/prisma');

// Store order metadata for webhook processing
const orderMetadata = new Map();

const storeOrderMetadata = (orderId, metadata) => {
  orderMetadata.set(orderId, {
    ...metadata,
    createdAt: new Date()
  });
  
  // Clean up old orders after 24 hours
  setTimeout(() => {
    orderMetadata.delete(orderId);
  }, 24 * 60 * 60 * 1000);
};

const getOrderMetadata = (orderId) => {
  return orderMetadata.get(orderId);
};

module.exports = {
  storeOrderMetadata,
  getOrderMetadata
};