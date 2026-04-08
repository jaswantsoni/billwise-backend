const prisma = require('../config/prisma');
const axios = require('axios');

exports.createCustomer = async (req, res) => {
  try {
    const { name, gstin, email, phone, addresses, organisationId: requestedOrgId } = req.body;

    let organisationId;
    if (requestedOrgId) {
      const org = await prisma.organisation.findFirst({ where: { id: requestedOrgId, userId: req.userId } });
      if (!org) return res.status(403).json({ error: 'Organisation not found or access denied' });
      organisationId = org.id;
    } else {
      const orgs = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
      if (!orgs.length) return res.status(400).json({ error: 'No organisation found for user' });
      organisationId = orgs[0].id;
    }

    let gstData = null;
    if (gstin) {
      const response = await axios.get(`https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${gstin}`);
      gstData = response.data;
    }

    const addressData = addresses?.map(addr => ({
      type: addr.type || 'billing',
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country || 'India',
      isDefault: addr.isDefault || false,
      isShipping: addr.isShipping || false
    })) || (gstData ? [{
      type: 'billing',
      line1: gstData.data?.pradr?.addr?.bno || '',
      line2: gstData.data?.pradr?.addr?.st || '',
      city: gstData.data?.pradr?.addr?.loc || '',
      state: gstData.data?.pradr?.addr?.stcd || '',
      pincode: gstData.data?.pradr?.addr?.pncd || '',
      country: 'India',
      isDefault: true,
      isShipping: false
    }] : []);

    const customer = await prisma.customer.create({
      data: {
        name: name || gstData?.data?.lgnm,
        gstin,
        email: email || '',
        phone: phone || '',
        organisationId: organisationId,
        addresses: {
          create: addressData
        }
      },
      include: { addresses: true }
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Customer creation error:', error);
    res.status(500).json({ error: 'Failed to create customer', details: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { organisationId: organisations[0].id },
        include: { addresses: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customer.count({ where: { organisationId: organisations[0].id } })
    ]);

    res.json({ 
      success: true, 
      data: customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

exports.updateShippingAddress = async (req, res) => {
  try {
    const { customerId, addressId } = req.body;

    await prisma.address.updateMany({
      where: { customerId },
      data: { isShipping: false }
    });

    await prisma.address.update({
      where: { id: addressId },
      data: { isShipping: true }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shipping address' });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gstin, email, phone } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: { name, gstin, email, phone },
      include: { addresses: true }
    });

    res.json({ success: true, data: updatedCustomer });
  } catch (error) {
    console.error('Customer update error:', error);
    res.status(500).json({ error: 'Failed to update customer', details: error.message });
  }
};
