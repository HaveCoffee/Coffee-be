// PM2 Ecosystem Configuration for Production
// 
// PURPOSE: This file tells PM2 HOW to run your services (process management)
// .env file tells your application WHAT configuration values to use
//
// They work together:
// - .env = Application configuration (database, secrets, API keys)
// - ecosystem.config.js = Process management (how many instances, restart policy, logging)
//
// Run: pm2 start ecosystem.config.js
//
// NOTE: PM2 automatically loads .env file from the current directory
// All variables from .env will be available to your Node.js processes

module.exports = {
  apps: [
    {
      name: 'auth-service',
      script: './auth-service/server.js',
      instances: 2, // Run 2 instances for load balancing (adjust based on EC2 size)
      exec_mode: 'cluster', // Cluster mode for better performance
      
      // These env vars override .env if needed, but .env is loaded automatically
      // You can also set service-specific overrides here
      env: {
        NODE_ENV: 'production',
        PORT: 3000 // Can be overridden by .env if PORT is set there
      },
      
      // Process management settings
      error_file: './logs/auth-service-error.log',
      out_file: './logs/auth-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true, // Auto-restart if process crashes
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      watch: false, // Don't watch for file changes in production
      ignore_watch: ['node_modules', 'logs'],
      
      // Optional: Explicitly specify .env file location (PM2 loads it automatically)
      // env_file: '.env'
    },
    {
      name: 'chat-service',
      script: './chat_service/server.js',
      instances: 2, // Run 2 instances for load balancing
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        PORT: 3001 // Can be overridden by .env if PORT is set there
      },
      
      error_file: './logs/chat-service-error.log',
      out_file: './logs/chat-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs']
    }
  ]
};

