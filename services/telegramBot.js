/**
 * Telegram Bot for Kampony — Full Invoice Creation Flow
 * Supports: all invoice types, customer add (GSTIN/manual with address),
 * delivery details, additional charges, payment details, notes, e-way bill, dates
 */
const TelegramBot = require('node-telegram-bot-api');
const prisma = require('../config/prisma');
const { verifyLinkToken, getUserByTelegramId } = require('../controllers/telegramController');
const { generateDocumentNumber } = require('../utils/documentNumberGenerator');
const stockService = require('./stockService');

let bot;
const sessions = new Map();

const getSession = (chatId) => {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: 'idle', data: {} });
  return sessions.get(chatId);
};
const setSession = (chatId, update) => sessions.set(chatId, { ...getSession(chatId), ...update });
const clearSession = (chatId) => sessions.set(chatId, { step: 'idle', data: {} });

const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: '🧾 New Invoice' }, { text: '📦 Products' }],
      [{ text: '👥 Customers' }, { text: '📋 Recent Invoices' }],
      [{ text: '💰 Payments' }, { text: '❓ Help' }],
    ],
    resize_keyboard: true,
  }
};

const skipKeyboard = (label) => ({
  reply_markup: {
    keyboard: [[{ text: `⏭ Skip ${label}` }, { text: '❌ Cancel' }]],
    resize_keyboard: true,
  }
});

const cancelKeyboard = { reply_markup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true } };

async function getOrg(userId) {
  return prisma.organisation.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
}

async function sendMainMenu(chatId, text) {
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainMenu });
}

// ─── Invoice type selection ───────────────────────────────────────
async function askInvoiceType(chatId, data) {
  setSession(chatId, { step: 'invoice_type', data });
  await bot.sendMessage(chatId, `Customer: *${data.customerName}*\n\nSelect invoice type:`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '🧾 Tax Invoice', callback_data: 'invtype:TAX_INVOICE' }],
      [{ text: '📄 Bill of Supply', callback_data: 'invtype:BILL_OF_SUPPLY' }],
      [{ text: '📋 Proforma', callback_data: 'invtype:PROFORMA' }],
      [{ text: '🚚 Delivery Challan', callback_data: 'invtype:DELIVERY_CHALLAN' }],
    ]}
  });
}

// ─── After items done — ask dates ────────────────────────────────
async function askDates(chatId, data) {
  const today = new Date().toISOString().split('T')[0];
  data.invoiceDate = today;
  data.dueDate = today;
  setSession(chatId, { step: 'ask_invoice_date', data });
  await bot.sendMessage(chatId,
    `📅 *Invoice Date*\n\nDefault: today (${today})\n\nEnter date (DD-MM-YYYY) or skip:`,
    { parse_mode: 'Markdown', ...skipKeyboard('(use today)') }
  );
}

// ─── Delivery mode ────────────────────────────────────────────────
async function askDeliveryMode(chatId, data) {
  setSession(chatId, { step: 'delivery_mode', data });
  await bot.sendMessage(chatId, '🚚 *Delivery Mode*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '🤝 In Hand', callback_data: 'delivery:IN_HAND' }],
      [{ text: '📦 Courier', callback_data: 'delivery:COURIER' }],
      [{ text: '🚛 Transport', callback_data: 'delivery:TRANSPORT' }],
      [{ text: '🏪 Self Pickup', callback_data: 'delivery:SELF_PICKUP' }],
      [{ text: '⏭ Skip', callback_data: 'delivery:SKIP' }],
    ]}
  });
}

// ─── Additional charges ───────────────────────────────────────────
async function askAdditionalCharges(chatId, data) {
  setSession(chatId, { step: 'ask_delivery_charges', data });
  await bot.sendMessage(chatId,
    '💸 *Additional Charges*\n\nEnter delivery charges (₹) or skip:',
    { parse_mode: 'Markdown', ...skipKeyboard('charges') }
  );
}

// ─── Payment details ──────────────────────────────────────────────
async function askPaymentMethod(chatId, data) {
  setSession(chatId, { step: 'payment_method', data });
  await bot.sendMessage(chatId, '💳 *Payment Method*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '💵 Cash', callback_data: 'pay:CASH' }, { text: '📱 UPI', callback_data: 'pay:UPI' }],
      [{ text: '🏦 NEFT', callback_data: 'pay:NEFT' }, { text: '📝 Cheque', callback_data: 'pay:CHEQUE' }],
      [{ text: '💳 Card', callback_data: 'pay:CARD' }, { text: '⏭ Skip', callback_data: 'pay:SKIP' }],
    ]}
  });
}

// ─── Notes ───────────────────────────────────────────────────────
async function askNotes(chatId, data) {
  setSession(chatId, { step: 'ask_notes', data });
  await bot.sendMessage(chatId, '📝 *Notes / Remarks*\n\nAdd any notes for this invoice or skip:', {
    parse_mode: 'Markdown', ...skipKeyboard('notes')
  });
}

// ─── E-Way Bill ───────────────────────────────────────────────────
async function askEwayBill(chatId, data) {
  setSession(chatId, { step: 'ask_eway', data });
  await bot.sendMessage(chatId, '🛣 *E-Way Bill Number*\n\nEnter E-Way Bill No or skip:', {
    parse_mode: 'Markdown', ...skipKeyboard('E-Way Bill')
  });
}

// ─── Confirm & create ─────────────────────────────────────────────
async function showConfirmation(chatId, data) {
  const subtotal = data.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const tax = data.items.reduce((s, i) => s + (i.qty * i.rate * i.taxRate / 100), 0);
  const extraCharges = (data.deliveryCharges || 0) + (data.freightCharges || 0) + (data.otherCharges || 0);
  const total = subtotal + tax + extraCharges;

  const itemList = data.items.map((i, n) =>
    `${n+1}. ${i.name} × ${i.qty} @ ₹${i.rate} = ₹${(i.qty * i.rate).toFixed(0)}`
  ).join('\n');

  let details = `📋 *Invoice Summary*\n\n`;
  details += `Customer: ${data.customerName}\n`;
  details += `Type: ${(data.invoiceType || 'TAX_INVOICE').replace(/_/g, ' ')}\n`;
  details += `Date: ${data.invoiceDate || 'Today'} | Due: ${data.dueDate || 'Today'}\n`;
  if (data.placeOfSupply) details += `Place of Supply: ${data.placeOfSupply}\n`;
  details += `\n*Items:*\n${itemList}\n\n`;
  details += `Subtotal: ₹${subtotal.toFixed(2)}\nGST: ₹${tax.toFixed(2)}`;
  if (extraCharges > 0) details += `\nCharges: ₹${extraCharges.toFixed(2)}`;
  details += `\n*Total: ₹${total.toFixed(2)}*`;
  if (data.modeOfDelivery && data.modeOfDelivery !== 'IN_HAND') details += `\nDelivery: ${data.modeOfDelivery}`;
  if (data.vehicleNumber) details += ` | Vehicle: ${data.vehicleNumber}`;
  if (data.ewayBillNumber) details += `\nE-Way Bill: ${data.ewayBillNumber}`;
  if (data.paymentMethod) details += `\nPayment: ${data.paymentMethod}`;
  if (data.notes) details += `\nNotes: ${data.notes}`;

  setSession(chatId, { step: 'confirm', data: { ...data, calculatedTotal: total } });
  await bot.sendMessage(chatId, details, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '✅ Create Invoice', callback_data: 'confirm_invoice' }],
      [{ text: '❌ Cancel', callback_data: 'cancel_invoice' }],
    ]}
  });
}

// ─── Create invoice in DB ─────────────────────────────────────────
async function createInvoice(chatId, data, user) {
  try {
    const org = data.org || await getOrg(user.id);
    const counterField = data.invoiceType === 'DELIVERY_CHALLAN' ? 'challanCounter' : 'invoiceCounter';
    const prefix = data.invoiceType === 'DELIVERY_CHALLAN' ? (org.challanPrefix || 'DC') : (org.invoicePrefix || 'INV');
    const counter = data.invoiceType === 'DELIVERY_CHALLAN' ? (org.challanCounter || 1) : (org.invoiceCounter || 1);
    const format = data.invoiceType === 'DELIVERY_CHALLAN' ? (org.challanFormat || '{PREFIX}/{YY}-{YY+1}/{###}') : (org.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}');
    const invoiceNumber = generateDocumentNumber(format, prefix, counter);
    await prisma.organisation.update({ where: { id: org.id }, data: { [counterField]: counter + 1 } });

    // Determine interstate
    const billingAddr = data.billingAddressId ? await prisma.address.findUnique({ where: { id: data.billingAddressId } }) : null;
    const orgState = org.state || '';
    const billState = billingAddr?.state || '';
    const isInterstate = orgState && billState && orgState !== billState;

    let subtotal = 0, totalTax = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
    const validatedItems = data.items.map(item => {
      const amount = item.qty * item.rate;
      const taxAmount = amount * item.taxRate / 100;
      subtotal += amount; totalTax += taxAmount;
      if (isInterstate) { totalIGST += taxAmount; }
      else { totalCGST += taxAmount / 2; totalSGST += taxAmount / 2; }
      return {
        productId: item.productId, description: item.name,
        hsnSac: item.hsnSac || '', quantity: item.qty, unit: item.unit || 'PCS',
        rate: item.rate, discount: 0, taxRate: item.taxRate, taxInclusive: false,
        cgst: isInterstate ? 0 : taxAmount / 2,
        sgst: isInterstate ? 0 : taxAmount / 2,
        igst: isInterstate ? taxAmount : 0,
        amount, taxAmount,
        costPrice: item.avgCost || 0,
        profit: (item.rate - (item.avgCost || 0)) * item.qty,
      };
    });

    const deliveryTax = (data.deliveryCharges || 0) * 0.18;
    const freightTax = (data.freightCharges || 0) * 0.18;
    const otherTax = (data.otherCharges || 0) * 0.18;
    const totalChargesTax = deliveryTax + freightTax + otherTax;
    totalTax += totalChargesTax;
    if (isInterstate) totalIGST += totalChargesTax;
    else { totalCGST += totalChargesTax / 2; totalSGST += totalChargesTax / 2; }

    const extraCharges = (data.deliveryCharges || 0) + (data.freightCharges || 0) + (data.otherCharges || 0);
    const total = subtotal + totalTax + extraCharges;

    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate.split('-').reverse().join('-')) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate.split('-').reverse().join('-')) : new Date();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, invoiceType: data.invoiceType || 'TAX_INVOICE', invoiceCopyType: 'ORIGINAL',
        customerId: data.customerId, billingAddressId: data.billingAddressId || null,
        shippingAddressId: data.billingAddressId || null,
        invoiceDate, dueDate,
        placeOfSupply: data.placeOfSupply || billState || '',
        reverseCharge: false,
        subtotal, cgst: totalCGST, sgst: totalSGST, igst: totalIGST,
        deliveryCharges: data.deliveryCharges || 0, deliveryChargesTax: deliveryTax,
        freightCharges: data.freightCharges || 0, freightChargesTax: freightTax,
        otherCharges: data.otherCharges || 0, otherChargesTax: otherTax,
        totalTax, total, balanceAmount: total,
        modeOfDelivery: data.modeOfDelivery || 'IN_HAND',
        vehicleNumber: data.vehicleNumber || null,
        transportName: data.transportName || null,
        lrNumber: data.lrNumber || null,
        ewayBillNumber: data.ewayBillNumber || null,
        placeOfDelivery: data.placeOfDelivery || null,
        paymentMethod: data.paymentMethod || null,
        paymentTerms: data.paymentTerms || 'NET_30',
        notes: data.notes || null,
        status: 'ISSUED', organisationId: org.id,
        items: { create: validatedItems }
      }
    });

    await stockService.updateStockOnSale(validatedItems, org.id, invoice.id).catch(() => {});

    setSession(chatId, { step: 'ask_pdf', data: { createdInvoiceId: invoice.id } });
    await bot.sendMessage(chatId,
      `✅ *Invoice Created!*\n\nNo: \`${invoice.invoiceNumber}\`\nTotal: ₹${invoice.total.toFixed(2)}\n\nSend PDF?`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '📄 Yes, send PDF', callback_data: 'pdf_yes' }],
          [{ text: '✅ No thanks', callback_data: 'pdf_no' }],
        ]}
      }
    );
  } catch (err) {
    console.error('[TelegramBot] Invoice error:', err.message);
    await bot.sendMessage(chatId, `❌ Failed: ${err.message}`);
    clearSession(chatId);
    await sendMainMenu(chatId, 'What would you like to do?');
  }
}

// ─── Send PDF ─────────────────────────────────────────────────────
async function sendInvoicePdf(chatId, invoiceId, user) {
  try {
    const axios = require('axios');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const response = await axios.get(`${backendUrl}/api/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer', timeout: 90000,
    });
    await bot.sendDocument(chatId, Buffer.from(response.data), {}, { filename: `invoice.pdf`, contentType: 'application/pdf' });
    await sendMainMenu(chatId, '✅ PDF sent!');
  } catch (err) {
    await bot.sendMessage(chatId, `❌ PDF failed: ${err.message}`);
    await sendMainMenu(chatId, 'What would you like to do?');
  }
}

// ─── Product prompt ───────────────────────────────────────────────
async function promptAddProduct(chatId, user, data) {
  const org = await getOrg(user.id);
  const products = await prisma.product.findMany({ where: { organisationId: org.id, isActive: true }, take: 10, orderBy: { name: 'asc' } });
  const itemsSummary = data.items?.length
    ? `\n\n*Added:*\n${data.items.map((i, n) => `${n+1}. ${i.name} × ${i.qty} = ₹${(i.qty * i.rate).toFixed(0)}`).join('\n')}`
    : '';
  const buttons = products.map(p => [{ text: `${p.name} — ₹${p.price}`, callback_data: `product:${p.id}` }]);
  if (data.items?.length) buttons.push([{ text: '✅ Done adding items', callback_data: 'done_items' }]);
  await bot.sendMessage(chatId, `📦 Select product:${itemsSummary}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

// ─── Customer selection ───────────────────────────────────────────
async function startInvoice(chatId, user) {
  const org = await getOrg(user.id);
  if (!org) { await bot.sendMessage(chatId, '❌ No organisation found.'); return; }
  setSession(chatId, { step: 'select_customer', data: { orgId: org.id, org } });
  const customers = await prisma.customer.findMany({ where: { organisationId: org.id }, take: 10, orderBy: { createdAt: 'desc' } });
  const buttons = customers.map(c => [{ text: c.name, callback_data: `customer:${c.id}` }]);
  buttons.push([{ text: '🔍 New by GSTIN', callback_data: 'newcustomer:gst' }, { text: '✏️ New Manual', callback_data: 'newcustomer:manual' }]);
  await bot.sendMessage(chatId, '👥 Select or add customer:', { reply_markup: { inline_keyboard: buttons } });
}

// ─── Info screens ─────────────────────────────────────────────────
async function showProducts(chatId, user) {
  const org = await getOrg(user.id);
  const products = await prisma.product.findMany({ where: { organisationId: org.id, isActive: true }, take: 15, orderBy: { name: 'asc' } });
  if (!products.length) { await sendMainMenu(chatId, '📦 No products found. Add on web app.'); return; }
  const list = products.map(p => `• *${p.name}* — ₹${p.price} | Stock: ${p.stockQuantity} ${p.unit}`).join('\n');
  await bot.sendMessage(chatId, `📦 *Products*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showCustomers(chatId, user) {
  const org = await getOrg(user.id);
  const customers = await prisma.customer.findMany({ where: { organisationId: org.id }, take: 15, orderBy: { createdAt: 'desc' } });
  if (!customers.length) { await sendMainMenu(chatId, '👥 No customers yet.'); return; }
  const list = customers.map(c => `• *${c.name}*${c.gstin ? ` — ${c.gstin}` : ''}${c.phone ? ` | ${c.phone}` : ''}`).join('\n');
  await bot.sendMessage(chatId, `👥 *Customers*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showRecentInvoices(chatId, user) {
  const org = await getOrg(user.id);
  const invoices = await prisma.invoice.findMany({ where: { organisationId: org.id }, include: { customer: true }, orderBy: { invoiceDate: 'desc' }, take: 8 });
  if (!invoices.length) { await sendMainMenu(chatId, '📋 No invoices yet.'); return; }
  const buttons = invoices.map(i => [{ text: `${i.invoiceNumber} — ${i.customer?.name} — ₹${i.total.toFixed(0)} (${i.paymentStatus})`, callback_data: `pdf_invoice:${i.id}` }]);
  await bot.sendMessage(chatId, '📋 *Recent Invoices* (tap for PDF):', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function showPayments(chatId, user) {
  const org = await getOrg(user.id);
  const unpaid = await prisma.invoice.findMany({ where: { organisationId: org.id, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } }, include: { customer: true }, orderBy: { dueDate: 'asc' }, take: 10 });
  if (!unpaid.length) { await sendMainMenu(chatId, '💰 All invoices paid! 🎉'); return; }
  const list = unpaid.map(i => `• *${i.invoiceNumber}* — ${i.customer?.name}\n  ₹${(i.balanceAmount || 0).toFixed(0)} due ${i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : ''}`).join('\n\n');
  await bot.sendMessage(chatId, `💰 *Pending Payments*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showHelp(chatId) {
  await bot.sendMessage(chatId,
    `❓ *Kampony Bot*\n\n🧾 New Invoice — full GST invoice with all details\n📦 Products — catalog\n👥 Customers — list\n📋 Recent Invoices — tap for PDF\n💰 Payments — pending dues\n\nInvoice includes:\n• Customer (GSTIN lookup or manual)\n• Invoice type & dates\n• Products with qty\n• Delivery mode & transport details\n• Additional charges\n• Payment method\n• Notes & E-Way Bill\n\nManage on *kampony.com*`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
}

// ─── Main bot init ────────────────────────────────────────────────
function initBot(token) {
  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1]?.trim();
    if (param) {
      const result = await verifyLinkToken(param, String(msg.from.id), msg.from.username);
      if (result.success) await sendMainMenu(chatId, `✅ Linked! Welcome *${result.user.name}*!`);
      else await bot.sendMessage(chatId, `❌ ${result.error}`);
      return;
    }
    const user = await getUserByTelegramId(String(msg.from.id));
    if (user) await sendMainMenu(chatId, `👋 Welcome back *${user.name}*!`);
    else await bot.sendMessage(chatId, `👋 Welcome to *Kampony*!\n\nLink your account:\n1. Open Kampony web app\n2. Profile → Connections → Telegram\n3. Click "Connect" and scan QR`, { parse_mode: 'Markdown' });
  });

  const requireAuth = async (msg, cb) => {
    const user = await getUserByTelegramId(String(msg.from.id));
    if (!user) { await bot.sendMessage(msg.chat.id, '🔒 Link your account first.\n\nProfile → Connections → Telegram on the web app.'); return; }
    await cb(user);
  };

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    await requireAuth(msg, async (user) => {
      const session = getSession(chatId);
      if (text === '❌ Cancel') { clearSession(chatId); await sendMainMenu(chatId, 'Cancelled.'); return; }
      if (session.step !== 'idle') { await handleConversation(chatId, text, session, user); return; }
      switch (text) {
        case '🧾 New Invoice': await startInvoice(chatId, user); break;
        case '📦 Products': await showProducts(chatId, user); break;
        case '👥 Customers': await showCustomers(chatId, user); break;
        case '📋 Recent Invoices': await showRecentInvoices(chatId, user); break;
        case '💰 Payments': await showPayments(chatId, user); break;
        case '❓ Help': await showHelp(chatId); break;
        default: await sendMainMenu(chatId, 'Choose from the menu below.');
      }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);
    const user = await getUserByTelegramId(String(query.from.id));
    if (!user) { await bot.sendMessage(chatId, '🔒 Link your account first.'); return; }
    const session = getSession(chatId);

    if (data.startsWith('customer:')) {
      const customerId = data.replace('customer:', '');
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { addresses: true } });
      session.data.customerId = customerId;
      session.data.customerName = customer.name;
      session.data.billingAddressId = customer.addresses[0]?.id || null;
      session.data.placeOfSupply = customer.addresses[0]?.state || '';
      await askInvoiceType(chatId, session.data);
    }
    else if (data.startsWith('invtype:')) {
      session.data.invoiceType = data.replace('invtype:', '');
      session.data.items = [];
      setSession(chatId, { step: 'add_product', data: session.data });
      await promptAddProduct(chatId, user, session.data);
    }
    else if (data.startsWith('product:')) {
      const product = await prisma.product.findUnique({ where: { id: data.replace('product:', '') } });
      session.data.currentProduct = product;
      setSession(chatId, { step: 'enter_qty', data: session.data });
      await bot.sendMessage(chatId, `*${product.name}*\n₹${product.price} | GST ${product.taxRate}%\n\nEnter quantity:`, { parse_mode: 'Markdown', ...cancelKeyboard });
    }
    else if (data === 'done_items') {
      if (!session.data.items?.length) { await bot.sendMessage(chatId, '⚠️ Add at least one item.'); return; }
      await askDates(chatId, session.data);
    }
    else if (data.startsWith('delivery:')) {
      const mode = data.replace('delivery:', '');
      if (mode !== 'SKIP') session.data.modeOfDelivery = mode;
      if (mode === 'TRANSPORT') {
        setSession(chatId, { step: 'ask_vehicle', data: session.data });
        await bot.sendMessage(chatId, '🚛 Enter vehicle number or skip:', skipKeyboard('vehicle'));
      } else {
        await askAdditionalCharges(chatId, session.data);
      }
    }
    else if (data.startsWith('pay:')) {
      const method = data.replace('pay:', '');
      if (method !== 'SKIP') session.data.paymentMethod = method;
      await askNotes(chatId, session.data);
    }
    else if (data === 'confirm_invoice') {
      await createInvoice(chatId, session.data, user);
    }
    else if (data === 'cancel_invoice') {
      clearSession(chatId);
      await sendMainMenu(chatId, 'Cancelled.');
    }
    else if (data === 'pdf_yes') {
      const invoiceId = session.data.createdInvoiceId;
      clearSession(chatId);
      await bot.sendMessage(chatId, '⏳ Generating PDF...');
      await sendInvoicePdf(chatId, invoiceId, user);
    }
    else if (data === 'pdf_no') {
      clearSession(chatId);
      await sendMainMenu(chatId, '✅ Done!');
    }
    else if (data.startsWith('newcustomer:')) {
      const mode = data.replace('newcustomer:', '');
      setSession(chatId, { step: mode === 'gst' ? 'new_customer_gstin' : 'new_customer_name', data: session.data });
      await bot.sendMessage(chatId, mode === 'gst' ? 'Enter GSTIN (15 chars):' : 'Enter customer name:', cancelKeyboard);
    }
    else if (data.startsWith('pdf_invoice:')) {
      await bot.sendMessage(chatId, '⏳ Generating PDF...');
      await sendInvoicePdf(chatId, data.replace('pdf_invoice:', ''), user);
    }
  });

  return bot;
}

// ─── Conversation steps ───────────────────────────────────────────
async function handleConversation(chatId, text, session, user) {
  const { step, data } = session;
  const isSkip = text.startsWith('⏭');

  if (step === 'enter_qty') {
    const qty = parseFloat(text);
    if (isNaN(qty) || qty <= 0) { await bot.sendMessage(chatId, 'Enter valid quantity:'); return; }
    const p = data.currentProduct;
    data.items = data.items || [];
    data.items.push({ productId: p.id, name: p.name, qty, rate: p.price, taxRate: p.taxRate, unit: p.unit, hsnSac: p.hsnCode || p.sacCode || '', avgCost: p.avgCost });
    delete data.currentProduct;
    setSession(chatId, { step: 'add_product', data });
    await promptAddProduct(chatId, user, data);
    return;
  }

  if (step === 'ask_invoice_date') {
    if (!isSkip) {
      // Parse DD-MM-YYYY
      const parts = text.split('-');
      if (parts.length === 3) data.invoiceDate = text;
    }
    setSession(chatId, { step: 'ask_due_date', data });
    await bot.sendMessage(chatId, `📅 *Due Date*\n\nDefault: today\nEnter date (DD-MM-YYYY) or skip:`, { parse_mode: 'Markdown', ...skipKeyboard('(use today)') });
    return;
  }

  if (step === 'ask_due_date') {
    if (!isSkip) {
      const parts = text.split('-');
      if (parts.length === 3) data.dueDate = text;
    }
    await askDeliveryMode(chatId, data);
    return;
  }

  if (step === 'ask_vehicle') {
    if (!isSkip) data.vehicleNumber = text;
    setSession(chatId, { step: 'ask_transport', data });
    await bot.sendMessage(chatId, '🚛 Transport name or skip:', skipKeyboard('transport'));
    return;
  }

  if (step === 'ask_transport') {
    if (!isSkip) data.transportName = text;
    setSession(chatId, { step: 'ask_lr', data });
    await bot.sendMessage(chatId, '📋 LR Number or skip:', skipKeyboard('LR'));
    return;
  }

  if (step === 'ask_lr') {
    if (!isSkip) data.lrNumber = text;
    await askAdditionalCharges(chatId, data);
    return;
  }

  if (step === 'ask_delivery_charges') {
    if (!isSkip) { const v = parseFloat(text); if (!isNaN(v)) data.deliveryCharges = v; }
    setSession(chatId, { step: 'ask_freight_charges', data });
    await bot.sendMessage(chatId, '💸 Freight charges (₹) or skip:', skipKeyboard('freight'));
    return;
  }

  if (step === 'ask_freight_charges') {
    if (!isSkip) { const v = parseFloat(text); if (!isNaN(v)) data.freightCharges = v; }
    setSession(chatId, { step: 'ask_other_charges', data });
    await bot.sendMessage(chatId, '💸 Other charges (₹) or skip:', skipKeyboard('other charges'));
    return;
  }

  if (step === 'ask_other_charges') {
    if (!isSkip) { const v = parseFloat(text); if (!isNaN(v)) data.otherCharges = v; }
    await askPaymentMethod(chatId, data);
    return;
  }

  if (step === 'ask_notes') {
    if (!isSkip) data.notes = text;
    await askEwayBill(chatId, data);
    return;
  }

  if (step === 'ask_eway') {
    if (!isSkip) data.ewayBillNumber = text;
    await showConfirmation(chatId, data);
    return;
  }

  if (step === 'new_customer_gstin') {
    if (text.length !== 15) { await bot.sendMessage(chatId, 'GSTIN must be 15 chars. Try again:'); return; }
    await bot.sendMessage(chatId, '🔍 Looking up...');
    try {
      const axios = require('axios');
      const resp = await axios.get(`https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${text.toUpperCase()}`);
      const gd = resp.data?.data;
      const addr = gd?.pradr?.addr || {};
      const org = await getOrg(user.id);
      const customer = await prisma.customer.create({
        data: {
          name: gd?.tradeNam || gd?.lgnm || text, gstin: text.toUpperCase(), organisationId: org.id,
          addresses: { create: [{ type: 'billing', line1: addr.bnm || '', city: addr.loc || '', state: addr.stcd || '', pincode: addr.pncd || '', country: 'India', isDefault: true, isShipping: false }] }
        },
        include: { addresses: true }
      });
      data.customerId = customer.id; data.customerName = customer.name;
      data.billingAddressId = customer.addresses[0]?.id || null;
      data.placeOfSupply = customer.addresses[0]?.state || '';
      await askInvoiceType(chatId, data);
    } catch (e) {
      await bot.sendMessage(chatId, '❌ GST lookup failed. Enter name manually:');
      setSession(chatId, { step: 'new_customer_name', data: { ...data, gstin: text.toUpperCase() } });
    }
    return;
  }

  if (step === 'new_customer_name') {
    const org = await getOrg(user.id);
    setSession(chatId, { step: 'new_customer_phone', data: { ...data, pendingName: text } });
    await bot.sendMessage(chatId, `Customer: *${text}*\n\nEnter phone number or skip:`, { parse_mode: 'Markdown', ...skipKeyboard('phone') });
    return;
  }

  if (step === 'new_customer_phone') {
    const org = await getOrg(user.id);
    const phone = isSkip ? null : text;
    setSession(chatId, { step: 'new_customer_address', data: { ...data, pendingPhone: phone } });
    await bot.sendMessage(chatId, 'Enter billing address (City, State) or skip:', skipKeyboard('address'));
    return;
  }

  if (step === 'new_customer_address') {
    const org = await getOrg(user.id);
    let city = '', state = '';
    if (!isSkip) {
      const parts = text.split(',').map(s => s.trim());
      city = parts[0] || ''; state = parts[1] || '';
    }
    const customer = await prisma.customer.create({
      data: {
        name: data.pendingName, gstin: data.gstin || null,
        phone: data.pendingPhone || null, organisationId: org.id,
        addresses: city ? { create: [{ type: 'billing', line1: '', city, state, pincode: '', country: 'India', isDefault: true, isShipping: false }] } : { create: [] }
      },
      include: { addresses: true }
    });
    data.customerId = customer.id; data.customerName = customer.name;
    data.billingAddressId = customer.addresses[0]?.id || null;
    data.placeOfSupply = state || '';
    delete data.pendingName; delete data.pendingPhone; delete data.gstin;
    await askInvoiceType(chatId, data);
    return;
  }
}

module.exports = { initBot };
