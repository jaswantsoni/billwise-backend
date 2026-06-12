const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * API Key Authentication Middleware
 * Never-expiring tokens scoped to an organisation
 * Header: X-API-Key: <api_key>
 */
exports.apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Pass it as X-API-Key header.',
    });
  }

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: {
        organisation: true,
        user: {
          select: { id: true, email: true, name: true, planTier: true, planStatus: true },
        },
      },
    });

    if (!keyRecord) {
      return res.status(401).json({ success: false, error: 'Invalid API key.' });
    }

    if (!keyRecord.active) {
      return res.status(403).json({ success: false, error: 'API key is disabled.' });
    }

    // Attach to request — same shape as JWT auth
    req.user = keyRecord.user;
    req.userId = keyRecord.userId;
    req.organisation = keyRecord.organisation;
    req.organisationId = keyRecord.organisationId;
    req.apiKey = keyRecord;

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    next();
  } catch (error) {
    console.error('[API Key Auth]', error);
    return res.status(500).json({ success: false, error: 'Authentication error.' });
  }
};
