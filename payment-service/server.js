require('dotenv').config();
const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/payment');
const subscriptionRoutes = require('./routes/subscription');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

app.use('/api/payment', paymentRoutes);
app.use('/api/subscription', subscriptionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Payment service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`);
  console.log(`📦 Subscription API: http://localhost:${PORT}/api/subscription`);
  console.log(`\n✅ Ready to accept payments\n`);
});
