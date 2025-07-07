// models/user.model.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING, // VARCHAR(255) by default
      allowNull: false,
      unique: true
    }
  }, {
    // Let Sequelize manage createdAt and updatedAt
    timestamps: true
  });

  // Associations will be defined in models/index.js
  // User.associate = function(models) {
  //   User.hasMany(models.Conversation, { foreignKey: 'userId', as: 'conversations' });
  // };

  return User;
};
