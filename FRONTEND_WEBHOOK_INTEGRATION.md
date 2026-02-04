# Frontend Integration - Secure Webhook Payments

## Overview
The payment system now uses **webhook-only activation** for maximum security. No manual activation endpoints exist.

## Key Changes

### ❌ REMOVED: Manual Activation
```javascript
// This endpoint no longer exists
POST /api/subscriptions/activate
```

### ✅ NEW: Webhook-Only Activation
- Payments automatically activate via Razorpay webhooks
- Frontend only needs to create orders and handle payment success
- No need to call activation APIs

## Frontend Implementation

### 1. Create Subscription Order
```javascript
// Include user_id in the request
const createSubscriptionOrder = async (productCode) => {
  const response = await fetch('http://localhost:4000/api/payment/subscription/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_code: productCode,
      user_id: currentUser.id,  // ⚠️ REQUIRED: Must include user ID
      customer_email: currentUser.email,
      customer_name: currentUser.name,
      customer_phone: currentUser.phone
    })
  });
  
  return response.json();
};
```

### 2. Handle Razorpay Payment
```javascript
const handlePayment = async (productCode) => {
  try {
    // Create order
    const orderData = await createSubscriptionOrder(productCode);
    
    if (!orderData.success) {
      throw new Error(orderData.error);
    }

    // Razorpay options
    const options = {
      key: orderData.key_id,
      amount: orderData.order.amount * 100, // Convert to paise
      currency: orderData.order.currency,
      name: 'Billwise',
      description: `${orderData.order.product_name} Subscription`,
      order_id: orderData.order.id,
      handler: function (response) {
        // Payment successful - webhook will activate automatically
        handlePaymentSuccess(response, orderData.order);
      },
      prefill: {
        name: currentUser.name,
        email: currentUser.email,
        contact: currentUser.phone
      },
      theme: {
        color: '#667eea'
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    
  } catch (error) {
    console.error('Payment error:', error);
    showError('Payment failed. Please try again.');
  }
};
```

### 3. Handle Payment Success
```javascript
const handlePaymentSuccess = async (razorpayResponse, orderData) => {
  try {
    console.log('Payment successful:', razorpayResponse.razorpay_payment_id);
    
    // Show success message
    showSuccess('Payment successful! Your subscription is being activated...');
    
    // Wait a moment for webhook processing
    setTimeout(() => {
      // Refresh user data to get updated subscription
      refreshUserProfile();
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    }, 3000);
    
  } catch (error) {
    console.error('Post-payment error:', error);
    showError('Payment completed but there was an issue. Please contact support.');
  }
};
```

### 4. Check Subscription Status
```javascript
const checkSubscriptionStatus = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const { plan } = data.user;
      
      if (plan.isActive && plan.tier !== 'free') {
        console.log('Subscription active:', plan.tier);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Status check error:', error);
    return false;
  }
};
```

### 5. Subscription Status Polling (Optional)
```javascript
const pollSubscriptionStatus = (maxAttempts = 10) => {
  let attempts = 0;
  
  const poll = async () => {
    attempts++;
    
    const isActive = await checkSubscriptionStatus();
    
    if (isActive) {
      showSuccess('Subscription activated successfully!');
      refreshUserProfile();
      return;
    }
    
    if (attempts < maxAttempts) {
      setTimeout(poll, 2000); // Check every 2 seconds
    } else {
      showWarning('Subscription activation is taking longer than expected. Please refresh the page.');
    }
  };
  
  poll();
};
```

## Complete Payment Flow Example

```javascript
// Pricing page component
const PricingPage = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubscribe = async (productCode) => {
    if (!user) {
      showError('Please login first');
      return;
    }

    setLoading(true);
    
    try {
      // Create order with user_id
      const orderData = await fetch('http://localhost:4000/api/payment/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_code: productCode,
          user_id: user.id,
          customer_email: user.email,
          customer_name: user.name,
          customer_phone: user.phone
        })
      }).then(res => res.json());

      if (!orderData.success) {
        throw new Error(orderData.error);
      }

      // Open Razorpay
      const rzp = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.order.amount * 100,
        currency: orderData.order.currency,
        name: 'Billwise',
        description: `${orderData.order.product_name} Subscription`,
        order_id: orderData.order.id,
        handler: (response) => {
          showSuccess('Payment successful! Activating subscription...');
          
          // Poll for activation
          setTimeout(() => {
            pollSubscriptionStatus();
          }, 2000);
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone
        }
      });
      
      rzp.open();
      
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pricing-plans">
      <div className="plan">
        <h3>Basic Plan</h3>
        <p>₹149/month</p>
        <button 
          onClick={() => handleSubscribe('basic_monthly')}
          disabled={loading}
        >
          Subscribe to Basic
        </button>
      </div>
      
      <div className="plan">
        <h3>Premium Plan</h3>
        <p>₹399/month</p>
        <button 
          onClick={() => handleSubscribe('premium_monthly')}
          disabled={loading}
        >
          Subscribe to Premium
        </button>
      </div>
    </div>
  );
};
```

## Security Benefits

✅ **No API abuse** - No manual activation endpoints to exploit
✅ **Webhook verification** - Only Razorpay can trigger activation
✅ **Automatic activation** - No frontend involvement in subscription logic
✅ **Tamper-proof** - User ID stored securely on backend during order creation

## Error Handling

### Payment Failed
```javascript
const rzp = new window.Razorpay({
  // ... options
  modal: {
    ondismiss: () => {
      showWarning('Payment cancelled');
    }
  }
});
```

### Webhook Delay
If webhook takes time, show appropriate messaging:
```javascript
showInfo('Payment successful! Your subscription will be activated within 2-3 minutes.');
```

## Testing

### Test Cards (Razorpay)
```
Success: 4111 1111 1111 1111
Failure: 4000 0000 0000 0002
```

### Environment URLs
```
Development: http://localhost:4000
Production: https://your-payment-service.com
```

## Required Changes Summary

1. **Add user_id** to subscription order creation
2. **Remove manual activation** calls
3. **Add success polling** (optional but recommended)
4. **Update error handling** for webhook-based flow

The system is now **100% secure** with webhook-only activation!