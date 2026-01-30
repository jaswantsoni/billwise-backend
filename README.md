# Billing Software Backend for Indian MSME

## Features
- User authentication (Email/Password & Google OAuth)
- Organisation management
- Customer management with GST integration
- Product catalog with HSN/SAC codes
- Multiple addresses per customer
- GST details verification
- E-Way bill generation
- Swagger API documentation

## Setup
```bash
npm install
npx prisma generate
```

## Configuration
Add credentials in `.env` file:
- DATABASE_URL
- JWT_SECRET
- SESSION_SECRET
- GST_API_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- EWAY_USERNAME
- EWAY_PASSWORD
- EWAY_APP_KEY

## Run
```bash
npm start
```

## API Documentation
Access Swagger UI at: `http://localhost:3000/api-docs`

## For Lovable Integration

### Get OpenAPI JSON Spec:
```
GET http://localhost:3000/api-docs.json
```

### Sample Payloads:
See [API_SAMPLES.md](./API_SAMPLES.md) for complete request/response examples

## API Endpoints

### Authentication
```
POST /auth/register
POST /auth/login
GET /auth/google
GET /auth/google/callback
```

### Organisations
```
POST /api/organisations
GET /api/organisations
```

### Customers
```
POST /api/customers
GET /api/customers
PUT /api/customers/shipping
```

### Products
```
POST /api/products
GET /api/products
PUT /api/products/:id
```

### GST Details
```
GET /api/gst/:gstin
```

### E-Way Bill
```
POST /api/eway/generate
GET /api/eway/:ewbNo
POST /api/eway/cancel/:ewbNo
```
# billwise-backend
