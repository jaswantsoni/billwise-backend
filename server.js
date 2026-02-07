require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const passport = require('./config/passport');
const cron = require('node-cron');
const axios = require('axios');
const gstRoutes = require('./routes/gst');
const ewayRoutes = require('./routes/eway');
const authRoutes = require('./routes/auth');
const organisationRoutes = require('./routes/organisation');
const customerRoutes = require('./routes/customer');
const productRoutes = require('./routes/product');
const addressRoutes = require('./routes/address');
const invoiceRoutes = require('./routes/invoice');
const subscriptionRoutes = require('./routes/subscription');
const userRoutes = require('./routes/user');
const pdfController = require('./controllers/pdfController');
const { startExpiryCheck } = require('./services/cronJobs');
const supplierRoutes = require('./routes/supplier');
const purchaseRoutes = require('./routes/purchase');

const hsnRoutes = require('./routes/hsn');

const app = express();
const PORT = process.env.PORT || 8080;
const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3001';

// Keep Gotenberg awake - ping every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    await axios.get(`${GOTENBERG_URL}/health`, { timeout: 5000 });
    console.log('Gotenberg keepalive ping successful');
  } catch (err) {
    console.log('Gotenberg keepalive ping failed (service may be sleeping)');
  }
});

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
  exposedHeaders: ['X-GST-Cookie']
}));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api/gst', gstRoutes);
app.use('/api/eway', ewayRoutes);
app.use('/auth', authRoutes);
app.use('/api/organisations', organisationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hsn', hsnRoutes);

app.get('/public/invoice/:id/:signature', pdfController.getInvoicePDFPublic);

// Start cron jobs
startExpiryCheck();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
