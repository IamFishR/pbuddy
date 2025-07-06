const { User } = require('../models');

const userService = {
  createUser: async (username) => {
    try {
      const newUser = await User.create({ username });
      return newUser;
    } catch (error) {
      // Handle potential errors, e.g., unique constraint violation
      console.error("Error in userService.createUser:", error);
      throw error; // Re-throw to be caught by controller
    }
  },

  getUserById: async (userId) => {
    try {
      const user = await User.findByPk(userId);
      return user;
    } catch (error) {
      console.error("Error in userService.getUserById:", error);
      throw error;
    }
  }
  // Add other user-related service functions here
};

module.exports = userService;
