# React Frontend Integration - Razorpay Payment Service

## Setup

### 1. Add Razorpay Script
Add to your `index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### 2. Environment Variables
```env
VITE_PAYMENT_SERVICE_URL=http://localhost:4000
```

## Payment Service API Client
```javascript
// services/paymentService.js
const PAYMENT_API = import.meta.env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:4000';

export const createOrder = async (amount, receipt, notes = {}) => {
  const response = await fetch(`${PAYMENT_API}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, receipt, notes })
  });
  return await response.json();
};

export const verifyPayment = async (paymentData) => {
  const response = await fetch(`${PAYMENT_API}/api/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData)
  });
  return await response.json();
};
```

## React Payment Component
```javascript
// components/PaymentButton.jsx
import { useState } from 'react';
import { createOrder, verifyPayment } from '../services/paymentService';

export default function PaymentButton({ amount, invoiceId, customerName, customerEmail, customerPhone, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const { order, key_id } = await createOrder(amount, `invoice_${invoiceId}`, {
        invoiceId,
        customerName
      });

      const options = {
        key: key_id,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.id,
        name: 'Your Company Name',
        description: `Payment for Invoice #${invoiceId}`,
        handler: async function (response) {
          try {
            const result = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (result.verified) {
              onSuccess(result.payment);
            } else {
              onError('Payment verification failed');
            }
          } catch (error) {
            onError(error.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        theme: {
          color: '#0d6efd'
        },
        modal: {
          ondismiss: () => setLoading(false)
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      setLoading(false);
      onError(error.message);
    }
  };

  return (
    <button 
      onClick={handlePayment} 
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Processing...' : `Pay ₹${amount}`}
    </button>
  );
}
```

## Usage Example
```javascript
import PaymentButton from './components/PaymentButton';

function InvoicePage() {
  const handlePaymentSuccess = (payment) => {
    console.log('Payment successful:', payment);
    // Update invoice status in your backend
    fetch(`/api/invoices/${invoiceId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: payment.id, status: 'PAID' })
    });
  };

  const handlePaymentError = (error) => {
    console.error('Payment failed:', error);
    alert('Payment failed. Please try again.');
  };

  return (
    <div>
      <h2>Invoice #INV-2026-001</h2>
      <p>Amount: ₹1500</p>
      
      <PaymentButton 
        amount={1500}
        invoiceId="INV-2026-001"
        customerName="John Doe"
        customerEmail="john@example.com"
        customerPhone="9999999999"
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}
```

## Testing
```
Card: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
```
