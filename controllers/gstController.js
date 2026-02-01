const axios = require('axios');
const prisma = require('../config/prisma');

exports.getGSTDetails = async (req, res) => {
  try {
    const { gstin } = req.params;
    
    if (!gstin || gstin.length !== 15) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    // Check in database first (organisations and customers)
    const existingOrg = await prisma.organisation.findFirst({
      where: { gstin }
    });

    if (existingOrg) {
      return res.json({
        success: true,
        data: {
          data: {
            gstin: existingOrg.gstin,
            lgnm: existingOrg.name,
            tradeNam: existingOrg.tradeName,
            pradr: {
              addr: {
                bnm: existingOrg.address,
                st: '',
                loc: existingOrg.city,
                dst: '',
                stcd: existingOrg.state,
                pncd: existingOrg.pincode
              }
            }
          },
          mappedAddress: {
            line1: existingOrg.address || '',
            line2: '',
            city: existingOrg.city || '',
            district: '',
            state: existingOrg.state || '',
            pincode: existingOrg.pincode || ''
          },
          mappedOrganisation: {
            name: existingOrg.name,
            tradeName: existingOrg.tradeName,
            gstin: existingOrg.gstin,
            pan: existingOrg.pan,
            address: existingOrg.address,
            city: existingOrg.city,
            state: existingOrg.state,
            stateCode: existingOrg.stateCode,
            pincode: existingOrg.pincode
          }
        }
      });
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: { gstin },
      include: { addresses: true }
    });

    if (existingCustomer) {
      const addr = existingCustomer.addresses[0] || {};
      return res.json({
        success: true,
        data: {
          data: {
            gstin: existingCustomer.gstin,
            lgnm: existingCustomer.name,
            tradeNam: existingCustomer.tradeName,
            pradr: {
              addr: {
                bnm: addr.line1,
                st: addr.line2,
                loc: addr.city,
                dst: '',
                stcd: addr.state,
                pncd: addr.pincode
              }
            }
          },
          mappedAddress: {
            line1: addr.line1 || '',
            line2: addr.line2 || '',
            city: addr.city || '',
            district: '',
            state: addr.state || '',
            pincode: addr.pincode || ''
          },
          mappedOrganisation: {
            name: existingCustomer.name,
            tradeName: existingCustomer.tradeName,
            gstin: existingCustomer.gstin,
            pan: existingCustomer.gstin?.substring(2, 12) || '',
            address: addr.line1 || '',
            city: addr.city || '',
            state: addr.state || '',
            stateCode: existingCustomer.gstin?.substring(0, 2) || '',
            pincode: addr.pincode || ''
          }
        }
      });
    }

    // If not in DB, fetch from API
    const response = await axios.get(`https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${gstin}`);
    
    // Map GST API response to our format
    const gstData = response.data?.data;
    const addr = gstData?.pradr?.addr || {};
    
    const mappedData = {
      ...response.data,
      mappedAddress: {
        line1: addr.bnm || '',
        line2: addr.st || '',
        city: addr.loc || '',
        district: addr.dst || '',
        state: addr.stcd || '',
        pincode: addr.pncd || ''
      },
      mappedOrganisation: {
        name: gstData?.tradeNam || gstData?.lgnm || '',
        tradeName: gstData?.tradeNam || '',
        gstin: gstData?.gstin || gstin,
        pan: gstin.substring(2, 12),
        address: addr.bnm || '',
        city: addr.loc || '',
        state: addr.stcd || '',
        stateCode: gstin.substring(0, 2),
        pincode: addr.pncd || ''
      }
    };
    
    res.json({
      success: true,
      source: '3pa',
      data: mappedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to fetch GST details'
    });
  }
};

exports.getCaptcha = async (req, res) => {
  try {
    const response = await axios.get(
      `https://services.gst.gov.in/services/captcha?rnd=${Math.random()}`,
      {
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://services.gst.gov.in/services/searchtp',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"'
        },
        responseType: 'arraybuffer',
        maxRedirects: 5,
        validateStatus: () => true
      }
    );
    
    const cookies = response.headers['set-cookie'] || [];
    
    // Extract only TS0134d082 cookie
    const tsCookie = cookies.find(c => c.startsWith('TS0134d082='));
    const cookieValue = tsCookie ? tsCookie.split(';')[0] : '';
    
    res.set('Content-Type', 'image/jpeg');
    res.set('X-GST-Cookie', cookieValue);
    res.send(response.data);
  } catch (error) {
    console.error('Captcha error:', error.message);
    res.status(500).json({ error: 'Failed to fetch captcha' });
  }
};

exports.verifyGSTIN = async (req, res) => {
  try {
    const { gstin, captcha} = req.body;
    
    if (!gstin || gstin.length !== 15) {
      return res.status(400).json({ success: false, error: 'Invalid GSTIN format' });
    }
    
    if (!captcha) {
      return res.status(400).json({ success: false, error: 'Captcha required' });
    }
    
    const response = await axios.post(
      'https://services.gst.gov.in/services/api/search/taxpayerDetails',
      { gstin, captcha },
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Content-Type': 'application/json;charset=UTF-8',
          'Origin': 'https://services.gst.gov.in',
          'Referer': 'https://services.gst.gov.in/services/searchtp',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
        },
        maxRedirects: 5,
        validateStatus: () => true
      }
    );
    
    if (response.data.errorCode) {
      return res.status(400).json({ 
        success: false, 
        error: response.data.message || 'Invalid captcha or GSTIN'
      });
    }
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(400).json({ 
      success: false, 
      error: error.response?.data?.message || 'Verification failed' 
    });
  }
};
