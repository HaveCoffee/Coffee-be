const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const jwt = require('jsonwebtoken');
const verifyToken = require('./middleware/auth.middleware');
const { connectDB, User, Message } = require('./models/db_models');
const config = require('./config/config');

// --- Initialization ---

// Create Express App and HTTP Server
const app = express();
const server = http.createServer(app);
const PORT = config.PORT;
const API_VERSION = '/api/v1';

// Initialize Socket.io Server
const io = new Server(server, {
    cors: {
        origin: config.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// --- Middleware ---
app.use(bodyParser.json());

// Swagger Documentation
app.use(API_VERSION + '/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Chat Service API Documentation'
}));

if (!config.isProduction) {
  console.log(`Swagger Docs available at: http://localhost:${PORT}${API_VERSION}/docs`);
}

// API Info endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Chat Service API',
    version: '1.0.0',
    documentation: `${API_VERSION}/docs`,
    environment: config.NODE_ENV
  });
});

// Health check endpoint for load balancer
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'chat-service',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    const { sequelize } = require('./models/db_models');
    await sequelize.authenticate();
    res.status(200).json({
      status: 'ready',
      service: 'chat-service',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: 'chat-service',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// --- REST Endpoints ---

// Middleware to ensure user has completed profile before accessing core features
const requireProfileComplete = (req, res, next) => {
    // We assume if the user record exists (which is checked in auth_middleware)
    // they are considered "active" or "complete" enough for the chat service.
    if (!req.user.profile) {
        return res.status(403).json({ message: "Forbidden: User record not found in local service DB." });
    }
    next();
};

/**
 * @swagger
 * /api/v1/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized - Invalid or missing token
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
 */
app.get(API_VERSION + '/me', verifyToken, (req, res) => {
    // The verifyToken middleware has already:
    // 1. Verified the JWT and extracted the userId.
    // 2. Fetched the user's profile status from the local DB.
    // We return this data for the client to confirm their session.
    res.status(200).json({
        userId: req.user.userId,
        // The profile object contains username, bio, and isProfileComplete status
        profile: req.user.profile
    });
});

/**
 * @swagger
 * /api/v1/chat/messages/{otherUserId}:
 *   get:
 *     summary: Get chat history with another user
 *     description: Retrieves all messages between the authenticated user and the specified user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: otherUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the other participant in the conversation
 *         example: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7'
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Profile not complete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get(API_VERSION + '/chat/messages/:otherUserId', verifyToken, requireProfileComplete, async (req, res) => {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.otherUserId;

    try {
        const messages = await Message.findAll({
            where: {
                [require('sequelize').Op.or]: [
                    { senderId: currentUserId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: currentUserId }
                ]
            },
            order: [['createdAt', 'ASC']]
        });
        res.status(200).json(messages);
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Server error retrieving chat history.' });
    }
});


// --- Socket.io (Real-time Chat) ---

/**
 * @swagger
 * components:
 *   schemas:
 *     WebSocketConnection:
 *       type: object
 *       description: |
 *         Real-time messaging is handled via WebSocket (Socket.io).
 *         
 *         **Connection:**
 *         - Connect to: `ws://localhost:3000` (or your server URL)
 *         - Authentication: Provide JWT token in handshake
 *         
 *         **Events:**
 *         - **send_message**: Send a message
 *           - Payload: `{ receiverId: string, content: string }`
 *           - Callback: `(response) => {}` where response is `{ status: 'ok'|'error', message: string }`
 *         
 *         - **new_message**: Receive a new message
 *           - Payload: `{ id: number, senderId: string, receiverId: string, content: string, createdAt: string }`
 *         
 *         **Example Client Code:**
 *       
 *         const socket = io('http://localhost:3000', {
 *           auth: { token: 'your-jwt-token' }
 *         });
 *         
 *         socket.on('connect', () => {
 *           console.log('Connected to chat server');
 *         });
 *         
 *         socket.on('new_message', (message) => {
 *           console.log('New message:', message);
 *         });
 *         
 *         socket.emit('send_message', {
 *           receiverId: 'other-user-id',
 *           content: 'Hello!'
 *         }, (response) => {
 *           console.log('Message status:', response);
 *         });
 *          */

// Socket.io JWT Authentication Middleware
// This checks the token provided in the client's handshake
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Authentication error: Token missing."));
    }

    try {
        console.log("Socket Auth: Verifying token...");
        console.log("Socket Auth: JWT_SECRET configured:", config.JWT_SECRET ? "Yes (length: " + config.JWT_SECRET.length + ")" : "No");
        const decoded = jwt.verify(token, config.JWT_SECRET);
        console.log("Socket Auth: Token decoded successfully. Payload:", decoded);
        
        const userId = decoded[config.TOKEN_USER_ID_FIELD] || decoded.user_id || decoded.userId;
        const mobileNumber = decoded.mobileNumber || decoded.mobile_number;

        console.log(`Socket Auth: Extracted userId: ${userId}, mobileNumber: ${mobileNumber}`);

        if (!userId) {
            console.error("Socket Auth Error: User ID missing from token. Token payload:", decoded);
            return next(new Error("Authentication error: User ID missing from token."));
        }

        // Find or create user by user_id (auto-sync from auth service)
        console.log(`Socket Auth: Looking up user with user_id: ${userId}`);
        
        // Check if database is connected
        const { sequelize } = require('./models/db_models');
        try {
            await sequelize.authenticate();
            console.log('Socket Auth: Database connection verified');
        } catch (dbConnError) {
            console.error('Socket Auth Error: Database not connected:', dbConnError.message);
            return next(new Error("Authentication error: Database connection failed."));
        }
        
        let user, created;
        try {
            const result = await User.findOrCreate({
                where: { user_id: userId },
                defaults: {
                    user_id: userId,
                    mobile_number: mobileNumber || 'unknown',
                    name: null
                }
            });
            user = result[0];
            created = result[1];
            console.log(`Socket Auth: findOrCreate completed. user:`, user ? (user.user_id || user.get('user_id')) : 'null', 'created:', created);
        } catch (dbError) {
            console.error(`Socket Auth Error: Database error during findOrCreate:`, dbError);
            console.error(`Socket Auth Error: Full error:`, JSON.stringify(dbError, null, 2));
            // Try to find user without creating
            try {
                user = await User.findByPk(userId);
                if (!user) {
                    console.error(`Socket Auth Error: User not found and could not be created. userId: ${userId}`);
                    return next(new Error("Authentication error: User record not found."));
                }
                created = false;
            } catch (findError) {
                console.error(`Socket Auth Error: Error finding user:`, findError);
                return next(new Error("Authentication error: Database query failed."));
            }
        }

        if (created) {
            console.log(`Socket Auth: Auto-created user in chat service: ${userId}`);
        } else {
            console.log(`Socket Auth: User found in chat service: ${userId}`);
        }

        if (!user) {
            console.error(`Socket Auth Error: User is null after findOrCreate. userId: ${userId}`);
            return next(new Error("Authentication error: User record not found."));
        }

        console.log(`Socket Auth: User authenticated successfully. userId: ${user.user_id}`);
        // Attach authenticated user info to the socket
        socket.user = { userId: user.user_id, username: user.name || user.user_id };
        next();
    } catch (error) {
        console.error("Socket Auth Error:", error.message);
        if (error.name === 'JsonWebTokenError') {
            return next(new Error("Authentication error: Invalid token signature."));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new Error("Authentication error: Token has expired."));
        }
        next(new Error("Authentication error: Invalid token."));
    }
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
    const currentUserId = socket.user.userId;
    console.log(`User connected: ${socket.user.username || currentUserId} (ID: ${currentUserId})`);

    // 1. Join a private room based on the user ID for direct messaging
    socket.join(currentUserId);

    // 2. Listen for a new message
    socket.on('send_message', async ({ receiverId, content }, callback) => { // Updated to receiverId
        if (!receiverId || !content) {
            console.warn(`Invalid message from ${currentUserId}`);
            // Send an error acknowledgement back to the client
            return callback && callback({ status: 'error', message: 'Missing recipient or content.' });
        }

        try {
            console.log(`Attempting to send message from ${currentUserId} to ${receiverId}`);
            
            // Find or create receiver in chat_service DB (auto-sync from auth service)
            // This ensures users exist in chat_service even if they haven't connected yet
            const [receiverExists, receiverCreated] = await User.findOrCreate({
                where: { user_id: receiverId },
                defaults: {
                    user_id: receiverId,
                    mobile_number: 'unknown', // Will be updated when receiver connects
                    name: null
                }
            });

            if (receiverCreated) {
                console.log(`Auto-created receiver in chat service: ${receiverId}`);
            }
            
            console.log(`Receiver found: ${receiverExists.user_id}`);

            // Save message to database
            const message = await Message.create({
                senderId: currentUserId, // Updated to senderId
                receiverId: receiverId,
                content: content
            });

            // Format message payload
            const messagePayload = {
                id: message.id,
                senderId: currentUserId,
                receiverId: receiverId,
                content: content,
                createdAt: message.createdAt
            };

            // Send message to the receiver's room
            io.to(receiverId).emit('new_message', messagePayload);

            // Send message back to the sender's room (optional, but good for sync)
            io.to(currentUserId).emit('new_message', messagePayload);

            // Acknowledge successful send to the client
            if (callback) {
                callback({ status: 'ok', message: 'Message sent successfully.' });
            }
        } catch (error) {
            console.error('Error sending/saving message:', error);
            if (callback) {
                callback({ status: 'error', message: 'Failed to send message.' });
            }
        }
    });

    // 3. Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${currentUserId}`);
        socket.leave(currentUserId);
    });
});


// --- Startup ---

// Start the database connection and then the server
connectDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
        if (!config.isProduction) {
          console.log(`Swagger documentation available at http://localhost:${PORT}${API_VERSION}/docs`);
        }
        console.log(`✅ Chat Service running on port ${PORT} (${config.NODE_ENV} mode)`);
    });
});