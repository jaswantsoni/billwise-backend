# Frontend Integration - Webhook Payments

## Key Change
❌ **Removed**: Manual activation API  
✅ **New**: Automatic webhook activation

## Required Changes

### 1. Add user_id to Order Creation
```javascript
// OLD
{ product_code: "premium_monthly" }

// NEW - Must include user_id
{
  product_code: "premium_monthly",
  user_id: currentUser.id,  // ⚠️ REQUIRED
  customer_email: currentUser.email,
  customer_name: currentUser.name
}
```

### 2. Simple Payment Handler
```javascript
const handleSubscribe = async (productCode) => {
  // Create order
  const orderData = await fetch('http://localhost:4000/api/payment/subscription/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_code: productCode,
      user_id: user.id,
      customer_email: user.email,
      customer_name: user.name
    })
  }).then(res => res.json());

  // Open Razorpay
  const rzp = new window.Razorpay({
    key: orderData.key_id,
    amount: orderData.order.amount * 100,
    order_id: orderData.order.id,
    handler: (response) => {
      // Payment success - webhook activates automatically
      showSuccess('Payment successful! Subscription activated.');
      setTimeout(() => window.location.reload(), 2000);
    }
  });
  
  rzp.open();
};
```

### 3. Remove Manual Activation
```javascript
// DELETE THIS - No longer needed
// POST /api/subscriptions/activate
```

## That's It!
Webhooks handle everything automatically. Just create orders with `user_id` and let Razorpay handle the rest.

**Security**: Only verified Razorpay webhooks can activate subscriptions - no way to fake it!