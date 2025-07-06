const userService = require('../services/user.service');

const userController = {
  handleCreateUser: async (req, res, next) => {
    try {
      const { username } = req.body;
      if (!username) {
        // Client error, handled directly
        return res.status(400).json({ message: "Username is required" });
      }
      const newUser = await userService.createUser(username);
      res.status(201).json(newUser);
    } catch (error) {
      // Log the error with controller context
      console.error("Controller (User - Create):", error.message);
      // Specific error for unique constraint - handled by global handler now or can be specific here
      if (error.name === 'SequelizeUniqueConstraintError') {
         // Let global handler format it, but set a specific status
        error.statusCode = 409;
        error.message = error.message || "Username already exists."; // Override default if needed
      }
      next(error); // Pass to global error handler
    }
  },

  handleGetUserById: async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await userService.getUserById(userId);
      if (!user) {
        // Client error (resource not found), handled directly
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json(user);
    } catch (error) {
      console.error("Controller (User - GetById):", error.message);
      next(error); // Pass to global error handler
    }
  }
  // Add other user-related controller functions here
};

module.exports = userController;
