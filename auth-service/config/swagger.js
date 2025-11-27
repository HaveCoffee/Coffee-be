// config/swagger.js

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Authentication Service API',
      version: '1.0.0',
      description: 'API documentation for Social Media App Authentication Service',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'ERROR_CODE'
            }
          }
        },
        SignupInitiateRequest: {
          type: 'object',
          required: ['mobileNumber'],
          properties: {
            mobileNumber: {
              type: 'string',
              example: '+1234567890',
              description: 'Mobile number with country code'
            }
          }
        },
        SignupCompleteRequest: {
          type: 'object',
          required: ['mobileNumber', 'otp', 'password'],
          properties: {
            mobileNumber: {
              type: 'string',
              example: '+1234567890'
            },
            otp: {
              type: 'string',
              example: '123456',
              description: '6-digit OTP received via SMS'
            },
            password: {
              type: 'string',
              example: 'securePass123',
              minLength: 6,
              description: 'Password (minimum 6 characters)'
            }
          }
        },
        SignupCompleteResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'User registered and onboarded successfully.'
            },
            user_id: {
              type: 'string',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
            },
            mobile_number: {
              type: 'string',
              example: '+1234567890'
            }
          }
        },
        LoginInitiateRequest: {
          type: 'object',
          required: ['mobileNumber'],
          properties: {
            mobileNumber: {
              type: 'string',
              example: '+1234567890'
            }
          }
        },
        LoginInitiateResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'OTP sent. Please verify to proceed to password entry.'
            },
            user_id: {
              type: 'string',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
            }
          }
        },
        LoginCompleteRequest: {
          type: 'object',
          required: ['mobileNumber', 'otp', 'password'],
          properties: {
            mobileNumber: {
              type: 'string',
              example: '+1234567890'
            },
            otp: {
              type: 'string',
              example: '123456'
            },
            password: {
              type: 'string',
              example: 'securePass123'
            }
          }
        },
        LoginCompleteResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Successfully logged in'
            },
            user_id: {
              type: 'string',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
            },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints for signup and login'
      }
    ]
  },
  apis: ['./routes/*.js', './server.js', './controllers/*.js'] // Path to the API files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
