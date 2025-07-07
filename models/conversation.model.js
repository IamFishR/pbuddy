// models/conversation.model.js
module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // userId FK will be added by association in models/index.js
    title: {
      type: DataTypes.STRING, // VARCHAR(255)
      allowNull: true // Title might be generated later or be optional
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'ended'),
      defaultValue: 'active',
      allowNull: false
    },
    last_activity_at: { // Renamed from last_updated for clarity
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true // Manages createdAt and updatedAt
  });

  // Conversation.associate = function(models) {
  //   Conversation.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  //   Conversation.hasMany(models.ShortTermMemory, { foreignKey: 'conversationId', as: 'messages' });
  // };

  return Conversation;
};
