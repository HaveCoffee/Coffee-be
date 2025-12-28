// config/swagger.js

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Authentication Service API',
      version: '1.0.0',
      description: 'API documentation for Coffee App Auth Service using Message Central OTP',
      contact: {
        name: 'API Support',
        email: 'hello@havecoffee.in'
      }
    },
    servers: [
      {
        url: 'http://3.110.104.45:3000',
        description: 'AWS Production Server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Standard JWT Authorization header'
        },
        messageCentralToken: {
          type: 'apiKey',
          in: 'header',
          name: 'authToken',
          description: 'Message Central token required for signup verification'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Error message' },
            error: { type: 'object', nullable: true }
          }
        },
        SignupInitiateRequest: {
          type: 'object',
          required: ['mobileNumber'],
          properties: {
            mobileNumber: { type: 'string', example: '9589074989' }
          }
        },
        SignupVerifyRequest: {
          type: 'object',
          required: ['mobileNumber', 'otp', 'verificationId'],
          properties: {
            mobileNumber: { type: 'string', example: '9589074989' },
            otp: { type: 'string', example: '5107' },
            verificationId: { type: 'string', example: '3884691' }
          }
        },
        LoginInitiateRequest: {
          type: 'object',
          required: ['mobileNumber'],
          properties: {
            mobileNumber: { type: 'string', example: '9589074989' }
          }
        },
        LoginVerifyRequest: {
          type: 'object',
          required: ['mobileNumber', 'otp', 'verificationId'],
          properties: {
            mobileNumber: { type: 'string', example: '9589074989' },
            otp: { type: 'string', example: '7532' },
            verificationId: { type: 'string', example: '3884726' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Successfully authenticated' },
            verificationId: { type: 'string', example: '3884726' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' }
          }
        }
      }
    }
  },
  apis: ['./server.js'] // Since JSDoc is in server.js
};

module.exports = swaggerJsdoc(options);