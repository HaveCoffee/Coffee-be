require('dotenv').config();

const config = {
    // Server - Use port 3001 for chat service
    PORT: process.env.PORT || 3001,

    // JWT/Auth Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'SUPER_SECRET_KEY_FOR_JWT_SIGNING',
    TOKEN_USER_ID_FIELD: 'userId', 

    // PostgreSQL Database Configuration
    DB_NAME: process.env.DB_NAME || 'coffee_dev',
    DB_USER: process.env.DB_USER || 'riagrawa2401',
    DB_PASS: process.env.DB_PASS || 'dev_123',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_DIALECT: 'postgres',
    DB_PORT: process.env.DB_PORT || 5432,
};

module.exports = config;