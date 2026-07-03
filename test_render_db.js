const axios = require('axios');
const token = 'YOUR_ADMIN_TOKEN_HERE'; // We don't have a token, so this might return 401

axios.get('https://staffivaa-backend.onrender.com/api/v1/workforce-requests/admin', {
  headers: {
    // If we can't authenticate, maybe we can't fetch. 
  }
}).then(res => console.log(res.data)).catch(err => console.log(err.message));
