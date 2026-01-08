const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 4000;
const API_BASE_URL = 'http://172.104.140.136';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Store session data
let sessionData = {
  cookies: '',
  csrfToken: '',
  isLoggedIn: false
};

// Helper function to make API requests
async function makeApiRequest(endpoint, method = 'GET', data = null, params = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': sessionData.cookies,
        'X-Frappe-CSRF-Token': sessionData.csrfToken
      },
      withCredentials: true,
      timeout: 10000
    };

    if (data) {
      config.data = data;
    }

    if (Object.keys(params).length > 0) {
      config.params = params;
    }

    console.log(`Making ${method} request to: ${endpoint}`);
    console.log('Headers:', config.headers);
    
    const response = await axios(config);
    
    // Extract cookies from response
    if (response.headers['set-cookie']) {
      sessionData.cookies = response.headers['set-cookie'].join('; ');
      console.log('Updated cookies:', sessionData.cookies);
    }

    // Extract CSRF token
    if (response.headers['x-frappe-csrf-token']) {
      sessionData.csrfToken = response.headers['x-frappe-csrf-token'];
      console.log('Updated CSRF token:', sessionData.csrfToken);
    }

    return {
      success: true,
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  } catch (error) {
    console.error('API Request Error:', error.message);
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500,
      data: error.response?.data || null
    };
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Make login request with form data
    const loginResponse = await axios.post(`${API_BASE_URL}/api/method/login`, 
      `usr=${username}&pwd=${password}`, 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        withCredentials: true
      }
    );

    // Extract cookies and CSRF token
    if (loginResponse.headers['set-cookie']) {
      sessionData.cookies = loginResponse.headers['set-cookie'].join('; ');
    }
    if (loginResponse.headers['x-frappe-csrf-token']) {
      sessionData.csrfToken = loginResponse.headers['x-frappe-csrf-token'];
    }

    sessionData.isLoggedIn = true;

    res.json({
      success: true,
      message: 'Login successful',
      data: loginResponse.data,
      cookies: sessionData.cookies,
      csrfToken: sessionData.csrfToken
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: error.response?.data
    });
  }
});

// Test all endpoints
app.get('/api/test-all', async (req, res) => {
  const results = {};
  
  // Test endpoints based on Postman collection
  const endpoints = [
    {
      name: 'Profile Details',
      method: 'GET',
      url: '/api/method/centro_pos_apis.api.profile.profile_details'
    },
    {
      name: 'POS Profile',
      method: 'GET',
      url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
    },
    {
      name: 'Customer List',
      method: 'GET',
      url: '/api/method/centro_pos_apis.api.customer.customer_list',
      params: { search_term: '', limit_start: 1, limit_page_length: 4 }
    },
    {
      name: 'Product List',
      method: 'GET',
      url: '/api/method/centro_pos_apis.api.product.product_list',
      params: { price_list: 'Standard Selling', search_text: '', limit_start: 1, limit_page_length: 4 }
    },
    {
      name: 'Price List',
      method: 'GET',
      url: '/api/resource/Price List',
      params: { filters: '[["selling","=","1"]]', limit_start: 0, limit_page_length: 2 }
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint.name}...`);
    const result = await makeApiRequest(endpoint.url, endpoint.method, null, endpoint.params);
    results[endpoint.name] = result;
  }

  res.json({
    success: true,
    sessionData,
    results
  });
});

// Individual endpoint test
app.get('/api/test/:endpoint', async (req, res) => {
  const { endpoint } = req.params;
  const { method = 'GET', params = {} } = req.query;
  
  let url = '';
  let requestParams = {};
  
  // Map endpoint names to actual URLs
  switch (endpoint) {
    case 'profile-details':
      url = '/api/method/centro_pos_apis.api.profile.profile_details';
      break;
    case 'pos-profile':
      url = '/api/method/centro_pos_apis.api.profile.get_pos_profile';
      break;
    case 'customer-list':
      url = '/api/method/centro_pos_apis.api.customer.customer_list';
      requestParams = { search_term: '', limit_start: 1, limit_page_length: 4 };
      break;
    case 'product-list':
      url = '/api/method/centro_pos_apis.api.product.product_list';
      requestParams = { price_list: 'Standard Selling', search_text: '', limit_start: 1, limit_page_length: 4 };
      break;
    case 'price-list':
      url = '/api/resource/Price List';
      requestParams = { filters: '[["selling","=","1"]]', limit_start: 0, limit_page_length: 2 };
      break;
    default:
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }

  const result = await makeApiRequest(url, method, null, requestParams);
  res.json(result);
});

// Logout
app.post('/api/logout', (req, res) => {
  sessionData = {
    cookies: '',
    csrfToken: '',
    isLoggedIn: false
  };
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get session status
app.get('/api/session', (req, res) => {
  res.json({
    success: true,
    sessionData
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Test Server running on http://localhost:${PORT}`);
  console.log(`📊 Test the endpoints at http://localhost:${PORT}`);
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
});
