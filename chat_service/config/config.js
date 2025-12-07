const path = require('path');
// Try to load .env from current directory, then parent directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config(); // This will override with local .env if it exists

const isProduction = process.env.NODE_ENV === 'production';

const config = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    isProduction,

    // Server - Use port 3001 for chat service
    PORT: process.env.PORT || 3001,

    // JWT/Auth Configuration
    JWT_SECRET: process.env.JWT_SECRET || (isProduction ? null : 'SUPER_SECRET_KEY_FOR_JWT_SIGNING'),
    TOKEN_USER_ID_FIELD: 'userId', 

    // PostgreSQL Database Configuration
    // Support both DB_PASS and DB_PASSWORD for compatibility
    DB_NAME: process.env.DB_NAME || 'coffee_dev',
    DB_USER: process.env.DB_USER || 'riagrawa2401',
    DB_PASS: process.env.DB_PASS || process.env.DB_PASSWORD || 'dev_123',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_DIALECT: 'postgres',
    DB_PORT: parseInt(process.env.DB_PORT) || 5432,
    
    // AWS RDS SSL Configuration
    DB_SSL: isProduction ? {
        require: true,
        rejectUnauthorized: false // Set to true if you have proper SSL certificates
    } : false,
    
    // CORS Configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || (isProduction ? process.env.FRONTEND_URL : '*'),
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    ENABLE_SQL_LOGGING: process.env.ENABLE_SQL_LOGGING === 'true' || !isProduction,
};

// Validate required production environment variables
if (isProduction) {
    const required = ['JWT_SECRET', 'DB_NAME', 'DB_USER', 'DB_HOST'];
    const hasDbPassword = process.env.DB_PASS || process.env.DB_PASSWORD;
    
    const missing = required.filter(key => !process.env[key]);
    if (!hasDbPassword) {
        missing.push('DB_PASS or DB_PASSWORD');
    }
    
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
}

module.exports = config;