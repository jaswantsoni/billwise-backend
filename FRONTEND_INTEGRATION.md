# Frontend Integration Guide

## Base URL
```
Development: http://localhost:3000
Production: https://your-apprunner-url.com
```

## Authentication

### Register
```javascript
POST /auth/register
Body: {
  name: "John Doe",
  email: "john@example.com",
  password: "password123"
}
Response: {
  success: true,
  token: "jwt-token-here",
  user: { id, name, email }
}
```

### Login
```javascript
POST /auth/login
Body: {
  email: "john@example.com",
  password: "password123"
}
Response: {
  success: true,
  token: "jwt-token-here",
  user: { id, name, email }
}
```

### Google OAuth
```javascript
// Redirect user to:
GET /auth/google

// Callback will redirect to frontend with token:
// http://localhost:8080?token=jwt-token-here
```

## Headers for Protected Routes
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## GST Verification

### Get GST Details (with DB cache)
```javascript
GET /api/gst/:gstin

Response: {
  success: true,
  source: "database" | "api",  // Shows if from cache or API
  data: {
    data: { gstin, lgnm, tradeNam, pradr: {...} },
    mappedAddress: {
      line1: "Building name",
      line2: "Street",
      city: "City",
      district: "District",
      state: "State",
      pincode: "121004"
    },
    mappedOrganisation: {
      name: "Company Name",
      tradeName: "Trade Name",
      gstin: "GSTIN",
      pan: "PAN",
      address: "Address",
      city: "City",
      state: "State",
      stateCode: "06",
      pincode: "121004"
    }
  }
}
```

---

## HSN/SAC Search

### Search HSN Codes
```javascript
GET /api/hsn/search?query=lighting&page=1&size=20

Response: {
  success: true,
  data: {
    results: [
      {
        hsnCode: "9405",
        type: "HSN",
        description: "LAMPS AND LIGHTING FITTINGS...",
        gstRate: "18",
        effectiveDate: "15/11/2017",
        chapterName: "Furniture; bedding...",
        chapterNumber: "94",
        allTaxDetails: [...]
      }
    ],
    totalResults: 20,
    hasMore: true,
    page: 1,
    size: 20
  }
}
```

---

## Organisation

### Create Organisation
```javascript
POST /api/organisations
Body: {
  name: "My Company",
  gstin: "06AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  address: "123 Street",
  city: "Delhi",
  state: "Delhi",
  pincode: "110001",
  phone: "9876543210",
  email: "company@example.com",
  // Bank Details
  bankName: "HDFC Bank",
  accountNumber: "1234567890",
  ifsc: "HDFC0001234",
  upi: "company@paytm"
}
```

### Get Organisations
```javascript
GET /api/organisations

Response: {
  success: true,
  data: [{ id, name, gstin, ... }]
}
```

---

## Customer

### Create Customer
```javascript
POST /api/customers
Body: {
  name: "Customer Name",
  gstin: "27AAAAA0000A1Z5",  // Optional
  email: "customer@example.com",
  phone: "9876543210"
}
```

### Get Customers
```javascript
GET /api/customers

Response: {
  success: true,
  data: [{ id, name, gstin, email, phone, addresses: [...] }]
}
```

---

## Address

### Add Address
```javascript
POST /api/addresses
Body: {
  customerId: "customer-id",
  type: "BILLING" | "SHIPPING",
  line1: "Building name",
  line2: "Street",
  city: "City",
  state: "State",
  pincode: "121004",
  isDefault: true,
  isShipping: false
}
```

---

## Product

### Create Product
```javascript
POST /api/products
Body: {
  name: "LED Bulb",
  description: "9W LED Bulb",
  sku: "LED-9W-001",
  hsnCode: "8539",
  unit: "PCS",
  price: 150.00,
  taxRate: 12
}
```

### Get Products
```javascript
GET /api/products

Response: {
  success: true,
  data: [{ id, name, sku, hsnCode, price, taxRate, ... }]
}
```

---

## Invoice

### Create Invoice
```javascript
POST /api/invoices
Body: {
  customerId: "customer-id",
  billingAddressId: "address-id",
  shippingAddressId: "address-id",  // Optional
  invoiceDate: "2026-01-01",
  dueDate: "2026-01-31",
  items: [
    {
      productId: "product-id",
      description: "LED Bulb 9W",
      hsnSac: "8539",
      quantity: 10,
      unit: "PCS",
      rate: 150.00,
      taxRate: 12,
      discount: 0
    }
  ],
  notes: "Thank you for your business",
  termsConditions: "Payment within 30 days",
  // Optional fields
  deliveryCharges: 50,
  packingCharges: 25,
  vehicleNumber: "DL01AB1234",
  transportName: "XYZ Transport"
}

Response: {
  success: true,
  data: {
    id: "invoice-id",
    invoiceNumber: "INV-2026-001",
    subtotal: 1500,
    cgst: 90,
    sgst: 90,
    igst: 0,
    total: 1680,
    ...
  }
}
```

### Get Invoices
```javascript
GET /api/invoices

Response: {
  success: true,
  data: [{ id, invoiceNumber, customer, items, total, ... }]
}
```

### Get Single Invoice
```javascript
GET /api/invoices/:id

Response: {
  success: true,
  data: {
    id, invoiceNumber, customer, items, total,
    billingAddress, shippingAddress, ...
  }
}
```

### Download Invoice PDF
```javascript
GET /api/invoices/:id/pdf

// Returns PDF file (4 copies merged)
// Set responseType: 'blob' in axios

// Example with axios:
const response = await axios.get(
  `${API_URL}/api/invoices/${invoiceId}/pdf`,
  {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
    timeout: 60000  // 60 seconds for PDF generation
  }
);

// Download PDF
const url = window.URL.createObjectURL(new Blob([response.data]));
const link = document.createElement('a');
link.href = url;
link.download = `Invoice-${invoiceNumber}.pdf`;
link.click();
```

---

## Environment Variables for Frontend

```env
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## Sample Frontend Code (React)

### API Service
```javascript
// services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Auth Hook
```javascript
// hooks/useAuth.js
import { useState } from 'react';
import api from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error.response?.data || error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return { user, loading, login, register, logout };
};
```

### GST Verification
```javascript
// components/GSTVerification.jsx
import { useState } from 'react';
import api from '../services/api';

export const GSTVerification = ({ onVerified }) => {
  const [gstin, setGstin] = useState('');
  const [loading, setLoading] = useState(false);

  const verifyGST = async () => {
    if (gstin.length !== 15) {
      alert('GSTIN must be 15 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/api/gst/${gstin}`);
      
      // Auto-fill form with mapped data
      onVerified({
        organisation: data.data.mappedOrganisation,
        address: data.data.mappedAddress,
        source: data.source  // 'database' or 'api'
      });
    } catch (error) {
      alert('Failed to verify GSTIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={gstin}
        onChange={(e) => setGstin(e.target.value.toUpperCase())}
        placeholder="Enter GSTIN"
        maxLength={15}
      />
      <button onClick={verifyGST} disabled={loading}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </div>
  );
};
```

### HSN Search
```javascript
// components/HSNSearch.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

export const HSNSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/hsn/search', {
          params: { query, page: 1, size: 10 }
        });
        setResults(data.data.results);
      } catch (error) {
        console.error('HSN search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search HSN/SAC code..."
      />
      {loading && <div>Searching...</div>}
      <ul>
        {results.map((item) => (
          <li key={item.hsnCode} onClick={() => onSelect(item)}>
            <strong>{item.hsnCode}</strong> - {item.description}
            <br />
            <small>GST: {item.gstRate}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Invoice PDF Download
```javascript
// utils/downloadPDF.js
import api from '../services/api';

export const downloadInvoicePDF = async (invoiceId, invoiceNumber) => {
  try {
    const response = await api.get(`/api/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
      timeout: 60000  // 60 seconds
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF download failed:', error);
    throw error;
  }
};
```

---

## Important Notes

1. **PDF Generation**: First request may take 15-30 seconds (Gotenberg wake-up time). Show loading indicator.
2. **GST Verification**: Check `source` field - if "database", data is from cache (instant), if "api", fetched from external API.
3. **Invoice Numbers**: Auto-generated as `INV-YYYY-###`. Don't send in request.
4. **Tax Calculation**: Server-side automatic. Send item details, backend calculates CGST/SGST/IGST.
5. **Authentication**: Store JWT token in localStorage, add to all protected API calls.
6. **Error Handling**: All responses have `success: true/false` field.

---

## Swagger Documentation

Access interactive API docs at:
```
http://localhost:3000/api-docs
```

Download OpenAPI JSON:
```
http://localhost:3000/api-docs.json
```
