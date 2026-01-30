# API Sample Payloads for Lovable

## Authentication

### Register User
**POST** `/auth/register`
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Login
**POST** `/auth/login`
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

## Organisations

### Create Organisation
**POST** `/api/organisations`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "name": "ABC Enterprises",
  "gstin": "29AABCT1332L1ZV",
  "address": "123 MG Road, Bangalore",
  "phone": "+919876543210",
  "email": "contact@abc.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "ABC Enterprises",
    "gstin": "29AABCT1332L1ZV",
    "address": "123 MG Road, Bangalore",
    "phone": "+919876543210",
    "email": "contact@abc.com",
    "userId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Organisations
**GET** `/api/organisations`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "ABC Enterprises",
      "gstin": "29AABCT1332L1ZV",
      "address": "123 MG Road, Bangalore",
      "phone": "+919876543210",
      "email": "contact@abc.com"
    }
  ]
}
```

## Customers

### Create Customer (with GST auto-fetch)
**POST** `/api/customers`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "gstin": "27AAPFU0939F1ZV",
  "organisationId": "507f1f77bcf86cd799439012",
  "email": "customer@example.com",
  "phone": "+919876543210"
}
```

### Create Customer (manual)
**POST** `/api/customers`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "name": "XYZ Corp",
  "email": "xyz@example.com",
  "phone": "+919876543210",
  "organisationId": "507f1f77bcf86cd799439012",
  "addresses": [
    {
      "type": "billing",
      "line1": "456 Park Street",
      "line2": "Near City Mall",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "isDefault": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "name": "XYZ Corp",
    "gstin": "27AAPFU0939F1ZV",
    "email": "customer@example.com",
    "phone": "+919876543210",
    "organisationId": "507f1f77bcf86cd799439012",
    "addresses": [
      {
        "id": "507f1f77bcf86cd799439014",
        "type": "billing",
        "line1": "456 Park Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "isDefault": true,
        "isShipping": false
      }
    ]
  }
}
```

### Get Customers
**GET** `/api/customers?organisationId=507f1f77bcf86cd799439012`
**Headers:** `Authorization: Bearer <token>`

### Update Shipping Address
**PUT** `/api/customers/shipping`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "customerId": "507f1f77bcf86cd799439013",
  "addressId": "507f1f77bcf86cd799439014"
}
```

## Products

### Create Product
**POST** `/api/products`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "name": "Laptop",
  "description": "Dell Inspiron 15",
  "sku": "LAP-001",
  "hsnCode": "8471",
  "unit": "PCS",
  "price": 45000,
  "taxRate": 18,
  "currency": "INR",
  "organisationId": "507f1f77bcf86cd799439012"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "name": "Laptop",
    "description": "Dell Inspiron 15",
    "sku": "LAP-001",
    "hsnCode": "8471",
    "unit": "PCS",
    "price": 45000,
    "taxRate": 18,
    "currency": "INR",
    "organisationId": "507f1f77bcf86cd799439012",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Products
**GET** `/api/products?organisationId=507f1f77bcf86cd799439012`
**Headers:** `Authorization: Bearer <token>`

### Update Product
**PUT** `/api/products/507f1f77bcf86cd799439015`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "price": 42000,
  "taxRate": 18
}
```

## GST Details

### Get GST Details
**GET** `/api/gst/29AABCT1332L1ZV`

**Response:**
```json
{
  "success": true,
  "data": {
    "flag": true,
    "data": {
      "gstin": "29AABCT1332L1ZV",
      "lgnm": "ABC PRIVATE LIMITED",
      "pradr": {
        "addr": {
          "bno": "123",
          "st": "MG Road",
          "loc": "Bangalore",
          "stcd": "Karnataka",
          "pncd": "560001"
        }
      },
      "sts": "Active"
    }
  }
}
```

## E-Way Bill

### Generate E-Way Bill
**POST** `/api/eway/generate`
```json
{
  "userGstin": "29AABCT1332L1ZV",
  "supplyType": "O",
  "subSupplyType": "1",
  "docType": "INV",
  "docNo": "INV001",
  "docDate": "15/01/2024",
  "fromGstin": "29AABCT1332L1ZV",
  "fromTrdName": "ABC Enterprises",
  "fromAddr1": "123 MG Road",
  "fromPlace": "Bangalore",
  "fromPincode": 560001,
  "fromStateCode": 29,
  "toGstin": "27AAPFU0939F1ZV",
  "toTrdName": "XYZ Corp",
  "toAddr1": "456 Park Street",
  "toPlace": "Mumbai",
  "toPincode": 400001,
  "toStateCode": 27,
  "totalValue": 45000,
  "cgstValue": 4050,
  "sgstValue": 4050,
  "igstValue": 0,
  "totInvValue": 53100,
  "transMode": "1",
  "transDistance": 850,
  "vehicleNo": "KA01AB1234",
  "itemList": [
    {
      "productName": "Laptop",
      "hsnCode": 8471,
      "quantity": 1,
      "qtyUnit": "PCS",
      "taxableAmount": 45000,
      "cgstRate": 9,
      "sgstRate": 9,
      "igstRate": 0
    }
  ]
}
```

### Get E-Way Bill
**GET** `/api/eway/123456789012`

### Cancel E-Way Bill
**POST** `/api/eway/cancel/123456789012`
```json
{
  "cancelRsnCode": "2",
  "cancelRmrk": "Order cancelled"
}
```

---

## For Lovable Integration

1. **Get OpenAPI JSON:**
   ```
   GET http://localhost:3000/api-docs.json
   ```

2. **Import to Lovable:**
   - Copy the JSON from `/api-docs.json`
   - Use in Lovable's API integration
   - All endpoints, schemas, and auth are included

3. **Authentication:**
   - Use Bearer token in Authorization header
   - Get token from `/auth/register` or `/auth/login`
   - Format: `Authorization: Bearer <your-token>`
