// controllers/firebase-auth.controller.js

require('dotenv').config();
const { auth } = require('../config/firebase.config');
const db = require('../db');

// POST /api/auth/firebase/signup
exports.signup = async (req, res) => {
    const { email, password, displayName, phoneNumber } = req.body;

    if (!email || !password) {
        return res.status(400).send({ message: "Email and password are required." });
    }

    if (password.length < 6) {
        return res.status(400).send({ message: "Password must be at least 6 characters." });
    }

    try {
        // 1. Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: displayName || null,
            phoneNumber: phoneNumber || null,
            emailVerified: false,
            disabled: false
        });

        // 2. Send email verification
        let link;
        try {
            link = await auth.generateEmailVerificationLink(email);
            console.log(`Email verification link: ${link}`);
        } catch (linkError) {
            console.error('Error generating verification link:', linkError);
            // Continue even if link generation fails
        }

        // 3. Optionally store user in your database
        try {
            if (phoneNumber) {
                const insertQuery = `
                    INSERT INTO auth.UserProfile (mobile_number, email, firebase_uid, is_mobile_verified, is_email_verified)
                    VALUES ($1, $2, $3, FALSE, FALSE)
                    ON CONFLICT (mobile_number)
                    DO UPDATE SET email = $2, firebase_uid = $3, is_mobile_verified = FALSE, is_email_verified = FALSE
                    RETURNING *;
                `;
                await db.query(insertQuery, [phoneNumber, email, userRecord.uid]);
            } else {
                const insertQuery = `
                    INSERT INTO auth.UserProfile (email, firebase_uid, is_email_verified)
                    VALUES ($1, $2, FALSE)
                    ON CONFLICT (email)
                    DO UPDATE SET firebase_uid = $2, is_email_verified = FALSE
                    RETURNING *;
                `;
                await db.query(insertQuery, [email, userRecord.uid]);
            }
        } catch (dbError) {
            console.error('Database error (user created in Firebase but not in DB):', dbError);
            // User is created in Firebase, so we continue
            // In production, you might want to handle this differently
        }

        res.status(201).send({
            message: "User created successfully. Please verify your email.",
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified
            },
            verificationLink: link || null
        });

    } catch (error) {
        console.error('Firebase signup error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
        
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).send({ message: "Email already exists. Please log in." });
        }
        if (error.code === 'auth/invalid-email') {
            return res.status(400).send({ message: "Invalid email format." });
        }
        if (error.code === 'auth/weak-password') {
            return res.status(400).send({ message: "Password is too weak." });
        }
        if (error.message && error.message.includes('Firebase not initialized')) {
            return res.status(500).send({ 
                message: "Firebase not configured. Please set up Firebase credentials.",
                error: error.message
            });
        }
        
        res.status(500).send({ 
            message: "Internal server error during signup.",
            error: error.message || 'Unknown error',
            code: error.code || 'unknown'
        });
    }
};

// POST /api/auth/firebase/login
// Note: This endpoint verifies the Firebase ID token sent from client
exports.login = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).send({ message: "ID token is required." });
    }

    try {
        // 1. Verify the Firebase ID token
        const decodedToken = await auth.verifyIdToken(idToken);
        
        // 2. Get user record
        const userRecord = await auth.getUser(decodedToken.uid);

        // 3. Optionally update database with latest info
        const updateQuery = `
            UPDATE auth.UserProfile 
            SET is_email_verified = $1, firebase_uid = $2
            WHERE email = $3 OR firebase_uid = $2
            RETURNING *;
        `;
        const result = await db.query(updateQuery, [
            userRecord.emailVerified,
            userRecord.uid,
            userRecord.email
        ]);

        // 4. Create custom session token (optional, if you want to use your own JWT)
        // For Firebase, you typically just return the verified token info
        res.status(200).send({
            message: "Login successful.",
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber
            },
            // You can return the original idToken or create a custom token
            idToken: idToken
        });

    } catch (error) {
        console.error('Firebase login error:', error);
        
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).send({ message: "Token expired. Please log in again." });
        }
        if (error.code === 'auth/id-token-revoked') {
            return res.status(401).send({ message: "Token revoked." });
        }
        if (error.code === 'auth/invalid-id-token') {
            return res.status(401).send({ message: "Invalid token." });
        }
        
        res.status(500).send({ message: "Internal server error during login." });
    }
};

// POST /api/auth/firebase/verify-email
exports.verifyEmail = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).send({ message: "ID token is required." });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const userRecord = await auth.getUser(decodedToken.uid);

        if (userRecord.emailVerified) {
            return res.status(200).send({ 
                message: "Email is already verified.",
                emailVerified: true 
            });
        }

        // Generate email verification link
        const link = await auth.generateEmailVerificationLink(userRecord.email);
        
        // In production, send this link via your email service
        console.log(`Email verification link: ${link}`);

        res.status(200).send({
            message: "Email verification link generated.",
            verificationLink: link // Send this via email in production
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send({ message: "Internal server error." });
    }
};

// POST /api/auth/firebase/reset-password
exports.resetPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send({ message: "Email is required." });
    }

    try {
        // Generate password reset link
        const link = await auth.generatePasswordResetLink(email);
        
        // In production, send this link via your email service
        console.log(`Password reset link: ${link}`);

        res.status(200).send({
            message: "Password reset link generated.",
            resetLink: link // Send this via email in production
        });

    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.code === 'auth/user-not-found') {
            return res.status(404).send({ message: "User not found." });
        }
        
        res.status(500).send({ message: "Internal server error." });
    }
};

// POST /api/auth/firebase/refresh-token
exports.refreshToken = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).send({ message: "ID token is required." });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken, true);
        
        // Get fresh user data
        const userRecord = await auth.getUser(decodedToken.uid);

        res.status(200).send({
            message: "Token refreshed successfully.",
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified,
                displayName: userRecord.displayName
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).send({ message: "Invalid or expired token." });
    }
};

// GET /api/auth/firebase/user
exports.getUser = async (req, res) => {
    const { idToken } = req.body;
    const uid = req.query.uid;

    if (!idToken && !uid) {
        return res.status(400).send({ message: "ID token or UID is required." });
    }

    try {
        let userRecord;
        
        if (idToken) {
            const decodedToken = await auth.verifyIdToken(idToken);
            userRecord = await auth.getUser(decodedToken.uid);
        } else {
            userRecord = await auth.getUser(uid);
        }

        res.status(200).send({
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                disabled: userRecord.disabled,
                metadata: {
                    creationTime: userRecord.metadata.creationTime,
                    lastSignInTime: userRecord.metadata.lastSignInTime
                }
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        
        if (error.code === 'auth/user-not-found') {
            return res.status(404).send({ message: "User not found." });
        }
        
        res.status(500).send({ message: "Internal server error." });
    }
};

// DELETE /api/auth/firebase/delete-user
exports.deleteUser = async (req, res) => {
    const { idToken, uid } = req.body;

    if (!idToken && !uid) {
        return res.status(400).send({ message: "ID token or UID is required." });
    }

    try {
        let targetUid;
        
        if (idToken) {
            const decodedToken = await auth.verifyIdToken(idToken);
            targetUid = decodedToken.uid;
        } else {
            targetUid = uid;
        }

        await auth.deleteUser(targetUid);

        // Optionally delete from your database
        const deleteQuery = 'DELETE FROM auth.UserProfile WHERE firebase_uid = $1';
        await db.query(deleteQuery, [targetUid]);

        res.status(200).send({
            message: "User deleted successfully."
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).send({ message: "Internal server error." });
    }
};

// Middleware to verify Firebase ID token
exports.verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ message: "Authorization header missing or invalid." });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        
        req.user = decodedToken;
        next();

    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).send({ message: "Invalid or expired token." });
    }
};
