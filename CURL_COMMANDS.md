# API CURL Commands

## Authentication

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "SecurePass123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

## Organisations

### Create Organisation
```bash
curl -X POST http://localhost:3000/api/organisations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "ABC Enterprises",
    "gstin": "29AABCT1332L1ZV",
    "address": "123 MG Road, Bangalore",
    "phone": "+919876543210",
    "email": "contact@abc.com"
  }'
```

### Get Organisations
```bash
curl -X GET http://localhost:3000/api/organisations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Customers

### Create Customer (with GST auto-fetch)
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "SUNNY LIGHTS",
    "gstin": "07AOWPK9610A1ZU",
    "email": "customer@example.com",
    "phone": "+919876543210",
    "addresses": [{
      "type": "billing",
      "line1": "Bhagirath Palace, Chandni Chowk Area",
      "line2": "New Delhi",
      "city": "North East Delhi",
      "state": "Delhi",
      "pincode": "110006",
      "country": "India",
      "isDefault": true
    }]
  }'
```

### Create Customer (manual)
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "XYZ Corp",
    "email": "xyz@example.com",
    "phone": "+919876543210",
    "addresses": [{
      "type": "billing",
      "line1": "456 Park Street",
      "line2": "Near City Mall",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "isDefault": true
    }]
  }'
```

### Get Customers
```bash
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Shipping Address
```bash
curl -X PUT http://localhost:3000/api/customers/shipping \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "addressId": "ADDRESS_ID"
  }'
```

## Products

### Create Product
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Profile Light Linear",
    "description": "LED Profile Light",
    "sku": "PoL",
    "hsnCode": "83791",
    "unit": "mtr",
    "price": 1200,
    "taxRate": 18,
    "currency": "INR"
  }'
```

### Get Products
```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Product
```bash
curl -X PUT http://localhost:3000/api/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "price": 1100,
    "taxRate": 18
  }'
```

## Addresses

### Add Address
```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "type": "shipping",
    "line1": "789 New Street",
    "line2": "Sector 5",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001",
    "country": "India",
    "isDefault": false,
    "isShipping": true
  }'
```

### Update Address
```bash
curl -X PUT http://localhost:3000/api/addresses/ADDRESS_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "line1": "Updated Street",
    "city": "Updated City"
  }'
```

### Delete Address
```bash
curl -X DELETE http://localhost:3000/api/addresses/ADDRESS_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Set Default Address
```bash
curl -X PUT http://localhost:3000/api/addresses/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "addressId": "ADDRESS_ID"
  }'
```

## GST Details

### Get GST Details
```bash
curl -X GET http://localhost:3000/api/gst/29AABCT1332L1ZV
```

## HSN/SAC Codes

### Search HSN by Product Name
```bash
curl -X GET "http://localhost:3000/api/hsn/search?query=laptop"
```

### Search HSN by Description
```bash
curl -X GET "http://localhost:3000/api/hsn/search?query=LED%20lights"
```

### Get HSN Details with GST Rate
```bash
curl -X GET http://localhost:3000/api/hsn/8471
```

## E-Way Bill

### Generate E-Way Bill
```bash
curl -X POST http://localhost:3000/api/eway/generate \
  -H "Content-Type: application/json" \
  -d '{
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
    "itemList": [{
      "productName": "Laptop",
      "hsnCode": 8471,
      "quantity": 1,
      "qtyUnit": "PCS",
      "taxableAmount": 45000,
      "cgstRate": 9,
      "sgstRate": 9,
      "igstRate": 0
    }]
  }'
```

### Get E-Way Bill
```bash
curl -X GET http://localhost:3000/api/eway/123456789012
```

### Cancel E-Way Bill
```bash
curl -X POST http://localhost:3000/api/eway/cancel/123456789012 \
  -H "Content-Type: application/json" \
  -d '{
    "cancelRsnCode": "2",
    "cancelRmrk": "Order cancelled"
  }'
```

---

## Notes:
- Replace `YOUR_JWT_TOKEN` with the token received from login/register
- Replace `CUSTOMER_ID`, `ADDRESS_ID`, `PRODUCT_ID` with actual IDs
- All authenticated endpoints require `Authorization: Bearer <token>` header
