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
const isOtpVerificationEnabled = process.env.IS_OTP_VERIFICATION_ENABLED === 'false';

/**
 * HELPER: Get VerifyNow Auth Token
 * Retrieves the flat token structure: { "status": 200, "token": "..." }
 */
const getVerifyNowToken = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/auth/v1/authentication/token`, {
            params: {
                customerId: process.env.MC_CUSTOMER_ID,
                key: process.env.MC_BASE64_PASSWORD,
                scope: 'NEW'
            }
        });

        const token = response.data?.token; // Flat structure

        if (!token) {
            throw new Error('Authentication response did not contain a token.');
        }

        return token;
    } catch (error) {
        console.error('VerifyNow Auth Error:', error.response?.data || error.message);
        throw new Error(`Failed to authenticate with VerifyNow`);
    }
};

/**
 * HELPER: Send OTP via VerifyNow
 */
const sendOtpHelper = async (mobileNumber) => {

    if (!isOtpVerificationEnabled) {
            console.log(`[DEV MODE] Skipping OTP send for ${mobileNumber}. Returning mock verificationId.`);
            return { verificationId: 'MOCK_ID_12345' };
        }

    const token = await getVerifyNowToken();

    const response = await axios.post(`${BASE_URL}/verification/v3/send`, null, {
        params: {
            countryCode: '91',
            flowType: 'SMS',
            mobileNumber: mobileNumber,
            customerId: process.env.MC_CUSTOMER_ID
        },
        headers: { 'authToken': token }
    });

    if (!response.data?.data?.verificationId) {
        throw new Error(response.data?.message || "Failed to get verificationId");
    }

    return response.data.data;
};

/**
 * HELPER: Check OTP via VerifyNow
 */
const verifyOtpHelper = async (verificationId, code) => {

    if (!isOtpVerificationEnabled) {
            console.log(`[DEV MODE] Auto-verifying OTP: ${code} for ID: ${verificationId}`);
            return true;
        }

    try {
        const token = await getVerifyNowToken();
        const url = `${BASE_URL}/verification/v3/validateOtp`;

        // Correct Axios GET signature: axios.get(url, config)
        const response = await axios.get(url, {
            params: {
                verificationId: verificationId,
                code: code
            },
            headers: {
                'authToken': token,
                'accept': '*/*'
            }
        });

        console.log('Verification Response Data:', response.data);

        // Message Central V3 success check
        if (response.data && response.data.responseCode === 200) {
            return response.data.data.verificationStatus === 'VERIFICATION_COMPLETED';
        }

        return false;
    } catch (error) {
        console.error('Verify OTP API Error Details:', {
            status: error.response?.status,
            data: error.response?.data
//            requestedUrl: error.config?.url + '?' + new URLSearchParams(error.config?.params).toString()
        });
        throw error;
    }
};

// --- AUTH CONTROLLER METHODS ---

exports.initiateSignup = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        const userCheck = await db.query('SELECT user_id FROM Users WHERE mobile_number = $1', [mobileNumber]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ message: 'User already exists.' });
        }
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
        if (!isOtpValid) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        let userId = crypto.randomBytes(16).toString('hex');
        const result = await db.query(
            'INSERT INTO Users (user_id, mobile_number) VALUES ($1, $2) RETURNING *',
            [userId, mobileNumber]
        );

        res.status(201).json({ message: 'User onboarded', user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Signup failed', error: error.message });
    }
};

exports.initiateLogin = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        const userCheck = await db.query('SELECT user_id FROM Users WHERE mobile_number = $1', [mobileNumber]);
        console.log(userCheck.rows.length)
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

        const result = await db.query('SELECT * FROM Users WHERE mobile_number = $1', [mobileNumber]);
        const user = result.rows[0];

        const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '48h' });
        res.status(200).json({ message: 'Logged in', token });
    } catch (error) {
        res.status(500).json({ message: 'Login failed' });
    }
};