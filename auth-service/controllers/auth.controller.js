const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const crypto = require('crypto');
const db = require('../db');
const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '..', '.env')
});

// Initialize Twilio Client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Toggle this to false if you ever want to go back to real Twilio
const USE_MOCK_OTP = true;

/**
 * HELPER: Generate random user_id
 */
const generateUserId = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * HELPER: Send OTP via Twilio Verify
 */
const sendOtpHelper = async (mobileNumber) => {
  if (USE_MOCK_OTP) {
    console.log(`[MOCK OTP] Sent to ${mobileNumber}. Use code: 123456`);
    return { status: 'pending' };
  }

  return await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: mobileNumber, channel: 'sms' });
};

/**
 * HELPER: Check OTP via Twilio Verify
 */
const verifyOtpHelper = async (mobileNumber, code) => {
  if (USE_MOCK_OTP) {
    console.log(`[MOCK VERIFY] Checking code ${code} for ${mobileNumber}`);
    // Accepts 123456 as the universal bypass code
    return code === '123456';
  }

  const verification = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: mobileNumber, code: code });

  return verification.status === 'approved';
};

/**
 * 1. SIGNUP FLOW - INITIATE
 * Check if user exists, then send OTP
 */
exports.initiateSignup = async (req, res) => {
  const { mobileNumber } = req.body;

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT user_id, mobile_number FROM Users WHERE mobile_number = $1', [mobileNumber]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({
        message: 'User already exists. Please login.',
        error: 'USER_ALREADY_EXISTS'
      });
    }

    // Send OTP
    await sendOtpHelper(mobileNumber);
    res.status(200).json({ message: 'OTP sent successfully for signup.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

/**
 * 2. SIGNUP FLOW - COMPLETE
 * Verify OTP -> Hash Password -> Generate user_id -> Save to DB
 */
exports.completeSignup = async (req, res) => {
  const { mobileNumber, otp } = req.body;

  try {
    // Check if user already exists (double check)
    const existingUser = await db.query('SELECT user_id FROM Users WHERE mobile_number = $1', [mobileNumber]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        message: 'User already exists. Please login.',
        error: 'USER_ALREADY_EXISTS'
      });
    }

    // 1. Verify OTP
    const isOtpValid = await verifyOtpHelper(mobileNumber, otp);
    if (!isOtpValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // 2. Hash Password
//    const salt = await bcrypt.genSalt(10);
//    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Generate unique user_id
    let userId = generateUserId();
    let userIdExists = true;
    
    // Ensure user_id is unique (very unlikely but check anyway)
    while (userIdExists) {
      const checkUserId = await db.query('SELECT user_id FROM Users WHERE user_id = $1', [userId]);
      if (checkUserId.rows.length === 0) {
        userIdExists = false;
      } else {
        userId = generateUserId();
      }
    }

    // 4. Save User with user_id
    const result = await db.query(
      'INSERT INTO Users (user_id, mobile_number) VALUES ($1, $2) RETURNING user_id, mobile_number',
      [userId, mobileNumber]
    );

    res.status(201).json({ 
      message: 'User registered and onboarded successfully.',
      user_id: result.rows[0].user_id,
      mobile_number: result.rows[0].mobile_number
    });

  } catch (error) {
    console.error(error);
    
    // Handle unique constraint violation
    if (error.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ 
        message: 'User already exists. Please login.',
        error: 'USER_ALREADY_EXISTS'
      });
    }
    
    res.status(500).json({ message: 'Signup failed', error: error.message });
  }
};

/**
 * 3. LOGIN FLOW - INITIATE
 * Check if user exists -> Fetch user_id -> Send OTP
 */
exports.initiateLogin = async (req, res) => {
  const { mobileNumber } = req.body;

  try {
    // Check if user exists and fetch user_id
    const userCheck = await db.query('SELECT user_id, mobile_number FROM Users WHERE mobile_number = $1', [mobileNumber]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found. Please signup.' });
    }

    const user = userCheck.rows[0];

    // Send OTP (2FA Step 1)
    await sendOtpHelper(mobileNumber);
    res.status(200).json({ 
      message: 'OTP sent. Please verify to proceed to password entry.',
      user_id: user.user_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error initiating login', error: error.message });
  }
};

/**
 * 4. LOGIN FLOW - COMPLETE
 * Verify OTP -> Verify Password -> Issue JWT -> Return user_id
 */
exports.completeLogin = async (req, res) => {
  const { mobileNumber, otp } = req.body;

  try {
    // 1. Verify OTP
    const isOtpValid = await verifyOtpHelper(mobileNumber, otp);
    if (!isOtpValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // 2. Fetch User
    const result = await db.query('SELECT user_id, mobile_number FROM Users WHERE mobile_number = $1', [mobileNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = result.rows[0];

    // 3. Verify Password
//    const isPasswordValid = await bcrypt.compare(password, user.password);
//    if (!isPasswordValid) {
//      return res.status(401).json({ message: 'Invalid password.' });
//    }

    // 4. Issue JWT
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        mobileNumber: user.mobile_number 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Successfully logged in',
      user_id: user.user_id,
      token: token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};