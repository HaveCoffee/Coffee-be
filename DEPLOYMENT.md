# Production Deployment Guide

This guide covers deploying the Coffee backend services to an EC2 instance with AWS RDS PostgreSQL.

## Prerequisites

- AWS EC2 instance (Ubuntu 20.04+ recommended)
- AWS RDS PostgreSQL instance
- Domain name (optional, for production URLs)
- SSH access to EC2 instance
- Node.js 16+ installed on EC2

## Step 1: EC2 Instance Setup

### 1.1 Connect to EC2 Instance
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Install Node.js and PM2
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node --version
npm --version
pm2 --version
```

### 1.3 Install PostgreSQL Client (for testing)
```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
```

## Step 2: Database Setup (AWS RDS)

### 2.1 Configure RDS Security Group
- Ensure RDS security group allows inbound connections from EC2 security group on port 5432
- Or allow your EC2 instance's IP address

### 2.2 Test RDS Connection
```bash
psql -h your-rds-endpoint.region.rds.amazonaws.com -U your_db_username -d coffee_production
```

### 2.3 Create Database Tables
Connect to RDS and run the schema:
```sql
-- For auth-service
CREATE TABLE IF NOT EXISTS Users (
    user_id VARCHAR(32) PRIMARY KEY,
    mobile_number VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- For chat-service (tables will be auto-created by Sequelize)
-- But you can verify they exist after first run
```

## Step 3: Application Deployment

### 3.1 Clone Repository
```bash
cd /home/ubuntu
git clone your-repository-url coffee-backend
cd coffee-backend
```

### 3.2 Install Dependencies
```bash
npm install
cd auth-service && npm install && cd ..
cd chat_service && npm install && cd ..
```

### 3.3 Configure Environment Variables
```bash
# Copy the example file
cp .env.production.example .env

# Edit with your production values
nano .env
```

**Required .env variables:**
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-strong-secret-key
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=coffee_production
DB_USER=your_db_username
DB_PASSWORD=your_db_password
CORS_ORIGIN=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
```

### 3.4 Create Logs Directory
```bash
mkdir -p logs
```

## Step 4: Start Services with PM2

### 4.1 Start All Services
```bash
pm2 start ecosystem.config.js
```

### 4.2 Check Status
```bash
pm2 status
pm2 logs
```

### 4.3 Save PM2 Configuration
```bash
pm2 save
pm2 startup
# Follow the instructions to enable PM2 on system startup
```

## Step 5: Configure Nginx (Reverse Proxy)

### 5.1 Install Nginx
```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 5.2 Configure Nginx for Auth Service
```bash
sudo nano /etc/nginx/sites-available/auth-service
```

Add configuration:
```nginx
server {
    listen 80;
    server_name auth.yourdomain.com;  # or your EC2 IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 Configure Nginx for Chat Service
```bash
sudo nano /etc/nginx/sites-available/chat-service
```

Add configuration:
```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;  # or your EC2 IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.4 Enable Sites and Restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/auth-service /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/chat-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 6: Configure SSL with Let's Encrypt (Optional but Recommended)

### 6.1 Install Certbot
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificates
```bash
sudo certbot --nginx -d auth.yourdomain.com
sudo certbot --nginx -d chat.yourdomain.com
```

### 6.3 Auto-renewal
Certbot automatically sets up auto-renewal. Test with:
```bash
sudo certbot renew --dry-run
```

## Step 7: Security Configuration

### 7.1 Configure EC2 Security Group
- Allow inbound HTTP (80) and HTTPS (443) from anywhere (0.0.0.0/0)
- Allow inbound SSH (22) only from your IP
- Do NOT expose ports 3000 and 3001 directly

### 7.2 Configure Firewall (UFW)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 7.3 Update .env Security
```bash
# Make .env file readable only by owner
chmod 600 .env
```

## Step 8: Monitoring and Maintenance

### 8.1 PM2 Commands
```bash
# View logs
pm2 logs

# View specific service logs
pm2 logs auth-service
pm2 logs chat-service

# Restart services
pm2 restart all
pm2 restart auth-service

# Stop services
pm2 stop all

# Monitor resources
pm2 monit
```

### 8.2 Health Check Endpoints
- Auth Service: `http://your-domain/health` and `/ready`
- Chat Service: `http://your-domain/health` and `/ready`

### 8.3 Database Connection Pooling
The services are configured with connection pooling:
- Max connections: 10 (Sequelize) / 20 (pg Pool)
- Connection timeout: 30 seconds
- Idle timeout: 10 seconds

## Step 9: Troubleshooting

### 9.1 Check Service Status
```bash
pm2 status
pm2 logs --lines 100
```

### 9.2 Check Database Connection
```bash
# Test from EC2
psql -h your-rds-endpoint -U your_db_username -d coffee_production
```

### 9.3 Check Nginx Status
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### 9.4 Common Issues

**Issue: Services won't start**
- Check .env file exists and has correct values
- Check database connectivity
- Check logs: `pm2 logs`

**Issue: Database connection fails**
- Verify RDS security group allows EC2
- Check DB credentials in .env
- Test connection manually with psql

**Issue: CORS errors**
- Verify CORS_ORIGIN in .env matches frontend URL
- Check Nginx configuration

## Step 10: Updates and Deployment

### 10.1 Update Application
```bash
cd /home/ubuntu/coffee-backend
git pull origin main
npm install
cd auth-service && npm install && cd ..
cd chat_service && npm install && cd ..
pm2 restart all
```

### 10.2 Database Migrations
If you have schema changes, run migrations manually or let Sequelize sync (in development mode only).

## Environment Variables Reference

See `.env.production.example` for all required environment variables.

## Support

For issues or questions, check:
- PM2 logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/`
- Application logs: `./logs/`

