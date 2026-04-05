require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const passport = require('./config/passport');
const gstRoutes = require('./routes/gst');
const ewayRoutes = require('./routes/eway');
const authRoutes = require('./routes/auth');
const organisationRoutes = require('./routes/organisation');
const customerRoutes = require('./routes/customer');
const productRoutes = require('./routes/product');
const addressRoutes = require('./routes/address');
const invoiceRoutes = require('./routes/invoice');
const creditNoteRoutes = require('./routes/creditNote');
const debitNoteRoutes = require('./routes/debitNote');
const subscriptionRoutes = require('./routes/subscription');
const userRoutes = require('./routes/user');
const pdfController = require('./controllers/productionPdfController');
const { startExpiryCheck } = require('./services/cronJobs');
const errorHandler = require('./middleware/errorHandler');

const hsnRoutes = require('./routes/hsn');
const ifscRoutes = require('./routes/ifsc');
const gmailRoutes = require('./routes/gmail');
const emailRoutes = require('./routes/email');
const mailerRoutes = require('./routes/mailer');
const templateRoutes = require('./routes/template');
const supplierRoutes = require('./routes/supplier');
const purchaseRoutes = require('./routes/purchase');
const stockRoutes = require('./routes/stock');
const reportRoutes = require('./routes/report');
const pdfRoutes = require('./routes/pdf');
const customTemplateRoutes = require('./routes/customTemplate');

const app = express();
const PORT = process.env.PORT || 8080;
const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3001';

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://www.kampony.com',
      'https://kampony.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['X-GST-Cookie'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-GST-Cookie']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
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
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/debit-notes', debitNoteRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hsn', hsnRoutes);
app.use('/api/ifsc', ifscRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/mailer', mailerRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/custom-templates', customTemplateRoutes);
app.use('/api/feedback', require('./routes/feedback'));

app.get('/public/invoice/:id/:signature', pdfController.getInvoicePDFPublic);

// Error handler middleware (must be last)
app.use(errorHandler);

// Start cron jobs
startExpiryCheck();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
