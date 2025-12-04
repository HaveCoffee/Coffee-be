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
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};