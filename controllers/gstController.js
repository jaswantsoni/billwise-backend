const axios = require('axios');

exports.getGSTDetails = async (req, res) => {
  try {
    const { gstin } = req.params;
    
    if (!gstin || gstin.length !== 15) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    const response = await axios.get(`https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${gstin}`);
    
    res.json({
      success: true,
      data: response.data
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
