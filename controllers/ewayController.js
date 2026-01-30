const axios = require('axios');

exports.generateEWayBill = async (req, res) => {
  try {
    const ewayData = req.body;

    const response = await axios.post(
      'https://api.mastergst.com/ewaybillapi/v1.03/ewayapi/genewaybill',
      ewayData,
      {
        headers: {
          'Content-Type': 'application/json',
          'username': process.env.EWAY_USERNAME,
          'password': process.env.EWAY_PASSWORD,
          'gstin': ewayData.userGstin,
          'requestid': Date.now().toString()
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to generate e-way bill'
    });
  }
};

exports.getEWayBill = async (req, res) => {
  try {
    const { ewbNo } = req.params;

    const response = await axios.get(
      `https://api.mastergst.com/ewaybillapi/v1.03/ewayapi/GetEwayBill?ewbNo=${ewbNo}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'username': process.env.EWAY_USERNAME,
          'password': process.env.EWAY_PASSWORD
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to fetch e-way bill'
    });
  }
};

exports.cancelEWayBill = async (req, res) => {
  try {
    const { ewbNo } = req.params;
    const { cancelRsnCode, cancelRmrk } = req.body;

    const response = await axios.post(
      'https://api.mastergst.com/ewaybillapi/v1.03/ewayapi/canewb',
      {
        ewbNo,
        cancelRsnCode,
        cancelRmrk
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'username': process.env.EWAY_USERNAME,
          'password': process.env.EWAY_PASSWORD
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to cancel e-way bill'
    });
  }
};
