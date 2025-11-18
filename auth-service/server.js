const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '..', '.env')
});;

// Import Controller and Middleware
const authController = require('./controllers/auth.controller');
const verifyToken = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
app.use(cors());
app.use(bodyParser.json());

// --- ROUTES ---

// 1. Signup Routes
// POST: { "mobileNumber": "+1234567890" }
app.post('/api/auth/signup/init', authController.initiateSignup);

// POST: { "mobileNumber": "+1234567890", "otp": "123456", "password": "mypassword" }
app.post('/api/auth/signup/verify', authController.completeSignup);


// 2. Login Routes
// POST: { "mobileNumber": "+1234567890" }
app.post('/api/auth/login/init', authController.initiateLogin);

// POST: { "mobileNumber": "+1234567890", "otp": "123456", "password": "mypassword" }
app.post('/api/auth/login/verify', authController.completeLogin);


// 3. Protected Route Example
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});