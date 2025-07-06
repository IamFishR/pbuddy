const { Sequelize } = require('sequelize');
const dbConfig = require('../config/db.config.js');

const sequelize = new Sequelize(
  dbConfig.DB,
  dbConfig.USER,
  dbConfig.PASSWORD,
  {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire,
      idle: dbConfig.pool.idle
    },
    logging: false // Set to console.log to see SQL queries
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Load models
db.User = require('./user.model.js')(sequelize, Sequelize);
db.Chat = require('./chat.model.js')(sequelize, Sequelize);
db.Message = require('./message.model.js')(sequelize, Sequelize);

// Define associations
// User hasMany Chats
db.User.hasMany(db.Chat, {
  foreignKey: {
    name: 'userId',
    allowNull: false
  },
  as: 'chats'
});
db.Chat.belongsTo(db.User, {
  foreignKey: {
    name: 'userId',
    allowNull: false
  },
  as: 'user'
});

// Chat hasMany Messages
db.Chat.hasMany(db.Message, {
  foreignKey: {
    name: 'chatId',
    allowNull: false
  },
  as: 'messages'
});
db.Message.belongsTo(db.Chat, {
  foreignKey: {
    name: 'chatId',
    allowNull: false
  },
  as: 'chat'
});

// Function to sync database
db.syncDb = async () => {
  try {
    // await sequelize.sync({ force: true }); // Drops and recreates tables - use for development
    await sequelize.sync(); // Creates tables if they don't exist
    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Failed to sync database:', error);
    process.exit(1); // Exit if DB sync fails
  }
};

module.exports = db;
