require('dotenv').config();

const config = {
    // Server
    PORT: process.env.PORT || 3000,

    // JWT/Auth Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_key_change_me_in_prod',
    // The user ID will be the subject ('sub') of the token payload
    TOKEN_USER_ID_FIELD: 'userId', 

    // PostgreSQL Database Configuration (Replace with your AWS RDS credentials)
    DB_NAME: process.env.DB_NAME || 'coffee_dev',
    DB_USER: process.env.DB_USER || 'riagrawa2401',
    DB_PASS: process.env.DB_PASS || 'dev_123',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_DIALECT: 'postgres',
    DB_PORT: process.env.DB_PORT || 5432,
};

module.exports = config;