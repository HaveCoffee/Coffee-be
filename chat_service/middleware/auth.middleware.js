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
        const userId = decoded[config.TOKEN_USER_ID_FIELD] || decoded.user_id || decoded.userId;

        if (!userId) {
            console.error('Token payload:', decoded);
            return res.status(401).json({ 
                message: 'Invalid Token: User ID missing from payload.',
                debug: { tokenPayload: decoded }
            });
        }
        
        req.user = { userId };
        const user = await User.findByPk(userId);
        
        if (!user) {
            console.error('User not found in chat_service database. userId:', userId);
            return res.status(404).json({ 
                message: 'User not found in database.',
                debug: { userId: userId }
            });
        }

        req.user.profile = user;
        next();
        
    } catch (error) {
        console.error('JWT Verification Error:', {
            name: error.name,
            message: error.message,
        });
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access Denied: Token has expired.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Access Denied: Invalid token signature.',
                hint: 'JWT_SECRET might not match between services. Check both .env files.'
            });
        }
        return res.status(500).json({ 
            message: 'Authentication process failed.',
            error: error.message
        });
    }
};

module.exports = verifyToken;