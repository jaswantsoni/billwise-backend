const prisma = require('../config/prisma');

exports.addAddress = async (req, res) => {
  try {
    const { customerId, type, line1, line2, city, state, pincode, country, isDefault, isShipping } = req.body;

    const address = await prisma.address.create({
      data: {
        customerId,
        type: type || 'billing',
        line1,
        line2: line2 || '',
        city,
        state,
        pincode,
        country: country || 'India',
        isDefault: isDefault || false,
        isShipping: isShipping || false
      }
    });

    res.json({ success: true, data: address });
  } catch (error) {
    console.error('Address creation error:', error);
    res.status(500).json({ error: 'Failed to add address', details: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const address = await prisma.address.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: address });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update address' });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.address.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const { customerId, addressId } = req.body;

    await prisma.address.updateMany({
      where: { customerId },
      data: { isDefault: false }
    });

    await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set default address' });
  }
};
