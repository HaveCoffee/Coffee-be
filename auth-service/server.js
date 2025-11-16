// server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // For development/CORS policy

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({ message: "Authentication Service is running." });
});

// Import and use Auth Routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Import and use Firebase Auth Routes
const firebaseAuthRoutes = require('./routes/firebase-auth.routes');
app.use('/api/auth/firebase', firebaseAuthRoutes);

// Global Error Handler (Optional but recommended)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: "Something broke!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Authentication Service running on port ${PORT}.`);
});