/**
 * Telegram Bot for Kampony
 * Handles invoice creation, product lookup, customer management via chat
 */
const TelegramBot = require('node-telegram-bot-api');
const prisma = require('../config/prisma');
const { verifyLinkToken, getUserByTelegramId } = require('../controllers/telegramController');
const { generateDocumentNumber } = require('../utils/documentNumberGenerator');
const stockService = require('./stockService');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...a) => isDev && console.log('[TelegramBot]', ...a);

let bot;

// Conversation state per chat
const sessions = new Map();

const getSession = (chatId) => {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: 'idle', data: {} });
  return sessions.get(chatId);
};
const setSession = (chatId, update) => {
  const s = getSession(chatId);
  sessions.set(chatId, { ...s, ...update });
};
const clearSession = (chatId) => sessions.set(chatId, { step: 'idle', data: {} });

// Main menu keyboard
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

const cancelKeyboard = { reply_markup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true } };

async function getOrg(userId) {
  // Get the most recently updated org for this user
  return prisma.organisation.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
}

async function sendMainMenu(bot, chatId, text) {
  await bot.sendMessage(chatId, text, mainMenu);
}

function initBot(token) {
  bot = new TelegramBot(token, { polling: true });
  log('Bot started');

  // ─── /start ───────────────────────────────────────────────────────
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const param = match[1]?.trim();

    if (param) {
      // Deep link with token — link account
      const result = await verifyLinkToken(param, telegramId, msg.from.username);
      if (result.success) {
        await sendMainMenu(bot, chatId, `✅ Account linked!\n\nWelcome, *${result.user.name}*! You can now create invoices, manage products and customers right here.\n\nWhat would you like to do?`);
      } else {
        await bot.sendMessage(chatId, `❌ ${result.error}\n\nPlease generate a new link from the Kampony web app.`);
      }
      return;
    }

    // Check if already linked
    const user = await getUserByTelegramId(telegramId);
    if (user) {
      await sendMainMenu(bot, chatId, `👋 Welcome back, *${user.name}*!\n\nWhat would you like to do?`);
    } else {
      await bot.sendMessage(chatId, `👋 Welcome to *Kampony*!\n\nTo get started, link your account:\n1. Open Kampony web app\n2. Go to Profile → Connections → Telegram\n3. Click "Link Telegram"\n\nThen come back here and click the link.`, { parse_mode: 'Markdown' });
    }
  });

  // ─── Auth check middleware ────────────────────────────────────────
  const requireAuth = async (msg, cb) => {
    const user = await getUserByTelegramId(String(msg.from.id));
    if (!user) {
      await bot.sendMessage(msg.chat.id, '🔒 Please link your Kampony account first.\n\nGo to Profile → Connections → Telegram in the web app.');
      return;
    }
    await cb(user);
  };

  // ─── Message handler ──────────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    await requireAuth(msg, async (user) => {
      const session = getSession(chatId);

      // Cancel
      if (text === '❌ Cancel') {
        clearSession(chatId);
        await sendMainMenu(bot, chatId, 'Cancelled. What would you like to do?');
        return;
      }

      // Route based on step
      if (session.step !== 'idle') {
        await handleConversation(chatId, text, session, user);
        return;
      }

      // Main menu actions
      switch (text) {
        case '🧾 New Invoice': await startInvoice(chatId, user); break;
        case '📦 Products': await showProducts(chatId, user); break;
        case '👥 Customers': await showCustomers(chatId, user); break;
        case '📋 Recent Invoices': await showRecentInvoices(chatId, user); break;
        case '💰 Payments': await showPayments(chatId, user); break;
        case '❓ Help': await showHelp(chatId); break;
        default: await sendMainMenu(bot, chatId, 'Please choose an option from the menu below.'); break;
      }
    });
  });

  // ─── Callback queries (inline buttons) ───────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    await requireAuth(query.message, async (user) => {
      const session = getSession(chatId);

      if (data.startsWith('customer:')) {
        const customerId = data.replace('customer:', '');
        session.data.customerId = customerId;
        const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { addresses: true } });
        session.data.customerName = customer.name;
        session.data.billingAddressId = customer.addresses[0]?.id || null;
        setSession(chatId, { step: 'invoice_type', data: session.data });
        await bot.sendMessage(chatId, `Customer: *${customer.name}*\n\nSelect invoice type:`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: 'Tax Invoice', callback_data: 'invtype:TAX_INVOICE' }],
            [{ text: 'Bill of Supply', callback_data: 'invtype:BILL_OF_SUPPLY' }],
            [{ text: 'Proforma', callback_data: 'invtype:PROFORMA' }],
            [{ text: 'Delivery Challan', callback_data: 'invtype:DELIVERY_CHALLAN' }],
          ]}
        });
      }

      else if (data.startsWith('invtype:')) {
        session.data.invoiceType = data.replace('invtype:', '');
        session.data.items = [];
        setSession(chatId, { step: 'add_product', data: session.data });
        await promptAddProduct(chatId, user, session.data);
      }

      else if (data.startsWith('product:')) {
        const productId = data.replace('product:', '');
        const product = await prisma.product.findUnique({ where: { id: productId } });
        session.data.currentProduct = product;
        setSession(chatId, { step: 'enter_qty', data: session.data });
        await bot.sendMessage(chatId, `*${product.name}*\nPrice: ₹${product.price} | GST: ${product.taxRate}%\n\nEnter quantity:`, { parse_mode: 'Markdown', ...cancelKeyboard });
      }

      else if (data === 'done_items') {
        if (!session.data.items?.length) {
          await bot.sendMessage(chatId, '⚠️ Add at least one item first.');
          return;
        }
        await confirmInvoice(chatId, session.data, user);
      }

      else if (data === 'confirm_invoice') {
        await createInvoice(chatId, session.data, user);
      }

      else if (data === 'pdf_yes') {
        const invoiceId = session.data.createdInvoiceId;
        clearSession(chatId);
        await bot.sendMessage(chatId, '⏳ Generating PDF...');
        await sendInvoicePdf(chatId, invoiceId, user);
      }

      else if (data === 'pdf_no') {
        clearSession(chatId);
        await sendMainMenu(bot, chatId, '✅ Done! What would you like to do next?');
      }

      else if (data.startsWith('newcustomer:')) {
        const mode = data.replace('newcustomer:', '');
        setSession(chatId, { step: mode === 'gst' ? 'new_customer_gstin' : 'new_customer_name', data: session.data });
        if (mode === 'gst') {
          await bot.sendMessage(chatId, 'Enter the customer\'s GSTIN (15 characters):', cancelKeyboard);
        } else {
          await bot.sendMessage(chatId, 'Enter customer name:', cancelKeyboard);
        }
      }

      else if (data.startsWith('pdf_invoice:')) {
        const invoiceId = data.replace('pdf_invoice:', '');
        await bot.sendMessage(chatId, '⏳ Generating PDF...');
        await sendInvoicePdf(chatId, invoiceId, user);
      }
    });
  });

  return bot;
}

// ─── Invoice flow ─────────────────────────────────────────────────

async function startInvoice(chatId, user) {
  const org = await getOrg(user.id);
  if (!org) { await bot.sendMessage(chatId, '❌ No organisation found. Please set up your organisation on the web app.'); return; }

  setSession(chatId, { step: 'select_customer', data: { orgId: org.id, org } });

  const customers = await prisma.customer.findMany({ where: { organisationId: org.id }, take: 10, orderBy: { createdAt: 'desc' } });

  if (!customers.length) {
    await bot.sendMessage(chatId, 'No customers yet. Add one:', {
      reply_markup: { inline_keyboard: [
        [{ text: '🔍 Add by GSTIN', callback_data: 'newcustomer:gst' }],
        [{ text: '✏️ Add manually', callback_data: 'newcustomer:manual' }],
      ]}
    });
    return;
  }

  const buttons = customers.map(c => [{ text: c.name, callback_data: `customer:${c.id}` }]);
  buttons.push([{ text: '➕ New Customer (GSTIN)', callback_data: 'newcustomer:gst' }]);
  buttons.push([{ text: '➕ New Customer (Manual)', callback_data: 'newcustomer:manual' }]);

  await bot.sendMessage(chatId, '👥 Select or add a customer:', { reply_markup: { inline_keyboard: buttons } });
}

async function promptAddProduct(chatId, user, data) {
  const org = await getOrg(user.id);
  const products = await prisma.product.findMany({ where: { organisationId: org.id, isActive: true }, take: 10, orderBy: { createdAt: 'desc' } });

  const itemsSummary = data.items?.length
    ? `\n\n*Items added:*\n${data.items.map((i, n) => `${n+1}. ${i.name} × ${i.qty} = ₹${(i.qty * i.rate).toFixed(0)}`).join('\n')}`
    : '';

  const buttons = products.map(p => [{ text: `${p.name} — ₹${p.price}`, callback_data: `product:${p.id}` }]);
  if (data.items?.length) buttons.push([{ text: '✅ Done, create invoice', callback_data: 'done_items' }]);

  await bot.sendMessage(chatId, `📦 Select a product to add:${itemsSummary}`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

async function confirmInvoice(chatId, data, user) {
  const subtotal = data.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const tax = data.items.reduce((s, i) => s + (i.qty * i.rate * i.taxRate / 100), 0);
  const total = subtotal + tax;

  const summary = data.items.map((i, n) =>
    `${n+1}. ${i.name} × ${i.qty} @ ₹${i.rate} = ₹${(i.qty * i.rate).toFixed(0)}`
  ).join('\n');

  await bot.sendMessage(chatId,
    `📋 *Invoice Summary*\n\nCustomer: ${data.customerName}\nType: ${data.invoiceType?.replace('_', ' ')}\n\n${summary}\n\nSubtotal: ₹${subtotal.toFixed(2)}\nGST: ₹${tax.toFixed(2)}\n*Total: ₹${total.toFixed(2)}*\n\nConfirm?`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '✅ Create Invoice', callback_data: 'confirm_invoice' }],
        [{ text: '❌ Cancel', callback_data: 'cancel' }],
      ]}
    }
  );
}

async function createInvoice(chatId, data, user) {
  try {
    const org = data.org || await getOrg(user.id);
    const today = new Date().toISOString().split('T')[0];

    const prefix = org.invoicePrefix || 'INV';
    const counter = org.invoiceCounter || 1;
    const format = org.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}';
    const invoiceNumber = generateDocumentNumber(format, prefix, counter);

    await prisma.organisation.update({ where: { id: org.id }, data: { invoiceCounter: counter + 1 } });

    let subtotal = 0, totalTax = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
    const validatedItems = data.items.map(item => {
      const amount = item.qty * item.rate;
      const taxAmount = amount * item.taxRate / 100;
      subtotal += amount; totalTax += taxAmount;
      totalCGST += taxAmount / 2; totalSGST += taxAmount / 2;
      return {
        productId: item.productId,
        description: item.name,
        hsnSac: item.hsnSac || '',
        quantity: item.qty,
        unit: item.unit || 'PCS',
        rate: item.rate,
        discount: 0,
        taxRate: item.taxRate,
        taxInclusive: false,
        cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0,
        amount, taxAmount,
        costPrice: item.avgCost || 0,
        profit: (item.rate - (item.avgCost || 0)) * item.qty,
      };
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, invoiceType: data.invoiceType || 'TAX_INVOICE', invoiceCopyType: 'ORIGINAL',
        customerId: data.customerId,
        billingAddressId: data.billingAddressId,
        invoiceDate: new Date(today), dueDate: new Date(today),
        placeOfSupply: '', reverseCharge: false,
        subtotal, cgst: totalCGST, sgst: totalSGST, igst: 0,
        totalTax, total: subtotal + totalTax, balanceAmount: subtotal + totalTax,
        status: 'ISSUED', organisationId: org.id,
        items: { create: validatedItems }
      }
    });

    await stockService.updateStockOnSale(validatedItems, org.id, invoice.id).catch(() => {});

    setSession(chatId, { step: 'ask_pdf', data: { createdInvoiceId: invoice.id } });

    await bot.sendMessage(chatId,
      `✅ *Invoice Created!*\n\nInvoice No: \`${invoice.invoiceNumber}\`\nTotal: ₹${invoice.total.toFixed(2)}\n\nWould you like the PDF?`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '📄 Yes, send PDF', callback_data: 'pdf_yes' }],
          [{ text: '✅ No thanks', callback_data: 'pdf_no' }],
        ]}
      }
    );
  } catch (err) {
    console.error('[TelegramBot] Invoice creation error:', err.message);
    await bot.sendMessage(chatId, `❌ Failed to create invoice: ${err.message}`);
    clearSession(chatId);
  }
}

async function sendInvoicePdf(chatId, invoiceId, user) {
  try {
    const axios = require('axios');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

    const response = await axios.get(`${backendUrl}/api/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    await bot.sendDocument(chatId, Buffer.from(response.data), {}, {
      filename: `invoice-${invoiceId}.pdf`,
      contentType: 'application/pdf',
    });
    await sendMainMenu(bot, chatId, '✅ PDF sent! What would you like to do next?');
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Failed to generate PDF: ${err.message}`);
    await sendMainMenu(bot, chatId, 'What would you like to do next?');
  }
}

// ─── Conversation handler ─────────────────────────────────────────

async function handleConversation(chatId, text, session, user) {
  const { step, data } = session;

  if (step === 'enter_qty') {
    const qty = parseFloat(text);
    if (isNaN(qty) || qty <= 0) { await bot.sendMessage(chatId, 'Please enter a valid quantity:'); return; }
    const p = data.currentProduct;
    data.items = data.items || [];
    data.items.push({ productId: p.id, name: p.name, qty, rate: p.price, taxRate: p.taxRate, unit: p.unit, hsnSac: p.hsnCode || p.sacCode || '', avgCost: p.avgCost });
    delete data.currentProduct;
    setSession(chatId, { step: 'add_product', data });
    await promptAddProduct(chatId, user, data);
    return;
  }

  if (step === 'new_customer_gstin') {
    if (text.length !== 15) { await bot.sendMessage(chatId, 'GSTIN must be 15 characters. Try again:'); return; }
    await bot.sendMessage(chatId, '🔍 Looking up GSTIN...');
    try {
      const axios = require('axios');
      const resp = await axios.get(`https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${text.toUpperCase()}`);
      const gstData = resp.data?.data;
      const addr = gstData?.pradr?.addr || {};
      const org = await getOrg(user.id);
      const customer = await prisma.customer.create({
        data: {
          name: gstData?.tradeNam || gstData?.lgnm || text,
          gstin: text.toUpperCase(),
          organisationId: org.id,
          addresses: { create: [{ type: 'billing', line1: addr.bnm || '', city: addr.loc || '', state: addr.stcd || '', pincode: addr.pncd || '', country: 'India', isDefault: true, isShipping: false }] }
        },
        include: { addresses: true }
      });
      data.customerId = customer.id;
      data.customerName = customer.name;
      data.billingAddressId = customer.addresses[0]?.id || null;
      setSession(chatId, { step: 'invoice_type', data });
      await bot.sendMessage(chatId, `✅ Customer *${customer.name}* added!\n\nSelect invoice type:`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: 'Tax Invoice', callback_data: 'invtype:TAX_INVOICE' }],
          [{ text: 'Bill of Supply', callback_data: 'invtype:BILL_OF_SUPPLY' }],
          [{ text: 'Proforma', callback_data: 'invtype:PROFORMA' }],
          [{ text: 'Delivery Challan', callback_data: 'invtype:DELIVERY_CHALLAN' }],
        ]}
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ GST lookup failed. Enter customer name manually:`);
      setSession(chatId, { step: 'new_customer_name', data: { ...data, gstin: text.toUpperCase() } });
    }
    return;
  }

  if (step === 'new_customer_name') {
    const org = await getOrg(user.id);
    const customer = await prisma.customer.create({
      data: { name: text, gstin: data.gstin || null, organisationId: org.id, addresses: { create: [] } }
    });
    data.customerId = customer.id;
    data.customerName = customer.name;
    data.billingAddressId = null;
    setSession(chatId, { step: 'invoice_type', data });
    await bot.sendMessage(chatId, `✅ Customer *${text}* added!\n\nSelect invoice type:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: 'Tax Invoice', callback_data: 'invtype:TAX_INVOICE' }],
        [{ text: 'Bill of Supply', callback_data: 'invtype:BILL_OF_SUPPLY' }],
        [{ text: 'Proforma', callback_data: 'invtype:PROFORMA' }],
        [{ text: 'Delivery Challan', callback_data: 'invtype:DELIVERY_CHALLAN' }],
      ]}
    });
    return;
  }
}

// ─── Info commands ────────────────────────────────────────────────

async function showProducts(chatId, user) {
  const org = await getOrg(user.id);
  const products = await prisma.product.findMany({ where: { organisationId: org.id, isActive: true }, take: 15, orderBy: { name: 'asc' } });
  if (!products.length) { await bot.sendMessage(chatId, '📦 No products found. Add products on the web app.'); return; }
  const list = products.map(p => `• *${p.name}* — ₹${p.price} | Stock: ${p.stockQuantity} ${p.unit}`).join('\n');
  await bot.sendMessage(chatId, `📦 *Your Products*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showCustomers(chatId, user) {
  const org = await getOrg(user.id);
  const customers = await prisma.customer.findMany({ where: { organisationId: org.id }, take: 15, orderBy: { createdAt: 'desc' } });
  if (!customers.length) { await bot.sendMessage(chatId, '👥 No customers yet.'); return; }
  const list = customers.map(c => `• *${c.name}*${c.gstin ? ` — ${c.gstin}` : ''}${c.phone ? ` | ${c.phone}` : ''}`).join('\n');
  await bot.sendMessage(chatId, `👥 *Customers*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showRecentInvoices(chatId, user) {
  const org = await getOrg(user.id);
  const invoices = await prisma.invoice.findMany({
    where: { organisationId: org.id },
    include: { customer: true },
    orderBy: { invoiceDate: 'desc' },
    take: 8
  });
  if (!invoices.length) { await bot.sendMessage(chatId, '📋 No invoices yet.'); return; }

  const buttons = invoices.map(i => [{
    text: `${i.invoiceNumber} — ${i.customer?.name} — ₹${i.total.toFixed(0)} (${i.paymentStatus})`,
    callback_data: `pdf_invoice:${i.id}`
  }]);

  await bot.sendMessage(chatId, '📋 *Recent Invoices* (tap to get PDF):', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showPayments(chatId, user) {
  const org = await getOrg(user.id);
  const unpaid = await prisma.invoice.findMany({
    where: { organisationId: org.id, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
    take: 10
  });
  if (!unpaid.length) { await bot.sendMessage(chatId, '💰 No pending payments. All invoices are paid! 🎉', mainMenu); return; }
  const list = unpaid.map(i => `• *${i.invoiceNumber}* — ${i.customer?.name}\n  Balance: ₹${(i.balanceAmount || 0).toFixed(0)} | Due: ${i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : 'N/A'}`).join('\n\n');
  await bot.sendMessage(chatId, `💰 *Pending Payments*\n\n${list}`, { parse_mode: 'Markdown', ...mainMenu });
}

async function showHelp(chatId) {
  await bot.sendMessage(chatId,
    `❓ *Kampony Bot Help*\n\n` +
    `🧾 *New Invoice* — Create any type of invoice\n` +
    `📦 *Products* — View your product catalog\n` +
    `👥 *Customers* — View your customers\n` +
    `📋 *Recent Invoices* — View & download PDFs\n` +
    `💰 *Payments* — Track pending payments\n\n` +
    `During invoice creation:\n` +
    `• Add customers by GSTIN or manually\n` +
    `• Select products from your catalog\n` +
    `• Get PDF instantly after creation\n\n` +
    `Manage everything on *kampony.com*`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
}

module.exports = { initBot };
