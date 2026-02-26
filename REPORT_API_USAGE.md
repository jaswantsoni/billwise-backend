# Report API Usage Guide

This document provides examples of how to use the Report API endpoints.

## Authentication

All report endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Purchase Register Report

Get a list of all purchases within a date range with optional supplier filter.

**Endpoint:** `GET /api/reports/purchase-register`

**Query Parameters:**
- `startDate` (optional): Start date in ISO format (e.g., 2024-01-01)
- `endDate` (optional): End date in ISO format
- `supplierId` (optional): Filter by specific supplier

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/purchase-register?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchases": [
      {
        "billNumber": "PB-001",
        "date": "2024-01-15",
        "supplierName": "ABC Suppliers",
        "supplierGSTIN": "27AABCU9603R1ZM",
        "invoiceNumber": "INV-123",
        "subtotal": 10000,
        "cgst": 900,
        "sgst": 900,
        "igst": 0,
        "totalTax": 1800,
        "grandTotal": 11800
      }
    ],
    "totals": {
      "subtotal": 10000,
      "cgst": 900,
      "sgst": 900,
      "igst": 0,
      "totalTax": 1800,
      "grandTotal": 11800
    },
    "count": 1,
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }
}
```

---

### 2. Supplier Ledger Report

Get all transactions with a specific supplier including opening balance, purchases, payments, and closing balance.

**Endpoint:** `GET /api/reports/supplier-ledger/:supplierId`

**Path Parameters:**
- `supplierId` (required): Supplier ID

**Query Parameters:**
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/supplier-ledger/65abc123def456789" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supplier": {
      "id": "65abc123def456789",
      "name": "ABC Suppliers",
      "gstin": "27AABCU9603R1ZM",
      "mobile": "9876543210",
      "email": "abc@example.com",
      "address": "123 Main St",
      "openingBalance": 5000
    },
    "openingBalance": 5000,
    "closingBalance": 16800,
    "transactions": [
      {
        "date": "2024-01-15",
        "type": "PURCHASE",
        "referenceNumber": "PB-001",
        "invoiceNumber": "INV-123",
        "debit": 11800,
        "credit": 0,
        "balance": 16800,
        "dueDate": "2024-02-15",
        "paymentStatus": "UNPAID"
      }
    ],
    "dateRange": {}
  }
}
```

---

### 3. Stock Summary Report

Get current stock levels and valuations for all products.

**Endpoint:** `GET /api/reports/stock-summary`

**Query Parameters:**
- `lowStock` (optional): Set to "true" to filter only low stock items

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/stock-summary?lowStock=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "65abc123def456789",
        "name": "Product A",
        "sku": "SKU-001",
        "unit": "PCS",
        "stockQuantity": 50,
        "avgCost": 100.5000,
        "stockValuation": 5025.00,
        "minStock": 100,
        "isLowStock": true
      }
    ],
    "totalValuation": 5025.00,
    "totalProducts": 1
  }
}
```

---

### 4. Stock Ledger Report

Get all stock movements for a specific product.

**Endpoint:** `GET /api/reports/stock-ledger/:productId`

**Path Parameters:**
- `productId` (required): Product ID

**Query Parameters:**
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/stock-ledger/65abc123def456789" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "65abc123def456789",
      "name": "Product A",
      "sku": "SKU-001",
      "unit": "PCS"
    },
    "openingStock": 0,
    "closingStock": 100,
    "currentStock": 100,
    "transactions": [
      {
        "date": "2024-01-15",
        "type": "PURCHASE",
        "referenceType": "Purchase",
        "quantityIn": 100,
        "quantityOut": 0,
        "balance": 100,
        "rate": 100.50,
        "avgCost": 100.5000,
        "notes": null
      }
    ],
    "dateRange": {}
  }
}
```

---

### 5. Product Profit Report

Get profit analysis for all products based on sales.

**Endpoint:** `GET /api/reports/product-profit`

**Query Parameters:**
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/product-profit?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productName": "Product A",
        "quantitySold": 50,
        "salesValue": 7500.00,
        "cogs": 5025.00,
        "profit": 2475.00,
        "profitPercentage": 33.00
      }
    ],
    "totals": {
      "totalSales": 7500.00,
      "totalCOGS": 5025.00,
      "totalProfit": 2475.00,
      "avgProfitPercentage": 33.00
    },
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }
}
```

---

### 6. Monthly Turnover Report

Get monthly purchases, sales, and gross profit for a year.

**Endpoint:** `GET /api/reports/monthly-turnover`

**Query Parameters:**
- `year` (required): Year for the report (e.g., 2024)

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/monthly-turnover?year=2024" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "months": [
      {
        "month": "January",
        "purchases": 50000.00,
        "sales": 75000.00,
        "grossProfit": 25000.00
      },
      {
        "month": "February",
        "purchases": 45000.00,
        "sales": 68000.00,
        "grossProfit": 23000.00
      }
    ],
    "totals": {
      "totalPurchases": 95000.00,
      "totalSales": 143000.00,
      "totalGrossProfit": 48000.00
    }
  }
}
```

---

### 7. GST Purchase Report

Get GST details for all purchases, separated by intrastate and interstate.

**Endpoint:** `GET /api/reports/gst-purchase`

**Query Parameters:**
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

**Example Request:**
```bash
curl -X GET "http://localhost:8080/api/reports/gst-purchase?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "intrastate": [
      {
        "supplierGSTIN": "27AABCU9603R1ZM",
        "supplierName": "ABC Suppliers",
        "invoiceNumber": "INV-123",
        "invoiceDate": "2024-01-15",
        "taxableValue": 10000.00,
        "cgst": 900.00,
        "sgst": 900.00,
        "total": 11800.00
      }
    ],
    "interstate": [
      {
        "supplierGSTIN": "24AABCU9603R1ZM",
        "supplierName": "XYZ Suppliers",
        "invoiceNumber": "INV-456",
        "invoiceDate": "2024-01-20",
        "taxableValue": 15000.00,
        "igst": 2700.00,
        "total": 17700.00
      }
    ],
    "totals": {
      "intrastateTotal": 11800.00,
      "interstateTotal": 17700.00,
      "totalTaxableValue": 25000.00,
      "totalGST": 4500.00
    },
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }
}
```

---

### 8. Export Report

Export any report to PDF or Excel format.

**Endpoint:** `POST /api/reports/export`

**Request Body:**
```json
{
  "reportType": "purchase-register",
  "format": "pdf",
  "reportData": {
    // Report data from any of the above endpoints
  }
}
```

**Valid Report Types:**
- `purchase-register`
- `supplier-ledger`
- `stock-summary`
- `stock-ledger`
- `product-profit`
- `monthly-turnover`
- `gst-purchase`

**Valid Formats:**
- `pdf`
- `excel`

**Example Request:**
```bash
curl -X POST "http://localhost:8080/api/reports/export" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "purchase-register",
    "format": "pdf",
    "reportData": {
      "purchases": [...],
      "totals": {...}
    }
  }' \
  --output report.pdf
```

**Response:**
- Binary file (PDF or Excel) with appropriate content-type header
- Filename in Content-Disposition header

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing or invalid parameters)
- `404` - Not Found (supplier or product not found)
- `500` - Internal Server Error

---

## Integration Example (JavaScript/Node.js)

```javascript
const axios = require('axios');

const API_BASE_URL = 'http://localhost:8080/api';
const AUTH_TOKEN = 'your-jwt-token';

async function getPurchaseRegister(startDate, endDate) {
  try {
    const response = await axios.get(`${API_BASE_URL}/reports/purchase-register`, {
      params: { startDate, endDate },
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error fetching purchase register:', error.response?.data || error.message);
    throw error;
  }
}

async function exportReportToPDF(reportType, reportData) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/reports/export`,
      {
        reportType,
        format: 'pdf',
        reportData
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Save to file
    const fs = require('fs');
    fs.writeFileSync(`${reportType}.pdf`, response.data);
    console.log('Report exported successfully');
  } catch (error) {
    console.error('Error exporting report:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
(async () => {
  const report = await getPurchaseRegister('2024-01-01', '2024-12-31');
  console.log('Purchase Register:', report);
  
  await exportReportToPDF('purchase-register', report);
})();
```

---

## Notes

1. All date parameters should be in ISO 8601 format (YYYY-MM-DD)
2. All monetary values are returned as numbers with 2 decimal places
3. Average costs are returned with 4 decimal places for precision
4. The export endpoint accepts the full report data, so you need to fetch the report first, then export it
5. Authentication is required for all endpoints
6. The user's organisation ID is automatically extracted from the JWT token
