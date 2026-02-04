# Payment Service - Razorpay Integration

Standalone payment service for handling Razorpay payments.

## Setup

```bash
cd payment-service
npm install
```

## Configuration

Update `.env` file:
```
PORT=4000
RZP_KEY_ID=your_razorpay_key_id
RZP_KEY_SECRET=your_razorpay_key_secret
WEBHOOK_SECRET=your_webhook_secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

## Run

```bash
npm start
# or for development
npm run dev
```

## API Endpoints

### Create Order
```
POST /api/payment/create-order
Body: {
  "amount": 1000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": { "invoiceId": "inv_001" }
}
```

### Verify Payment
```
POST /api/payment/verify
Body: {
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

### Capture Payment
```
POST /api/payment/capture
Body: {
  "payment_id": "pay_xxx",
  "amount": 1000
}
```

### Refund Payment
```
POST /api/payment/refund
Body: {
  "payment_id": "pay_xxx",
  "amount": 500
}
```

### Get Payment Details
```
GET /api/payment/payment/:payment_id
```

### Get Order Details
```
GET /api/payment/order/:order_id
```

### Webhook
```
POST /api/payment/webhook
```

## Frontend Integration

```javascript
// Create order
const response = await fetch('http://localhost:4000/api/payment/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 1000,
    receipt: 'invoice_123',
    notes: { invoiceId: 'inv_001' }
  })
});

const { order, key_id } = await response.json();

// Initialize Razorpay
const options = {
  key: key_id,
  amount: order.amount * 100,
  currency: order.currency,
  order_id: order.id,
  handler: async function (response) {
    // Verify payment
    const verifyResponse = await fetch('http://localhost:4000/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });
    const result = await verifyResponse.json();
    console.log('Payment verified:', result);
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

## Deploy

Can be deployed separately on:
- Railway
- Render
- Heroku
- AWS Lambda
- Google Cloud Run
