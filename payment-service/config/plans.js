const PRODUCTS = {
  basic_monthly: {
    name: 'Basic Monthly',
    tier: 'basic',
    interval: 'monthly',
    price: 149,
    duration_days: 30,
  },
  basic_yearly: {
    name: 'Basic Yearly',
    tier: 'basic',
    interval: 'yearly',
    price: 1499,
    duration_days: 365,
  },
  premium_monthly: {
    name: 'Premium Monthly',
    tier: 'premium',
    interval: 'monthly',
    price: 399,
    duration_days: 30,
  },
  premium_yearly: {
    name: 'Premium Yearly',
    tier: 'premium',
    interval: 'yearly',
    price: 3999,
    duration_days: 365,
  },
};

module.exports = PRODUCTS;
