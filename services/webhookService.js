const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Fire webhooks for a given event and organisation
 * @param {string} organisationId
 * @param {string} event  e.g. "invoice.created"
 * @param {object} payload
 */
async function fireWebhooks(organisationId, event, payload) {
  try {
    const hooks = await prisma.webhookConfig.findMany({
      where: {
        organisationId,
        active: true,
        events: { has: event },
      },
    });

    for (const hook of hooks) {
      deliverWebhook(hook, event, payload).catch(() => {});
    }
  } catch (e) {
    console.error('[Webhook] Error fetching hooks:', e.message);
  }
}

async function deliverWebhook(hook, event, payload, attempt = 1) {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

  let statusCode, responseBody, success = false;

  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kampony-Signature': `sha256=${sig}`,
        'X-Kampony-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    statusCode = res.status;
    responseBody = await res.text().catch(() => '');
    success = res.ok;

    if (!success && attempt < 3) {
      // Retry with exponential backoff: 30s, 5m
      const delay = attempt === 1 ? 30000 : 300000;
      setTimeout(() => deliverWebhook(hook, event, payload, attempt + 1), delay);
    }

    if (!success) {
      // Increment failure count, disable after 10 consecutive failures
      await prisma.webhookConfig.update({
        where: { id: hook.id },
        data: {
          failureCount: { increment: 1 },
          lastCalledAt: new Date(),
          active: hook.failureCount >= 9 ? false : undefined,
        },
      });
    } else {
      // Reset failure count on success
      await prisma.webhookConfig.update({
        where: { id: hook.id },
        data: { failureCount: 0, lastCalledAt: new Date() },
      });
    }
  } catch (e) {
    statusCode = 0;
    responseBody = e.message;
  }

  // Log delivery
  await prisma.webhookDelivery.create({
    data: {
      webhookConfigId: hook.id,
      event,
      payload,
      statusCode,
      responseBody,
      success,
      attempts: attempt,
    },
  }).catch(() => {});
}

module.exports = { fireWebhooks };
