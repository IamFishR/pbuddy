// models/reflection.model.js
module.exports = (sequelize, DataTypes) => {
  const Reflection = sequelize.define('Reflection', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
      // field: 'reflection_id'
    },
    // userId FK will be added by association
    reflection_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    triggering_message_ids: { // Storing array of ShortTermMemory message IDs
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Array of ShortTermMemory IDs that prompted this reflection."
    },
    status: {
      type: DataTypes.ENUM('pending', 'processed', 'archived'),
      defaultValue: 'pending',
      allowNull: false
    }
    // generated_ltm_id FK will be added by association (if a reflection directly creates one LTM)
    // This implies a one-to-one or one-to-many (if one reflection generates many LTMs)
    // For now, an LTM can link to a sourceReflectionId.
    // A reflection could also generate multiple LTMs.
    // If a reflection generates ONE LTM, this FK is fine.
    // If it can generate multiple, then LTM.sourceReflectionId is the way.
    // Let's assume LTM.sourceReflectionId is sufficient.
  }, {
    timestamps: true
  });

  // Reflection.associate = function(models) {
  //   Reflection.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  //   // A reflection might lead to one or more LTM entries.
  //   // The LTM table has a sourceReflectionId. So, Reflection hasMany LongTermMemory.
  //   Reflection.hasMany(models.LongTermMemory, { foreignKey: 'sourceReflectionId', as: 'generatedMemories'});
  // };

  return Reflection;
};
