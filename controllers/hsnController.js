const axios = require('axios');
const prisma = require('../config/prisma');

exports.searchHSN = async (req, res) => {
  try {
    const { query, page = 1, size = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Using Clear.in HSN API
    const response = await axios.get(`https://api.clear.in/api/ingestion/config/hsn/v2/search`, {
      params: {
        hsnSearchKey: query,
        page: parseInt(page) - 1,
        size: parseInt(size)
      }
    });
    
    // Map and save results to DB
    const mappedResults = await Promise.all(response.data.results?.map(async (item) => {
      const hsnData = {
        hsnCode: item.hsnCode,
        type: item.type,
        description: item.taxDetails?.[0]?.description || item.description || '',
        gstRate: item.taxDetails?.[0]?.rateOfTax || null,
        effectiveDate: item.taxDetails?.[0]?.effectiveDate || null,
        chapterName: item.chapterName,
        chapterNumber: item.chapterNumber,
        taxDetails: item.taxDetails
      };

      // Save to DB (upsert)
      await prisma.hSNCode.upsert({
        where: { hsnCode: item.hsnCode },
        update: hsnData,
        create: hsnData
      }).catch(() => {}); // Ignore errors

      return {
        ...hsnData,
        allTaxDetails: item.taxDetails
      };
    }) || []);

    res.json({
      success: true,
      data: {
        results: mappedResults,
        totalResults: response.data.totalResults,
        hasMore: response.data.hasMore,
        page: parseInt(page),
        size: parseInt(size)
      }
    });
  } catch (error) {
    console.error('HSN search error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search HSN codes',
      details: error.message
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
