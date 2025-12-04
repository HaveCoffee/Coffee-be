const jwt = require('jsonwebtoken');
const config = require('../config/config');  // Go up one level, then into config/config.js
const { User } = require('../models/db_models');  // Go up one level, then into models/db_models.js

/**
 * Middleware to verify JWT token from 'Authorization: Bearer <token>' header.
 * Attaches decoded user info (user_id) to req.user.
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access Denied: No token provided or malformed header.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);

        const userId = decoded[config.TOKEN_USER_ID_FIELD];

        if (!userId) {
            return res.status(401).json({ message: 'Invalid Token: User ID missing from payload.' });
        }
        req.user = { userId };

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found in database.' });
        }

        req.user.profile = user;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access Denied: Token has expired.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Access Denied: Invalid token signature.' });
        }
        console.error("JWT Verification Error:", error);
        return res.status(500).json({ message: 'Authentication process failed.' });
    }
};

module.exports = verifyToken;