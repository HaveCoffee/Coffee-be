// db.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: {
        // Only use rejectUnauthorized: true in production with a valid certificate
        // For local development or testing, you might need to set it to false
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

console.log('PostgreSQL Pool Initialized.');

// Export query function for reuse across controllers
module.exports = {
    query: (text, params) => pool.query(text, params),
};