// routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Signup Flow
router.post('/signup/initiate', authController.initiateSignup);
router.post('/signup/complete', authController.completeSignup);

// Login Flow
router.post('/login/initiate', authController.initiateLogin);
router.post('/login/complete', authController.completeLogin);

module.exports = router;