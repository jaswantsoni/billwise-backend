const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kampony SaaS API',
      version: '2.0.0',
      description: `
## Kampony SaaS API

Use Kampony as a billing and inventory backend for your website, app, or e-commerce store.

### Authentication

All SaaS API endpoints require an **API Key** passed as a header:

\`\`\`
X-API-Key: kmp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

Generate an API key from **POST /api/saas/keys** (requires your Kampony JWT login token).

### Permissions

API keys can be scoped to specific permissions:

| Permission | Access |
|---|---|
| \`products:read\` | Read products |
| \`products:write\` | Create / update / delete products |
| \`customers:read\` | Read customers |
| \`customers:write\` | Create / update customers and addresses |
| \`orders:read\` | Read orders |
| \`orders:write\` | Create orders, update status |
| \`invoices:read\` | Read invoices |
| \`invoices:write\` | Create invoices |
| \`inventory:read\` | Read stock levels |
| \`inventory:write\` | Adjust stock |
| \`webhooks:write\` | Register and manage webhooks |

Empty permissions array = full access (backward compatible).

### Webhook Events

| Event | Trigger |
|---|---|
| \`invoice.created\` | New invoice created |
| \`invoice.paid\` | Invoice marked as paid |
| \`invoice.cancelled\` | Invoice cancelled |
| \`order.created\` | New order created |
| \`order.status_changed\` | Order status updated |
| \`inventory.low_stock\` | Product stock ≤ threshold |
| \`inventory.out_of_stock\` | Product stock = 0 |

### Signature Verification

All webhook deliveries include \`X-Kampony-Signature: sha256=<hmac>\`.  
Verify with:
\`\`\`js
const sig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const isValid = sig === req.headers['x-kampony-signature'].replace('sha256=', '');
\`\`\`
      `,
      contact: {
        name: 'Kampony Support',
        url: 'https://www.kampony.com',
        email: 'support@kampony.com',
      },
    },
    servers: [
      {
        url: 'https://backend.kampony.com',
        description: 'Production',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Never-expiring API key. Generate via POST /api/saas/keys',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token (only for generating API keys)',
        },
      },
      schemas: {
        // ── Common ──────────────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Customer not found' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },

        // ── Address ──────────────────────────────────────────────────────────
        Address: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665a1b2c3d4e5f6a7b8c9d0e' },
            line1: { type: 'string', example: '123 MG Road' },
            line2: { type: 'string', example: 'Near Bus Stand' },
            city: { type: 'string', example: 'Bangalore' },
            state: { type: 'string', example: 'Karnataka' },
            pincode: { type: 'string', example: '560001' },
            type: { type: 'string', enum: ['BILLING', 'SHIPPING'], example: 'BILLING' },
            isDefault: { type: 'boolean', example: true },
          },
        },
        AddressInput: {
          type: 'object',
          required: ['line1'],
          properties: {
            line1: { type: 'string', example: '123 MG Road' },
            line2: { type: 'string' },
            city: { type: 'string', example: 'Bangalore' },
            state: { type: 'string', example: 'Karnataka' },
            pincode: { type: 'string', example: '560001' },
            type: { type: 'string', enum: ['BILLING', 'SHIPPING'], default: 'BILLING' },
            isDefault: { type: 'boolean', default: false },
          },
        },

        // ── Customer ─────────────────────────────────────────────────────────
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Rahul Sharma' },
            email: { type: 'string', example: 'rahul@example.com' },
            phone: { type: 'string', example: '9876543210' },
            gstin: { type: 'string', example: '29ABCDE1234F1Z5' },
            addresses: { type: 'array', items: { $ref: '#/components/schemas/Address' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomerInput: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', example: 'Rahul Sharma' },
            email: { type: 'string', format: 'email', example: 'rahul@example.com' },
            phone: { type: 'string', example: '9876543210' },
            gstin: { type: 'string', example: '29ABCDE1234F1Z5' },
            addresses: {
              type: 'array',
              items: { $ref: '#/components/schemas/AddressInput' },
            },
          },
        },

        // ── Product ──────────────────────────────────────────────────────────
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Cotton T-Shirt' },
            sku: { type: 'string', example: 'TSHIRT-BLK-M' },
            price: { type: 'number', example: 999 },
            taxRate: { type: 'number', example: 18, description: 'GST rate in %' },
            unit: { type: 'string', example: 'PCS' },
            hsnCode: { type: 'string', example: '61091000' },
            description: { type: 'string' },
            taxInclusive: { type: 'boolean', example: false },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            stockQuantity: { type: 'number', example: 100 },
          },
        },
        ProductInput: {
          type: 'object',
          required: ['name', 'price', 'taxRate', 'unit'],
          properties: {
            name: { type: 'string', example: 'Cotton T-Shirt' },
            sku: { type: 'string', example: 'TSHIRT-BLK-M', description: 'Auto-generated if not provided' },
            price: { type: 'number', example: 999 },
            taxRate: { type: 'number', example: 18, description: 'GST rate in %' },
            unit: { type: 'string', example: 'PCS', description: 'PCS, KGS, MTR, LTR, BOX, etc.' },
            hsnCode: { type: 'string', example: '61091000' },
            sacCode: { type: 'string' },
            description: { type: 'string' },
            taxInclusive: { type: 'boolean', default: false, description: 'true = price already includes GST' },
            images: { type: 'array', items: { type: 'string', format: 'uri' }, example: ['https://cdn.example.com/shirt.jpg'] },
          },
        },

        // ── Order ────────────────────────────────────────────────────────────
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Optional. Fetches name/HSN/GST automatically' },
            name: { type: 'string', example: 'Cotton T-Shirt' },
            sku: { type: 'string', example: 'TSHIRT-BLK-M' },
            quantity: { type: 'number', example: 2 },
            price: { type: 'number', example: 999 },
            taxRate: { type: 'number', example: 18 },
            taxInclusive: { type: 'boolean', example: false },
            unit: { type: 'string', example: 'PCS' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNumber: { type: 'string', example: 'ORD-1748000000000' },
            customerId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
              example: 'PENDING',
            },
            paymentStatus: {
              type: 'string',
              enum: ['UNPAID', 'PAID', 'PARTIAL', 'REFUNDED'],
              example: 'UNPAID',
            },
            subtotal: { type: 'number', example: 1694.92 },
            taxAmount: { type: 'number', example: 305.08 },
            total: { type: 'number', example: 2000 },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            invoiceId: { type: 'string', description: 'Set once invoice is generated from this order' },
            source: { type: 'string', example: 'shopify' },
            externalOrderId: { type: 'string', example: '5123456789' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['customerId', 'items'],
          properties: {
            customerId: { type: 'string' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' }, minItems: 1 },
            billingAddressId: { type: 'string' },
            shippingAddressId: { type: 'string' },
            notes: { type: 'string' },
            source: { type: 'string', example: 'shopify', description: 'Where the order came from' },
            externalOrderId: { type: 'string', example: '5123456789' },
          },
        },

        // ── Invoice ──────────────────────────────────────────────────────────
        InvoiceItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Optional. Auto-fills name, HSN, GST rate, unit' },
            name: { type: 'string', example: 'Cotton T-Shirt' },
            quantity: { type: 'number', example: 2 },
            price: { type: 'number', example: 999 },
            taxRate: { type: 'number', example: 18 },
            taxInclusive: { type: 'boolean', example: false, description: 'true = price includes GST already' },
            hsnCode: { type: 'string' },
            unit: { type: 'string', example: 'PCS' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoiceNumber: { type: 'string', example: 'INV/26-27/001' },
            total: { type: 'number', example: 2000 },
            subtotal: { type: 'number', example: 1694.92 },
            cgst: { type: 'number', example: 152.54 },
            sgst: { type: 'number', example: 152.54 },
            igst: { type: 'number', example: 0 },
            paymentStatus: { type: 'string', enum: ['UNPAID', 'PAID', 'PARTIAL', 'CANCELLED'] },
            invoiceDate: { type: 'string', format: 'date-time' },
            dueDate: { type: 'string', format: 'date-time' },
            customer: { $ref: '#/components/schemas/Customer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/InvoiceItem' } },
          },
        },
        InvoiceInput: {
          type: 'object',
          required: ['customerId', 'items'],
          properties: {
            customerId: { type: 'string' },
            billingAddressId: { type: 'string', description: 'Uses customer default if omitted' },
            shippingAddressId: { type: 'string' },
            orderId: { type: 'string', description: 'Link to an existing order' },
            invoiceDate: { type: 'string', format: 'date', example: '2026-06-04' },
            dueDate: { type: 'string', format: 'date', example: '2026-07-04' },
            items: { type: 'array', items: { $ref: '#/components/schemas/InvoiceItem' }, minItems: 1 },
            notes: { type: 'string' },
          },
        },

        // ── Inventory ────────────────────────────────────────────────────────
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sku: { type: 'string' },
            unit: { type: 'string' },
            stockQuantity: { type: 'number' },
            price: { type: 'number' },
            taxRate: { type: 'number' },
          },
        },

        // ── Webhook ──────────────────────────────────────────────────────────
        WebhookConfig: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri', example: 'https://yoursite.com/webhooks/kampony' },
            events: {
              type: 'array',
              items: { type: 'string' },
              example: ['invoice.created', 'order.status_changed'],
            },
            active: { type: 'boolean' },
            failureCount: { type: 'number' },
            lastCalledAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── API Key ──────────────────────────────────────────────────────────
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            key: { type: 'string', example: 'kmp_abc123...' },
            name: { type: 'string', example: 'Shopify Connector' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['products:write', 'orders:write', 'invoices:read'] },
            active: { type: 'boolean' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Pagination ───────────────────────────────────────────────────────
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 142 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
          },
        },
      },
    },

    // ── Paths ─────────────────────────────────────────────────────────────────
    paths: {

      // API Keys
      '/api/saas/keys': {
        post: {
          summary: 'Generate API key',
          description: 'Creates a never-expiring API key for an organisation. Requires JWT auth.',
          tags: ['API Keys'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['organisationId', 'name'],
                  properties: {
                    organisationId: { type: 'string' },
                    name: { type: 'string', example: 'Shopify Connector' },
                    permissions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Empty = full access',
                      example: ['products:write', 'customers:write', 'orders:write', 'invoices:read'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'API key created (shown only once)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKey' } } } },
            401: { description: 'Unauthorized' },
          },
        },
        get: {
          summary: 'List API keys',
          tags: ['API Keys'],
          security: [{ BearerAuth: [] }],
          parameters: [{ in: 'query', name: 'organisationId', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Keys with masked values' },
          },
        },
      },
      '/api/saas/keys/{id}': {
        delete: {
          summary: 'Revoke API key',
          tags: ['API Keys'],
          security: [{ BearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Key revoked' } },
        },
      },

      // Customers
      '/api/saas/customers': {
        post: {
          summary: 'Create customer',
          tags: ['Customers'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerInput' } } } },
          responses: {
            200: { description: 'Customer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Customer' } } } },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/saas/customers/bulk': {
        post: {
          summary: 'Bulk create customers (max 500)',
          tags: ['Customers'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customers: { type: 'array', items: { $ref: '#/components/schemas/CustomerInput' }, maxItems: 500 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: '{ created: N, failed: N }' } },
        },
      },
      '/api/saas/customers/{id}': {
        put: {
          summary: 'Update customer',
          tags: ['Customers'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerInput' } } } },
          responses: { 200: { description: 'Updated customer' } },
        },
      },
      '/api/saas/customers/{id}/addresses': {
        post: {
          summary: 'Add address to customer',
          tags: ['Customers'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AddressInput' } } } },
          responses: { 200: { description: 'Address added' } },
        },
      },
      '/api/saas/customers/{id}/addresses/{addressId}': {
        delete: {
          summary: 'Remove address from customer',
          tags: ['Customers'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
            { in: 'path', name: 'addressId', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Address removed' } },
        },
      },

      // Products
      '/api/saas/products': {
        post: {
          summary: 'Create product',
          tags: ['Products'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
          responses: { 200: { description: 'Product created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } } },
        },
      },
      '/api/saas/products/bulk': {
        post: {
          summary: 'Bulk create products (max 500)',
          tags: ['Products'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { products: { type: 'array', items: { $ref: '#/components/schemas/ProductInput' }, maxItems: 500 } },
                },
              },
            },
          },
          responses: { 200: { description: '{ created: N, failed: N }' } },
        },
      },
      '/api/saas/products/{id}': {
        put: {
          summary: 'Update product',
          tags: ['Products'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
          responses: { 200: { description: 'Updated product' } },
        },
        delete: {
          summary: 'Delete product',
          tags: ['Products'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product deleted' } },
        },
      },

      // Inventory
      '/api/saas/inventory': {
        get: {
          summary: 'Get inventory',
          tags: ['Inventory'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
            { in: 'query', name: 'lowStock', schema: { type: 'boolean' }, description: 'Filter products with stock ≤ 5' },
          ],
          responses: { 200: { description: 'Inventory list with stock quantities' } },
        },
      },
      '/api/saas/inventory/adjust': {
        post: {
          summary: 'Adjust stock',
          tags: ['Inventory'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['productId', 'quantity'],
                  properties: {
                    productId: { type: 'string' },
                    quantity: { type: 'integer', example: -2, description: 'Negative = deduct, positive = add' },
                    reason: { type: 'string', enum: ['ORDER', 'RETURN', 'ADJUSTMENT', 'PURCHASE', 'DAMAGE', 'MANUAL'], default: 'MANUAL' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Stock adjusted. Fires webhook if low/out-of-stock.' } },
        },
      },

      // Orders
      '/api/saas/orders': {
        post: {
          summary: 'Create order',
          description: 'Creates an order before an invoice. Use this to track pending payments and partial fulfillments.',
          tags: ['Orders'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderInput' } } } },
          responses: { 200: { description: 'Order created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } },
        },
        get: {
          summary: 'List orders',
          tags: ['Orders'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] } },
            { in: 'query', name: 'paymentStatus', schema: { type: 'string', enum: ['UNPAID', 'PAID', 'PARTIAL', 'REFUNDED'] } },
          ],
          responses: { 200: { description: 'Paginated orders' } },
        },
      },
      '/api/saas/orders/{id}': {
        get: {
          summary: 'Get order by ID',
          tags: ['Orders'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Order details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } },
        },
      },
      '/api/saas/orders/{id}/status': {
        patch: {
          summary: 'Update order status',
          tags: ['Orders'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] },
                    paymentStatus: { type: 'string', enum: ['UNPAID', 'PAID', 'PARTIAL', 'REFUNDED'] },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Status updated. Fires order.status_changed webhook.' } },
        },
      },

      // Invoices
      '/api/saas/invoices': {
        post: {
          summary: 'Create invoice',
          description: 'Creates a GST-compliant invoice. Supports productId lookup and per-item taxInclusive mode.',
          tags: ['Invoices'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceInput' } } } },
          responses: { 200: { description: 'Invoice created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } } },
        },
        get: {
          summary: 'List invoices',
          tags: ['Invoices'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['UNPAID', 'PAID', 'PARTIAL', 'CANCELLED'] } },
          ],
          responses: { 200: { description: 'Paginated invoices' } },
        },
      },
      '/api/saas/invoices/{id}': {
        get: {
          summary: 'Get invoice by ID',
          tags: ['Invoices'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Full invoice with items and customer', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } } },
        },
      },

      // Webhooks
      '/api/saas/webhooks': {
        post: {
          summary: 'Register webhook',
          tags: ['Webhooks'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: { type: 'string', format: 'uri', example: 'https://yoursite.com/webhooks/kampony' },
                    events: { type: 'array', items: { type: 'string' }, example: ['invoice.created', 'order.status_changed'] },
                    secret: { type: 'string', description: 'Optional. Auto-generated if omitted.' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Webhook registered with signing secret', content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookConfig' } } } } },
        },
        get: {
          summary: 'List webhooks',
          tags: ['Webhooks'],
          security: [{ ApiKeyAuth: [] }],
          responses: { 200: { description: 'All webhook configs' } },
        },
      },
      '/api/saas/webhooks/{id}': {
        delete: {
          summary: 'Disable webhook',
          tags: ['Webhooks'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Webhook disabled' } },
        },
      },
      '/api/saas/webhooks/{id}/deliveries': {
        get: {
          summary: 'Get webhook delivery logs',
          tags: ['Webhooks'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Last 50 delivery attempts with status codes' } },
        },
      },
    },

    tags: [
      { name: 'API Keys', description: 'Generate and manage API keys (JWT auth required)' },
      { name: 'Customers', description: 'Manage customers and their addresses' },
      { name: 'Products', description: 'Manage products with SKU, images, and GST rates' },
      { name: 'Inventory', description: 'View and adjust stock levels' },
      { name: 'Orders', description: 'Create and track orders before invoicing' },
      { name: 'Invoices', description: 'Create GST-compliant invoices with auto tax calculation' },
      { name: 'Webhooks', description: 'Register webhooks for real-time event notifications' },
    ],
  },
  apis: [], // All paths defined inline above
};

module.exports = swaggerJsdoc(options);
