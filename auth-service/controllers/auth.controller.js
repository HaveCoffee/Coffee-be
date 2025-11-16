// controllers/auth.controller.js

require('dotenv').config();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const moment = require('moment');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || 6);

// --- Utilities for Sending OTPs ---

// Twilio Client Setup (Recommended for Production SMS)
// *Note: Using a dummy implementation for this example. Replace with actual Twilio logic.*
const twilioVerifyClient = {
    sendOTP: async (mobileNumber, otp) => {
        // Replace with actual Twilio Verify API call
        console.log(`[SMS] Sending Mobile OTP ${otp} to ${mobileNumber}`);
        return { success: true };
    }
};

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // Use true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmailOTP = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification OTP',
        html: `<p>Your Email Verification OTP is: <strong>${otp}</strong>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`
    };
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent Email OTP ${otp} to ${email}`);
};


// --- Controller Functions ---

// POST /api/auth/signup
exports.signup = async (req, res) => {
    const { email, mobileNumber } = req.body;

    if (!email || !mobileNumber) {
        return res.status(400).send({ message: "Email and Mobile Number are required." });
    }

    try {
        // 1. Check if user already exists
        const checkQuery = 'SELECT mobile_number, is_mobile_verified FROM auth.UserProfile WHERE mobile_number = $1 OR email = $2';
        const result = await db.query(checkQuery, [mobileNumber, email]);

        if (result.rows.length > 0) {
            if (result.rows[0].is_mobile_verified) {
                return res.status(409).send({ message: "Account already registered and verified. Please log in." });
            } else {
                // If not verified, proceed to overwrite or resend OTP
                console.log("Existing unverified user found. Resending OTP.");
            }
        }

        // 2. Generate Mobile OTP and Expiry
        const otpMobile = otpGenerator.generate(OTP_LENGTH, { upperCase: false, specialChars: false, digits: true, alphabets: false });
        const otpExpiry = moment().add(OTP_EXPIRY_MINUTES, 'minutes').toISOString();

        // 3. Send Mobile OTP (Twilio)
        const twilioResponse = await twilioVerifyClient.sendOTP(mobileNumber, otpMobile);
        if (!twilioResponse.success) {
             return res.status(500).send({ message: "Failed to send mobile verification code." });
        }

        // 4. Upsert/Insert User Record (Note: password_hash is null initially)
        const upsertQuery = `
            INSERT INTO auth.UserProfile (mobile_number, email, otp_mobile, otp_expiry, is_mobile_verified, is_email_verified)
            VALUES ($1, $2, $3, $4, FALSE, FALSE)
            ON CONFLICT (mobile_number)
            DO UPDATE SET email = $2, otp_mobile = $3, otp_expiry = $4, is_mobile_verified = FALSE, is_email_verified = FALSE, password_hash = NULL
            RETURNING *;
        `;
        await db.query(upsertQuery, [mobileNumber, email, otpMobile, otpExpiry]);

        res.status(200).send({
            message: "Mobile verification code sent. Please verify your mobile number."
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).send({ message: "Internal server error during signup." });
    }
};

// POST /api/auth/verify-mobile
exports.verifyMobile = async (req, res) => {
    const { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
        return res.status(400).send({ message: "Mobile number and OTP are required." });
    }

    try {
        // 1. Verify Mobile OTP and Check Expiry
        const userQuery = 'SELECT * FROM auth.UserProfile WHERE mobile_number = $1 AND otp_mobile = $2 AND otp_expiry > NOW()';
        const result = await db.query(userQuery, [mobileNumber, otp]);

        if (result.rows.length === 0) {
            return res.status(400).send({ message: "Mobile verification failed. Invalid or expired OTP." });
        }

        const user = result.rows[0];

        // 2. Generate Email OTP and Expiry
        const otpEmail = otpGenerator.generate(OTP_LENGTH, { upperCase: false, specialChars: false, digits: true, alphabets: false });
        const otpExpiry = moment().add(OTP_EXPIRY_MINUTES, 'minutes').toISOString();

        // 3. Send Email OTP (Nodemailer)
        await sendEmailOTP(user.email, otpEmail);

        // 4. Update Status in DB
        const updateQuery = `
            UPDATE auth.UserProfile SET
                is_mobile_verified = TRUE,
                otp_mobile = NULL,
                otp_email = $1,
                otp_expiry = $2
            WHERE mobile_number = $3
            RETURNING *;
        `;
        await db.query(updateQuery, [otpEmail, otpExpiry, mobileNumber]);

        res.status(200).send({
            message: "Mobile verified successfully. Email verification code sent to " + user.email
        });

    } catch (error) {
        console.error('Mobile verification error:', error);
        res.status(500).send({ message: "Internal server error during mobile verification." });
    }
};

// POST /api/auth/complete-signup
exports.completeSignup = async (req, res) => {
    const { mobileNumber, otp, password } = req.body;

    if (!mobileNumber || !otp || !password || password.length < 8) {
        return res.status(400).send({ message: "Mobile number, OTP, and a password (min 8 chars) are required." });
    }

    try {
        // 1. Verify Email OTP and Check Expiry
        const userQuery = 'SELECT * FROM auth.UserProfile WHERE mobile_number = $1 AND otp_email = $2 AND otp_expiry > NOW()';
        const result = await db.query(userQuery, [mobileNumber, otp]);

        if (result.rows.length === 0) {
            return res.status(400).send({ message: "Email verification failed. Invalid or expired OTP." });
        }

        // 2. Hash Password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 3. Finalize Account in DB
        const updateQuery = `
            UPDATE auth.UserProfile SET
                is_email_verified = TRUE,
                password_hash = $1,
                otp_email = NULL,
                otp_expiry = NULL
            WHERE mobile_number = $2 AND is_mobile_verified = TRUE
            RETURNING mobile_number, email;
        `;
        const finalResult = await db.query(updateQuery, [passwordHash, mobileNumber]);

        if (finalResult.rows.length === 0) {
             return res.status(500).send({ message: "Account finalization failed. Mobile not verified or other issue." });
        }

        res.status(201).send({
            message: "Account created and verified successfully. You can now log in.",
            user: finalResult.rows[0]
        });

    } catch (error) {
        console.error('Complete signup error:', error);
        res.status(500).send({ message: "Internal server error during final signup." });
    }
};


// POST /api/auth/login
exports.login = async (req, res) => {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
        return res.status(400).send({ message: "Mobile number and password are required." });
    }

    try {
        // 1. Fetch User Record
        const userQuery = `
            SELECT mobile_number, password_hash, is_mobile_verified, is_email_verified
            FROM auth.UserProfile
            WHERE mobile_number = $1;
        `;
        const result = await db.query(userQuery, [mobileNumber]);

        if (result.rows.length === 0) {
            return res.status(401).send({ message: "Authentication failed. Invalid mobile number or password." });
        }

        const user = result.rows[0];

        // 2. Check Verification Status
        if (!user.is_mobile_verified || !user.is_email_verified) {
             return res.status(403).send({ message: "Account is not fully verified. Please complete the verification process." });
        }

        // 3. Compare Password
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).send({ message: "Authentication failed. Invalid mobile number or password." });
        }

        // 4. Generate JWT
        const token = jwt.sign(
            { mobileNumber: user.mobile_number },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // Token expires in 24 hours
        );

        res.status(200).send({
            message: "Login successful.",
            accessToken: token,
            mobileNumber: user.mobile_number
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send({ message: "Internal server error during login." });
    }
};