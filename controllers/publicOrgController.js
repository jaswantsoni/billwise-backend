const prisma = require('../config/prisma');

exports.getPublicOrgPage = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const org = await prisma.organisation.findUnique({
      where: { seoSlug: slug },
      select: {
        id: true,
        name: true,
        tradeName: true,
        city: true,
        state: true,
        email: true,
        phone: true,
        logo: true,
        showcaseConsent: true,
        showcaseTagline: true,
        seoSlug: true,
        products: {
          where: { isActive: true, showcaseConsent: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            taxRate: true,
            taxInclusive: true,
            unit: true,
            hsnCode: true,
            images: true,
            stockQuantity: true,
            brand: true,
            condition: true,
            googleCategory: true,
            mpn: true,
            gtin: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!org || !org.showcaseConsent) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    res.json({ success: true, data: org });
  } catch (error) {
    next(error);
  }
};

/** GET /public/org — list all orgs with showcase enabled (for sitemap) */
exports.listShowcaseOrgs = async (req, res, next) => {
  try {
    const orgs = await prisma.organisation.findMany({
      where: { showcaseConsent: true, seoSlug: { not: null } },
      select: { seoSlug: true, updatedAt: true },
    });
    res.json({ success: true, data: orgs });
  } catch (error) {
    next(error);
  }
};
