# Public PDF Endpoints - No Authentication Required

## Overview
Added simple public PDF endpoints that don't require authentication or signatures. These endpoints allow direct PDF downloads via simple URLs.

## Endpoints Added

### 1. Invoice PDF (Public)
**Endpoint:** `GET /api/invoices/{id}/pdf-public`
- **Authentication:** None required
- **Parameters:** 
  - `id` (path): Invoice ID
  - `template` (query, optional): Template name (default: 'classic')
- **Response:** PDF file (application/pdf)
- **Example:** `https://backend.kampony.com/api/invoices/inv_123/pdf-public`

### 2. Credit Note PDF (Public)
**Endpoint:** `GET /api/credit-notes/{id}/pdf-public`
- **Authentication:** None required
- **Parameters:**
  - `id` (path): Credit Note ID
- **Response:** PDF file (application/pdf)
- **Example:** `https://backend.kampony.com/api/credit-notes/cn_456/pdf-public`

### 3. Debit Note PDF (Public)
**Endpoint:** `GET /api/debit-notes/{id}/pdf-public`
- **Authentication:** None required
- **Parameters:**
  - `id` (path): Debit Note ID
- **Response:** PDF file (application/pdf)
- **Example:** `https://backend.kampony.com/api/debit-notes/dn_789/pdf-public`

## Files Modified

### 1. `/routes/invoice.js`
- Added route: `router.get('/:id/pdf-public', pdfController.getInvoicePDFPublic);`
- Route placed before `/:id` to ensure proper matching

### 2. `/routes/creditNote.js`
- Updated route from `/public-pdf` to `/pdf-public` for consistency
- Route: `router.get('/:id/pdf-public', creditNoteController.getCreditNotePDFPublic);`

### 3. `/routes/debitNote.js`
- Updated route from `/public-pdf` to `/pdf-public` for consistency
- Route: `router.get('/:id/pdf-public', debitNoteController.getDebitNotePDFPublic);`

### 4. `/controllers/productionPdfController.js`
- Updated `getInvoicePDFPublic` function to remove signature validation
- Now accepts any invoice ID and generates PDF without authentication
- Maintains same PDF generation logic as authenticated endpoint

## Implementation Details

### Invoice PDF Generation
```javascript
exports.getInvoicePDFPublic = async (req, res) => {
  // 1. Extract invoice ID from URL
  // 2. Fetch invoice data from database
  // 3. Fetch organisation and address data
  // 4. Generate merged 4-copy PDF
  // 5. Return PDF as binary with Content-Type: application/pdf
}
```

### Credit Note & Debit Note PDF Generation
- Already had public PDF methods implemented
- Simply updated route names for consistency
- No authentication required
- Generates PDF on-the-fly from stored data

## Security Considerations

⚠️ **Important:** These endpoints are public and don't require authentication. Consider:

1. **Rate Limiting:** Add rate limiting to prevent abuse
2. **Access Control:** If needed, implement IP whitelisting or API key validation
3. **Logging:** Log all public PDF requests for audit purposes
4. **Data Privacy:** Ensure sensitive data is not exposed in PDFs

## Usage in Mobile App

The Kampony Android app now uses these endpoints:

```typescript
// Invoice PDF
invoiceApi.pdfPublicUrl(invoiceId)
// Returns: https://backend.kampony.com/api/invoices/{id}/pdf-public

// Credit Note PDF
creditNoteApi.pdfPublicUrl(creditNoteId)
// Returns: https://backend.kampony.com/api/credit-notes/{id}/pdf-public

// Debit Note PDF
debitNoteApi.pdfPublicUrl(debitNoteId)
// Returns: https://backend.kampony.com/api/debit-notes/{id}/pdf-public
```

## Testing

### Test Invoice PDF
```bash
curl -X GET "https://backend.kampony.com/api/invoices/inv_123/pdf-public" \
  -H "Accept: application/pdf" \
  -o invoice.pdf
```

### Test Credit Note PDF
```bash
curl -X GET "https://backend.kampony.com/api/credit-notes/cn_456/pdf-public" \
  -H "Accept: application/pdf" \
  -o credit-note.pdf
```

### Test Debit Note PDF
```bash
curl -X GET "https://backend.kampony.com/api/debit-notes/dn_789/pdf-public" \
  -H "Accept: application/pdf" \
  -o debit-note.pdf
```

## Backward Compatibility

✅ All existing authenticated endpoints remain unchanged:
- `GET /api/invoices/:id/pdf` (requires auth)
- `GET /api/credit-notes/:id/pdf` (requires auth)
- `GET /api/debit-notes/:id/pdf` (requires auth)

## Benefits

✅ Simple direct URLs for PDF downloads
✅ No token management required
✅ Works reliably on Android devices
✅ Can be shared directly without authentication
✅ Backward compatible with existing authenticated endpoints
