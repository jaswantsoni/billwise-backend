# Subscription System Implementation

## Overview
Complete subscription management system with 15-day Premium trial for new users, free usage limits, and automated expiry handling.

## New User Registration Flow

### What Happens
When a user registers via `POST /auth/register`:
1. User account created with:
   - `planTier: 'premium'`
   - `planStatus: 'active'`
   - `planExpiry: <15 days from registration>`
   - `freeUsageCount: 0`
   - `freeUsageLimit: 10`
2. JWT token generated
3. Welcome email sent
4. User gets full Premium access for 15 days

### Registration Response
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "planTier": "premium",
    "planStatus": "active",
    "trialDays": 15
  }
}
```

## Plan Tiers

### Free (After Trial Expires)
- 10 free uses of Basic features
- 1 organisation/business
- After 10 uses, must upgrade to Basic

### Basic (₹149/month or ₹1,499/year)
- Unlimited invoice creation
- Customer & product management
- HSN/SAC codes
- GST calculation
- PDF download
- Basic reports

### Premium (₹399/month or ₹3,999/year)
- All Basic features
- E-Way Bill generation
- GST & HSN lookup
- Multiple businesses
- Advanced features

## Route Protection

### Premium Routes
```javascript
// Requires active Premium subscription
POST /api/eway/generate
GET /api/eway/:ewbNo
POST /api/eway/cancel/:ewbNo
GET /api/gst/:gstin
GET /api/hsn/search
POST /api/organisations (2nd onwards)
```

### Basic Routes
```javascript
// Requires Basic/Premium OR 10 free uses
POST /api/invoices
GET /api/invoices
POST /api/customers
POST /api/products
```

### Free Routes
```javascript
// First organisation is free for everyone
POST /api/organisations (first one only)
```

## Middleware

### requirePremium
- Checks: `planTier === 'premium'` AND `planStatus === 'active'` AND `planExpiry > now`
- Returns 403 if not met

### requireBasic
- Checks: `planTier in ['basic', 'premium']` AND `planStatus === 'active'`
- OR: Free user with `freeUsageCount < 10`
- Increments `freeUsageCount` for free users
- Returns 403 after 10 uses

## Automated Maintenance

### Cron Jobs (Runs Every Hour)

#### 1. Expire Subscriptions
```javascript
// Updates planStatus to 'expired' when planExpiry < now
checkExpiredSubscriptions()
```

#### 2. Send Expiry Reminders
```javascript
// Sends email 3 days before expiry
sendExpiryReminders()
```

### Email Notifications

#### Welcome Email
- Sent on registration
- Template: `welcome.html`

#### Expiry Reminder
- Sent 3 days before subscription expires
- Template: `subscriptionExpiring.html`
- Includes:
  - Days remaining
  - Expiry date
  - Renewal link
  - What happens after expiry

## Database Schema

### User Model
```prisma
model User {
  planTier       String?   @default("free")
  planInterval   String?
  planStatus     String?   @default("inactive")
  planExpiry     DateTime?
  freeUsageCount Int       @default(0)
  freeUsageLimit Int       @default(10)
}
```

### Subscription Model
```prisma
model Subscription {
  productCode   String
  tier          String
  interval      String
  amount        Float
  paymentId     String
  status        String   @default("active")
  startDate     DateTime @default(now())
  endDate       DateTime
}
```

## Payment Flow

### 1. Create Order (Payment Service - Port 4000)
```bash
POST http://localhost:4000/api/payment/subscription/create-order
Body: { productCode: "premium_monthly" }
```

### 2. User Pays via Razorpay
Frontend handles Razorpay checkout

### 3. Activate Subscription (Main Backend - Port 3000)
```bash
POST http://localhost:3000/api/subscriptions/activate
Body: {
  orderId: "order_xxx",
  paymentId: "pay_xxx",
  signature: "signature_xxx",
  productCode: "premium_monthly"
}
```

### 4. Backend Updates User
- Sets `planTier`, `planStatus`, `planExpiry`
- Creates Subscription record
- Returns updated user data

## Error Responses

### 403 - Upgrade Required
```json
{
  "error": "Premium plan required",
  "requiresUpgrade": true,
  "currentPlan": "free",
  "requiredPlan": "premium"
}
```

### 403 - Free Limit Exceeded
```json
{
  "error": "Basic plan required",
  "requiresUpgrade": true,
  "currentPlan": "free",
  "requiredPlan": "basic",
  "message": "Free trial limit of 10 uses exceeded"
}
```

## Testing

### Test New User Registration
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'
```

Expected: User created with Premium trial for 15 days

### Test Profile Endpoint
```bash
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected:
```json
{
  "plan": {
    "tier": "premium",
    "status": "active",
    "expiry": "2026-02-17T...",
    "isActive": true
  }
}
```

### Test Premium Feature
```bash
curl http://localhost:3000/api/gst/06ABFCS6642B1ZJ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: GST details (works during trial)

## Migration Steps

### For Existing Users
Run to add new fields:
```bash
npx prisma db push
```

This adds:
- `freeUsageCount` (default: 0)
- `freeUsageLimit` (default: 10)

### For Existing Deployments
1. Update code
2. Run `npx prisma generate`
3. Run `npx prisma db push`
4. Restart server
5. Cron jobs start automatically

## Environment Variables Required
```env
DATABASE_URL=mongodb://...
JWT_SECRET=your_secret
FRONTEND_URL=http://localhost:5173
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_password
```

## Logs to Monitor
```
[CHECK SUBSCRIPTION] User: xxx Plan: { planTier, planStatus, planExpiry }
[REQUIRE BASIC] Checking plan: { tier, status, expiry }
[REQUIRE BASIC] Free usage: { freeUsageCount, freeUsageLimit }
[CRON] Checking expired subscriptions...
[CRON] Sent X expiry reminders
```

## Summary
✅ 15-day Premium trial for new users
✅ 10 free uses after trial expires
✅ Route protection with middleware
✅ Automated expiry handling
✅ Email notifications 3 days before expiry
✅ First organisation free for everyone
✅ Subscription payment via Razorpay
✅ Complete error handling with upgrade prompts
