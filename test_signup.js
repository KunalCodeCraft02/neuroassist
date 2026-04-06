const axios = require('axios');

// Test signup with sample data
const testData = {
    name: 'Test User',
    email: 'test-' + Date.now() + '@example.com',
    password: 'Test@12345678',
    state: 'Test State',
    district: 'Test District',
    companyname: 'Test Company'
};

console.log('Testing signup with data:', testData);

axios.post('http://localhost:3000/signup', testData)
    .then(response => {
        console.log('✅ Signup successful:', response.data);
    })
    .catch(error => {
        console.log('❌ Signup failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else if (error.request) {
            console.log('No response received:', error.request);
        } else {
            console.log('Error:', error.message);
        }
    });
