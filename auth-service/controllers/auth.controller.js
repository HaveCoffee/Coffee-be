const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../db');
const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '..', '.env')
});

const BASE_URL = 'https://cpaas.messagecentral.com';
const isOtpVerificationEnabled = process.env.IS_OTP_VERIFICATION_ENABLED === 'true';

/**
 * UTILITY: Centralized API Logger
 */
const logInternalCall = (serviceName, method, url, params, response, error = null) => {
    const timestamp = new Date().toISOString();
    const status = error ? `ERROR (${error.response?.status || 'NETWORK'})` : `SUCCESS (${response?.status})`;

    console.log(`\n--- [${timestamp}] INTERNAL API CALL: ${serviceName} ---`);
    console.log(`URL: [${method}] ${url}`);
    console.log(`Params/Body:`, JSON.stringify(params, null, 2));

    if (error) {
        console.error(`Status: ${status}`);
        console.error(`Error Data:`, JSON.stringify(error.response?.data || error.message, null, 2));
    } else {
        console.log(`Status: ${status}`);
        console.log(`Response Data:`, JSON.stringify(response.data, null, 2));
    }
    console.log(`----------------------------------------------------------\n`);
};

/**
 * HELPER: Get VerifyNow Auth Token
 */
const getVerifyNowToken = async () => {
    const url = `${BASE_URL}/auth/v1/authentication/token`;
    const params = {
        customerId: process.env.MC_CUSTOMER_ID,
        key: process.env.MC_BASE64_PASSWORD,
        scope: 'NEW'
    };

    try {
        const response = await axios.get(url, { params });
        logInternalCall('GetToken', 'GET', url, params, response);

        const token = response.data?.token;
        if (!token) throw new Error('Authentication response did not contain a token.');
        return token;
    } catch (error) {
        logInternalCall('GetToken', 'GET', url, params, null, error);
        throw new Error(`Failed to authenticate with VerifyNow`);
    }
};

/**
 * HELPER: Send OTP via VerifyNow
 */
const sendOtpHelper = async (mobileNumber) => {
    if (!isOtpVerificationEnabled) {
        console.log(`[DEV MODE] Skipping OTP send for ${mobileNumber}.`);
        return { verificationId: 'MOCK_ID_12345' };
    }

    const url = `${BASE_URL}/verification/v3/send`;
    const token = await getVerifyNowToken();
    const params = {
        countryCode: '91',
        flowType: 'SMS',
        mobileNumber: mobileNumber,
        customerId: process.env.MC_CUSTOMER_ID
    };

    try {
        const response = await axios.post(url, null, {
            params,
            headers: { 'authToken': token }
        });
        logInternalCall('SendOTP', 'POST', url, params, response);

        if (!response.data?.data?.verificationId) {
            throw new Error(response.data?.message || "Failed to get verificationId");
        }
        return response.data.data;
    } catch (error) {
        logInternalCall('SendOTP', 'POST', url, params, null, error);
        throw error;
    }
};

/**
 * HELPER: Check OTP via VerifyNow
 */
const verifyOtpHelper = async (verificationId, code) => {
    if (!isOtpVerificationEnabled) {
        console.log(`[DEV MODE] Auto-verifying OTP: ${code}`);
        return true;
    }

    const url = `${BASE_URL}/verification/v3/validateOtp`;
    const token = await getVerifyNowToken();
    const params = { verificationId, code };

    try {
        const response = await axios.get(url, {
            params,
            headers: { 'authToken': token, 'accept': '*/*' }
        });
        logInternalCall('VerifyOTP', 'GET', url, params, response);

        if (response.data && response.data.responseCode === 200) {
            return response.data.data.verificationStatus === 'VERIFICATION_COMPLETED';
        }
        return false;
    } catch (error) {
        logInternalCall('VerifyOTP', 'GET', url, params, null, error);
        throw error;
    }
};

// --- AUTH CONTROLLER METHODS ---

exports.initiateSignup = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        const userCheck = await db.query('SELECT user_id FROM Users WHERE mobile_number = $1', [mobileNumber]);
        if (userCheck.rows.length > 0) return res.status(409).json({ message: 'User already exists.' });

        const verifyData = await sendOtpHelper(mobileNumber);
        res.status(200).json({
            message: isOtpVerificationEnabled ? 'OTP sent successfully.' : 'Dev mode: OTP bypassed.',
            verificationId: verifyData.verificationId
         });
    } catch (error) {
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
};

exports.completeSignup = async (req, res) => {
    const { mobileNumber, otp, verificationId } = req.body;
    try {
        const isOtpValid = await verifyOtpHelper(verificationId, otp);
        if (!isOtpValid) return res.status(400).json({ message: 'Invalid or expired OTP.' });

        let userId = crypto.randomBytes(16).toString('hex');

        // UPDATED: Using "createdAt" and "updatedAt" as per final schema
        const now = new Date();
        const result = await db.query(
            `INSERT INTO users (user_id, mobile_number, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $3)
             RETURNING user_id, mobile_number, "createdAt", "updatedAt"`,
            [userId, mobileNumber, now]
        );

        res.status(201).json({
            message: 'User onboarded',
            user: result.rows[0] // contains userId, mobile_number, createdAt, updatedAt
        });
    } catch (error) {
        res.status(500).json({ message: 'Signup failed', error: error.message });
    }
};

exports.initiateLogin = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        const userCheck = await db.query('SELECT user_id FROM Users WHERE mobile_number = $1', [mobileNumber]);
        if (userCheck.rows.length === 0) return res.status(404).json({ message: 'User not found.' });

        const verifyData = await sendOtpHelper(mobileNumber);
        res.status(200).json({
            message: isOtpVerificationEnabled ? 'OTP sent.' : 'Dev mode: OTP bypassed.',
            verificationId: verifyData.verificationId
        });
    } catch (error) {
        res.status(500).json({ message: 'Error initiating login' });
    }
};

exports.completeLogin = async (req, res) => {
     const { mobileNumber, otp, verificationId } = req.body;
     try {
         const isOtpValid = await verifyOtpHelper(verificationId, otp);
         if (!isOtpValid) return res.status(400).json({ message: 'Invalid OTP.' });

         // UPDATED: Standardizing on "updatedAt" naming
         const updateResult = await db.query(
             `UPDATE users
              SET "updatedAt" = NOW()
              WHERE mobile_number = $1
              RETURNING user_id, mobile_number, "createdAt", "updatedAt"`,
             [mobileNumber]
         );

         const user = updateResult.rows[0];

         const token = jwt.sign(
             { userId: user.user_id },
             process.env.JWT_SECRET,
             { expiresIn: '48h' }
         );

         res.status(200).json({
             message: 'Logged in',
             token,
             user: {
                 userId: user.user_id,
                 createdAt: user.createdAt,
                 updatedAt: user.updatedAt
             }
         });
     } catch (error) {
         res.status(500).json({ message: 'Login failed', error: error.message });
     }
 };