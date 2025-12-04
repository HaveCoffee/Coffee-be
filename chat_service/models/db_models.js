const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config');

// Initialize Sequelize with Postgres credentials
const sequelizeConfig = {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: config.DB_DIALECT,
    logging: config.ENABLE_SQL_LOGGING ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

// Add SSL configuration for AWS RDS in production
if (config.DB_SSL) {
    sequelizeConfig.dialectOptions = {
        ssl: config.DB_SSL
    };
}

const sequelize = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASS, sequelizeConfig);

const User = sequelize.define('User', {
    // Primary key: Must match your external table's primary key
    user_id: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
        primaryKey: true
    },
    mobile_number: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true 
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true 
    }
}, {
    tableName: 'users',
});

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    senderId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    receiverId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'messages'
});

// Define Associations
User.hasMany(Message, { foreignKey: 'senderId', as: 'SentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'ReceivedMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'Sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'Receiver' });


// Function to connect and synchronize the database
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL Connection has been established successfully.');

        await sequelize.sync({ alter: true });
        console.log('Database synchronized (Models created/updated).');
    } catch (error) {
        console.error('Unable to connect to the database or sync models:', error);
        process.exit(1);
    }
};

module.exports = {
    sequelize,
    User,
    Message,
    connectDB
};