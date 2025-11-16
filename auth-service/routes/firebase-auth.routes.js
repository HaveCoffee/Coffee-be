// routes/firebase-auth.routes.js

const express = require('express');
const router = express.Router();
const firebaseAuthController = require('../controllers/firebase-auth.controller');

// User signup
router.post('/signup', firebaseAuthController.signup);

// User login (verifies ID token from client)
router.post('/login', firebaseAuthController.login);

// Verify email
router.post('/verify-email', firebaseAuthController.verifyEmail);

// Reset password
router.post('/reset-password', firebaseAuthController.resetPassword);

// Refresh token
router.post('/refresh-token', firebaseAuthController.refreshToken);

// Get user info
router.get('/user', firebaseAuthController.getUser);

// Delete user
router.delete('/delete-user', firebaseAuthController.deleteUser);

// Protected route example (uses verifyToken middleware)
router.get('/protected', firebaseAuthController.verifyToken, (req, res) => {
    res.status(200).send({
        message: "This is a protected route.",
        user: req.user
    });
});

module.exports = router;
