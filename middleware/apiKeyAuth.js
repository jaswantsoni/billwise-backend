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

    req.user         = keyRecord.user;
    req.userId       = keyRecord.userId;
    req.organisation = keyRecord.organisation;
    req.organisationId = keyRecord.organisationId;
    req.apiKey       = keyRecord;
    req.permissions  = keyRecord.permissions || []; // [] = full access

    // Update last used (fire & forget)
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

/**
 * Permission check middleware factory
 * Usage: router.post('/products', apiKeyAuth, requirePermission('products:write'), handler)
 * Empty permissions array on key = full access
 */
exports.requirePermission = (permission) => (req, res, next) => {
  const perms = req.permissions || [];
  // Empty = full access
  if (perms.length === 0 || perms.includes(permission) || perms.includes('*')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: `This API key does not have the '${permission}' permission.`,
  });
};
