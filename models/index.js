const { Sequelize, DataTypes } = require('sequelize'); // DataTypes needed for models if not passed
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
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log SQL in dev
    define: {
      // underscored: true, // If you want snake_case table names and columns globally
      timestamps: true // Ensure timestamps are enabled by default for all models
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Load models
db.User = require('./user.model.js')(sequelize, DataTypes);
db.Conversation = require('./conversation.model.js')(sequelize, DataTypes); // Renamed from Chat
db.ShortTermMemory = require('./shorttermMemory.model.js')(sequelize, DataTypes); // Renamed from Message
db.LongTermMemory = require('./longtermMemory.model.js')(sequelize, DataTypes);
db.Reflection = require('./reflection.model.js')(sequelize, DataTypes);

// Define associations

// User associations
db.User.hasMany(db.Conversation, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'conversations'
});
db.User.hasMany(db.LongTermMemory, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'longTermMemories'
});
db.User.hasMany(db.Reflection, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'reflections'
});

// Conversation associations
db.Conversation.belongsTo(db.User, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'user'
});
db.Conversation.hasMany(db.ShortTermMemory, {
  foreignKey: { name: 'conversationId', allowNull: false },
  as: 'messages' // keep 'messages' for compatibility or change to 'shortTermMemories'
});

// ShortTermMemory associations
db.ShortTermMemory.belongsTo(db.Conversation, {
  foreignKey: { name: 'conversationId', allowNull: false },
  as: 'conversation'
});

// LongTermMemory associations
db.LongTermMemory.belongsTo(db.User, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'user'
});
db.LongTermMemory.belongsTo(db.Reflection, {
  foreignKey: { name: 'sourceReflectionId', allowNull: true }, // LTM can exist without a reflection
  as: 'sourceReflection'
});

// Reflection associations
db.Reflection.belongsTo(db.User, {
  foreignKey: { name: 'userId', allowNull: false },
  as: 'user'
});
db.Reflection.hasMany(db.LongTermMemory, { // A reflection can lead to multiple LTM entries
  foreignKey: { name: 'sourceReflectionId', allowNull: true }, // FK in LongTermMemory table
  as: 'generatedMemories'
});


// Optional: Call associate method if defined in models (alternative way to define associations)
// Object.keys(db).forEach(modelName => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

module.exports = db;
