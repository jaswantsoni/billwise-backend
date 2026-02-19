# Email API Endpoints

## Base URL: `/api/email`

All endpoints require authentication via Bearer token.

---

## 1. POST `/api/email/draft`

**Purpose:** Save email as draft before sending

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "to": "customer@mail.com",
  "subject": "Invoice #1021",
  "template_id": "optional-template-id",
  "variables": {
    "customer_name": "Rahul",
    "invoice_no": "1021",
    "amount": "5500"
  },
  "html": "optional-custom-html"
}
```

**Response:**
```json
{
  "success": true,
  "draft": {
    "id": "draft-id",
    "toEmail": "customer@mail.com",
    "subject": "Invoice #1021",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 2. POST `/api/email/send`

**Purpose:** Send email from existing draft

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "draft_id": "draft-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

**Error Response:**
```json
{
  "error": "Failed to send email",
  "details": "Gmail not connected"
}
```

---

## 3. POST `/api/email/send-direct`

**Purpose:** Send email directly without creating draft first

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "to": "customer@mail.com",
  "subject": "Invoice #1021",
  "template_id": "optional-template-id",
  "variables": {
    "customer_name": "Rahul",
    "invoice_no": "1021",
    "amount": "5500"
  },
  "html": "optional-custom-html"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "logId": "log-id"
}
```

---

## 4. GET `/api/email/read`

**Purpose:** Fetch email logs with filters

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `sent`, `failed`)
- `template_id` (optional): Filter by template ID
- `limit` (optional, default: 50): Number of records to fetch
- `skip` (optional, default: 0): Number of records to skip

**Examples:**
```
GET /api/email/read
GET /api/email/read?status=sent
GET /api/email/read?status=failed
GET /api/email/read?template_id=template-id
GET /api/email/read?limit=20&skip=0
```

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "log-id",
      "toEmail": "customer@mail.com",
      "subject": "Invoice #1021",
      "status": "sent",
      "gmailMessageId": "gmail-message-id",
      "sentAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "skip": 0
}
```

---

## Email Log Statuses

- `draft` - Email saved but not sent
- `sending` - Email is being sent
- `sent` - Email sent successfully
- `failed` - Email sending failed

---

## Template Variables

Common variables used in templates:

**Invoice:**
- `customer_name`, `company_name`, `invoice_no`, `invoice_date`, `due_date`, `amount`, `invoice_link`

**Payment Received:**
- `customer_name`, `company_name`, `invoice_no`, `payment_date`, `payment_method`, `amount`, `receipt_link`

**Reminder:**
- `customer_name`, `company_name`, `invoice_no`, `invoice_date`, `due_date`, `amount`, `overdue_status`, `payment_link`, `invoice_link`

**Credit Note:**
- `customer_name`, `company_name`, `credit_note_no`, `invoice_no`, `credit_note_date`, `reason`, `amount`, `credit_note_link`

**Purchase Order:**
- `vendor_name`, `company_name`, `po_no`, `po_date`, `delivery_date`, `delivery_address`, `amount`, `po_link`
