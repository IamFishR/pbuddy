// models/shorttermMemory.model.js
module.exports = (sequelize, DataTypes) => {
  const ShortTermMemory = sequelize.define('ShortTermMemory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
      // field: 'message_id' // if we want to map to message_id column
    },
    // conversationId FK will be added by association
    message_order: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sender_type: { // Renamed from 'sender'
      type: DataTypes.ENUM('user', 'ai', 'system'),
      allowNull: false
    },
    content: { // Was 'content'
      type: DataTypes.TEXT,
      allowNull: false
    },
    token_count: { // Was 'tokenCount'
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    timestamps: true // Manages createdAt and updatedAt. createdAt will serve as the message timestamp.
  });

  // ShortTermMemory.associate = function(models) {
  //   ShortTermMemory.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
  // };

  return ShortTermMemory;
};
