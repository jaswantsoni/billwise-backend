const axios = require('axios');

exports.searchHSN = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Using HSN API - you can replace with actual HSN API
    const response = await axios.get(`https://api.mastergst.com/public/search?query=${encodeURIComponent(query)}`);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    // Fallback with common HSN codes if API fails
    const commonHSN = [
      { hsnCode: '8471', description: 'Computers and laptops', gstRate: 18 },
      { hsnCode: '8517', description: 'Mobile phones', gstRate: 18 },
      { hsnCode: '9405', description: 'Lamps and lighting fittings', gstRate: 18 },
      { hsnCode: '8539', description: 'LED lights and bulbs', gstRate: 12 },
      { hsnCode: '8544', description: 'Electrical wires and cables', gstRate: 18 },
      { hsnCode: '7308', description: 'Structures and parts of iron/steel', gstRate: 18 },
      { hsnCode: '3926', description: 'Plastic products', gstRate: 18 },
      { hsnCode: '6815', description: 'Stone or cement articles', gstRate: 28 },
      { hsnCode: '9403', description: 'Furniture', gstRate: 18 },
      { hsnCode: '4901', description: 'Printed books', gstRate: 0 }
    ];

    const filtered = commonHSN.filter(item => 
      item.description.toLowerCase().includes(req.query.query.toLowerCase())
    );

    res.json({
      success: true,
      data: filtered.length > 0 ? filtered : commonHSN.slice(0, 5)
    });
  }
};

exports.getHSNDetails = async (req, res) => {
  try {
    const { hsnCode } = req.params;

    // HSN to GST rate mapping (common rates)
    const hsnGSTMap = {
      '8471': { description: 'Computers and laptops', gstRate: 18 },
      '8517': { description: 'Mobile phones', gstRate: 18 },
      '9405': { description: 'Lamps and lighting fittings', gstRate: 18 },
      '8539': { description: 'LED lights and bulbs', gstRate: 12 },
      '8544': { description: 'Electrical wires and cables', gstRate: 18 },
      '7308': { description: 'Structures and parts of iron/steel', gstRate: 18 },
      '3926': { description: 'Plastic products', gstRate: 18 },
      '6815': { description: 'Stone or cement articles', gstRate: 28 },
      '9403': { description: 'Furniture', gstRate: 18 },
      '4901': { description: 'Printed books', gstRate: 0 },
      '83791': { description: 'Profile lights and fittings', gstRate: 18 }
    };

    const details = hsnGSTMap[hsnCode] || { description: 'Unknown', gstRate: 18 };

    res.json({
      success: true,
      data: {
        hsnCode,
        ...details
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch HSN details' });
  }
};
