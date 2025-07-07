// models/longtermMemory.model.js
module.exports = (sequelize, DataTypes) => {
  const LongTermMemory = sequelize.define('LongTermMemory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
      // field: 'memory_id'
    },
    // userId FK will be added by association
    memory_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    embedding: {
      type: DataTypes.TEXT('long'), // Using TEXT('long') for potentially large JSON strings
      allowNull: false,
      comment: "Stores JSON string representation of a float array for the embedding."
    },
    memory_type: {
      type: DataTypes.ENUM('fact', 'preference', 'goal', 'synthesized', 'observation'),
      allowNull: false
    },
    importance_score: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.5,
      validate: {
        min: 0.0,
        max: 1.0
      }
    },
    source_message_ids: { // Storing array of ShortTermMemory message IDs
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of ShortTermMemory IDs that contributed to this memory."
    },
    // source_reflection_id FK will be added by association
    last_accessed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true
  });

  // LongTermMemory.associate = function(models) {
  //   LongTermMemory.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  //   LongTermMemory.belongsTo(models.Reflection, { foreignKey: 'sourceReflectionId', as: 'sourceReflection', allowNull: true });
  //   // Note: source_message_ids is JSON, not a direct FK. Relationship is informational.
  // };

  return LongTermMemory;
};
