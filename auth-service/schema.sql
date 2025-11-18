CREATE TABLE IF NOT EXISTS Users (
    mobile_number VARCHAR(20) PRIMARY KEY, -- The Unique Identifier
    password VARCHAR(255) NOT NULL,        -- Hashed Password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);