// config/swagger.js

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Service API',
      version: '1.0.0',
      description: 'API documentation for Social Media App Chat Service with real-time messaging',
      contact: {
        name: 'API Support',
        email: 'hello@havecoffee.in'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://chat.havecoffee.in',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from authentication service'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        UserProfile: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
              description: 'Unique user identifier'
            },
            profile: {
              type: 'object',
              properties: {
                user_id: {
                  type: 'string',
                  example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
                },
                mobile_number: {
                  type: 'string',
                  example: '+1234567890'
                },
                name: {
                  type: 'string',
                  example: 'John Doe'
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true
                }
              }
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            senderId: {
              type: 'string',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
            },
            receiverId: {
              type: 'string',
              example: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7'
            },
            content: {
              type: 'string',
              example: 'Hello! How are you?'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and profile endpoints'
      },
      {
        name: 'Chat',
        description: 'Chat and messaging endpoints'
      }
    ]
  },
  apis: ['./server.js', './routes/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;



