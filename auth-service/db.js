const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '..', '.env')
});;

// Create a new pool instance to manage connections
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  port: parseInt(process.env.DB_PORT) || 5432,
  max: 20, 
  min: 2, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 10000, 
  statement_timeout: 30000, // Query timeout: 30 seconds
  query_timeout: 30000, // Query timeout: 30 seconds
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start sending keep-alive after 10 seconds
};

// Add SSL configuration for AWS RDS in production
if (isProduction) {
  poolConfig.ssl = {
    require: true,
    rejectUnauthorized: false // Set to true if you have proper SSL certificates
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process on connection errors - let PM2 handle restarts
  // Only log the error for monitoring
  if (err.code === '28P01') {
    console.error('❌ Database authentication failed. Check DB credentials.');
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    console.error('❌ Database connection timeout. Check network and RDS security group.');
  }
});

// Enhanced query function with retry logic for connection timeouts
const queryWithRetry = async (text, params, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      // If it's a connection error and we have retries left, try again
      if (
        (error.code === 'ETIMEDOUT' || 
         error.code === 'ECONNREFUSED' || 
         error.message.includes('Connection terminated') ||
         error.message.includes('connection timeout')) &&
        i < retries
      ) {
        console.warn(`Database query failed, retrying (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      // If no retries left or different error, throw it
      throw error;
    }
  }
};

module.exports = {
  query: queryWithRetry,
  // Also export pool for direct access if needed
  pool: pool,
};