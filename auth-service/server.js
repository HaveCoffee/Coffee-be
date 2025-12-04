const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

require('dotenv').config({
    path: path.resolve(__dirname, '..', '.env')
});

// Import Controller and Middleware
const authController = require('./controllers/auth.controller');
const verifyToken = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction ? (process.env.CORS_ORIGIN || process.env.FRONTEND_URL) : '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Authentication API Documentation'
}));

// API Info endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Authentication Service API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// --- ROUTES ---

/**
 * @swagger
 * /api/auth/signup/init:
 *   post:
 *     summary: Initiate signup process
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupInitiateRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully for signup.
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
app.post('/api/auth/signup/init', authController.initiateSignup);

/**
 * @swagger
 * /api/auth/signup/verify:
 *   post:
 *     summary: Complete signup by verifying OTP and setting password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupCompleteRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignupCompleteResponse'
 *       400:
 *         description: Invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
app.post('/api/auth/signup/verify', authController.completeSignup);

/**
 * @swagger
 * /api/auth/login/init:
 *   post:
 *     summary: Initiate login process
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInitiateRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginInitiateResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
app.post('/api/auth/login/init', authController.initiateLogin);

/**
 * @swagger
 * /api/auth/login/verify:
 *   post:
 *     summary: Complete login by verifying OTP and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCompleteRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginCompleteResponse'
 *       400:
 *         description: Invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
app.post('/api/auth/login/verify', authController.completeLogin);

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile (Protected route)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// Health check endpoint for load balancer
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'ready',
      service: 'auth-service',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: 'auth-service',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`✅ Auth Service running on port ${PORT} (${env} mode)`);
  if (!isProduction) {
    console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  }
});