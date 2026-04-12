const prisma = require('../config/prisma');

/**
 * Get ledger entries for a customer or supplier within a date range.
 * Includes opening balance from transactions before fromDate.
 */
async function getLedger({ organisationId, partyId, partyType, fromDate, toDate }) {
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)) : null;

  const isCustomer = partyType === 'customer';

  // ─── Opening balance (all transactions before fromDate) ──────────
  let openingBalance = 0;
  if (from) {
    const beforeFilter = { lt: from };

    if (isCustomer) {
      const [prevInvoices, prevPayments] = await Promise.all([
        prisma.invoice.findMany({
          where: { organisationId, customerId: partyId, invoiceDate: beforeFilter },
          select: { total: true }
        }),
        prisma.payment.findMany({
          where: { organisationId, customerId: partyId, date: beforeFilter },
          select: { amount: true, type: true }
        }),
      ]);
      const debits = prevInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const credits = prevPayments.filter(p => p.type === 'RECEIVED').reduce((s, p) => s + p.amount, 0);
      openingBalance = debits - credits;
    } else {
      const [prevPurchases, prevPayments] = await Promise.all([
        prisma.purchase.findMany({
          where: { organisationId, supplierId: partyId, purchaseDate: beforeFilter },
          select: { grandTotal: true }
        }),
        prisma.payment.findMany({
          where: { organisationId, supplierId: partyId, date: beforeFilter },
          select: { amount: true, type: true }
        }),
      ]);
      const credits = prevPurchases.reduce((s, p) => s + (p.grandTotal || 0), 0);
      const debits = prevPayments.filter(p => p.type === 'PAID').reduce((s, p) => s + p.amount, 0);
      openingBalance = debits - credits;
    }
  }

  // ─── Date range filter ────────────────────────────────────────────
  const dateRange = {};
  if (from) dateRange.gte = from;
  if (to) dateRange.lte = to;

  // ─── Fetch transactions in range ──────────────────────────────────
  let entries = [];

  if (isCustomer) {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organisationId,
          customerId: partyId,
          status: { not: 'CANCELLED' },
          ...(Object.keys(dateRange).length && { invoiceDate: dateRange }),
        },
        select: { id: true, invoiceNumber: true, invoiceDate: true, total: true },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          organisationId,
          customerId: partyId,
          ...(Object.keys(dateRange).length && { date: dateRange }),
        },
        select: { id: true, reference: true, date: true, amount: true, type: true, method: true, notes: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    entries = [
      ...invoices.map(i => ({
        date: i.invoiceDate,
        type: 'INVOICE',
        referenceId: i.id,
        reference: i.invoiceNumber,
        debit: i.total || 0,
        credit: 0,
      })),
      ...payments.map(p => ({
        date: p.date,
        type: 'PAYMENT',
        referenceId: p.id,
        reference: p.reference || p.method || 'Payment',
        debit: 0,
        credit: p.type === 'RECEIVED' ? p.amount : 0,
        notes: p.notes,
      })),
    ];
  } else {
    const [purchases, payments] = await Promise.all([
      prisma.purchase.findMany({
        where: {
          organisationId,
          supplierId: partyId,
          status: { not: 'CANCELLED' },
          ...(Object.keys(dateRange).length && { purchaseDate: dateRange }),
        },
        select: { id: true, billNumber: true, invoiceNumber: true, purchaseDate: true, grandTotal: true },
        orderBy: { purchaseDate: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          organisationId,
          supplierId: partyId,
          ...(Object.keys(dateRange).length && { date: dateRange }),
        },
        select: { id: true, reference: true, date: true, amount: true, type: true, method: true, notes: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    entries = [
      ...purchases.map(p => ({
        date: p.purchaseDate,
        type: 'PURCHASE',
        referenceId: p.id,
        reference: p.invoiceNumber || p.billNumber,
        debit: 0,
        credit: p.grandTotal || 0,
      })),
      ...payments.map(p => ({
        date: p.date,
        type: 'PAYMENT',
        referenceId: p.id,
        reference: p.reference || p.method || 'Payment',
        debit: p.type === 'PAID' ? p.amount : 0,
        credit: 0,
        notes: p.notes,
      })),
    ];
  }

  // ─── Sort by date ASC, then by type (INVOICE/PURCHASE before PAYMENT same day) ──
  entries.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return diff;
    // Same date: invoices/purchases before payments
    const order = { INVOICE: 0, PURCHASE: 0, PAYMENT: 1 };
    return (order[a.type] || 0) - (order[b.type] || 0);
  });

  // ─── Running balance ──────────────────────────────────────────────
  let balance = openingBalance;
  const entriesWithBalance = entries.map(entry => {
    balance += (entry.debit || 0) - (entry.credit || 0);
    return { ...entry, runningBalance: parseFloat(balance.toFixed(2)) };
  });

  const closingBalance = parseFloat(balance.toFixed(2));

  return {
    openingBalance: parseFloat(openingBalance.toFixed(2)),
    closingBalance,
    entries: entriesWithBalance,
  };
}

module.exports = { getLedger };
