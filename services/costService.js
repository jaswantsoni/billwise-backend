const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calculate moving average cost for a product
 * Formula: ((old stock × old cost) + (new qty × new cost)) ÷ (total stock)
 * When stock is zero, set cost to the new purchase cost
 * 
 * @param {number} currentStock - Current stock quantity
 * @param {number} currentAvgCost - Current average cost
 * @param {number} newQty - New quantity being purchased
 * @param {number} newCost - Cost per unit of new purchase
 * @returns {number} New moving average cost with 4 decimal precision
 */
function calculateMovingAverage(currentStock, currentAvgCost, newQty, newCost) {
  // First purchase - set cost to purchase price
  if (currentStock === 0) {
    return parseFloat(newCost.toFixed(4));
  }
  
  // Calculate weighted average
  const oldValue = currentStock * currentAvgCost;
  const newValue = newQty * newCost;
  const totalStock = currentStock + newQty;
  
  const movingAverage = (oldValue + newValue) / totalStock;
  
  // Return with 4 decimal precision
  return parseFloat(movingAverage.toFixed(4));
}

/**
 * Get the Cost of Goods Sold (COGS) for a product
 * Returns the current moving average cost
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<number>} Current moving average cost
 */
async function getProductCOGS(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { avgCost: true }
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  return product.avgCost;
}

/**
 * Calculate stock valuation for a product
 * Formula: current stock × moving average cost
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Stock valuation details
 */
async function calculateStockValuation(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      avgCost: true
    }
  });
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  const valuation = product.stockQuantity * product.avgCost;
  
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    stockQuantity: product.stockQuantity,
    avgCost: product.avgCost,
    stockValuation: parseFloat(valuation.toFixed(2))
  };
}

/**
 * Calculate total stock valuation for an organisation
 * Sum of all product valuations (stock × avg cost)
 * 
 * @param {string} organisationId - Organisation ID
 * @returns {Promise<Object>} Total stock valuation details
 */
async function getTotalStockValuation(organisationId) {
  const products = await prisma.product.findMany({
    where: { 
      organisationId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      avgCost: true
    }
  });
  
  let totalValuation = 0;
  const productValuations = [];
  
  for (const product of products) {
    const valuation = product.stockQuantity * product.avgCost;
    totalValuation += valuation;
    
    productValuations.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      avgCost: product.avgCost,
      stockValuation: parseFloat(valuation.toFixed(2))
    });
  }
  
  return {
    organisationId,
    totalProducts: products.length,
    totalValuation: parseFloat(totalValuation.toFixed(2)),
    products: productValuations
  };
}

module.exports = {
  calculateMovingAverage,
  getProductCOGS,
  calculateStockValuation,
  getTotalStockValuation
};
