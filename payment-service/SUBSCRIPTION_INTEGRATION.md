# Subscription Integration - Product Based

## API Client
```javascript
// services/subscriptionService.js
const PAYMENT_API = import.meta.env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:4000';

export const getProducts = async () => {
  const response = await fetch(`${PAYMENT_API}/api/subscription/products`);
  return await response.json();
};

export const createSubscription = async (product_code, customer) => {
  const response = await fetch(`${PAYMENT_API}/api/subscription/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_code, ...customer })
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

## React Component
```javascript
// components/SubscriptionButton.jsx
import { useState } from 'react';
import { createSubscription, verifyPayment } from '../services/subscriptionService';

export default function SubscriptionButton({ productCode, customerName, customerEmail, customerPhone, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { order, key_id } = await createSubscription(productCode, {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      });

      const options = {
        key: key_id,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.id,
        name: 'Billing App',
        description: order.product_name,
        handler: async function (response) {
          try {
            const result = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (result.verified) {
              // Send to your backend to activate subscription
              onSuccess({
                payment: result.payment,
                product_code: order.product_code,
                tier: order.tier,
                interval: order.interval,
                duration_days: order.duration_days
              });
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
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Processing...' : 'Subscribe'}
    </button>
  );
}
```

## Pricing Page
```javascript
import { useState, useEffect } from 'react';
import { getProducts } from '../services/subscriptionService';
import SubscriptionButton from './SubscriptionButton';

export default function PricingPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getProducts().then(data => setProducts(data.products));
  }, []);

  const handleSuccess = async (data) => {
    // Update subscription in your main backend
    await fetch('http://localhost:3000/api/subscriptions/activate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        payment_id: data.payment.id,
        product_code: data.product_code,
        tier: data.tier,
        interval: data.interval,
        duration_days: data.duration_days
      })
    });
    
    alert('Subscription activated!');
  };

  return (
    <div className="pricing">
      {products.map(product => (
        <div key={product.code} className="plan-card">
          <h3>{product.name}</h3>
          <p>₹{product.price} / {product.interval}</p>
          <SubscriptionButton
            productCode={product.code}
            customerName="John Doe"
            customerEmail="john@example.com"
            customerPhone="9999999999"
            onSuccess={handleSuccess}
            onError={(err) => alert(err)}
          />
        </div>
      ))}
    </div>
  );
}
```

## Backend Integration (Main App)
```javascript
// Activate subscription after payment
POST /api/subscriptions/activate
Headers: { Authorization: 'Bearer <token>' }
Body: {
  payment_id: "pay_xxx",
  product_code: "premium_yearly",
  tier: "premium",
  interval: "yearly",
  duration_days: 365,
  amount: 3999
}

// Get current subscription
GET /api/subscriptions/current
Headers: { Authorization: 'Bearer <token>' }

// Get subscription history
GET /api/subscriptions/history
Headers: { Authorization: 'Bearer <token>' }
```

## Database Schema
```prisma
model User {
  planTier      String?   @default("free")
  planInterval  String?
  planStatus    String?   @default("inactive")
  planExpiry    DateTime?
  subscriptions Subscription[]
}

model Subscription {
  id          String   @id
  userId      String
  productCode String
  tier        String
  interval    String
  amount      Float
  paymentId   String
  status      String   @default("active")
  startDate   DateTime
  endDate     DateTime
}
```

## Products
- `basic_monthly` - ₹149/month (30 days)
- `basic_yearly` - ₹1,499/year (365 days)
- `premium_monthly` - ₹399/month (30 days)
- `premium_yearly` - ₹3,999/year (365 days)
