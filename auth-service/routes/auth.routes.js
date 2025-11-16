// routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Initial signup and mobile OTP request
router.post('/signup', authController.signup);

// Verify mobile OTP and send email OTP
router.post('/verify-mobile', authController.verifyMobile);

// Verify email OTP and set final password
router.post('/complete-signup', authController.completeSignup);

// User login and JWT generation
router.post('/login', authController.login);

module.exports = router;