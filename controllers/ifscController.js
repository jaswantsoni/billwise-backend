const axios = require('axios');

exports.lookupIFSC = async (req, res, next) => {
  try {
    const { ifsc } = req.params;
    
    if (!ifsc || ifsc.length !== 11) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC code' });
    }

    const response = await axios.get(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ success: false, error: 'IFSC not found' });
    }
    next(error);
  }
};
