// This file is no longer used for API routes as user management is internal.
// It can be deleted or kept if any utility functions related to users (not API exposed) were to be placed here.
// For now, leaving it empty.

const userService = require('../services/user.service'); // Might still be needed by other services

const userController = {
  // No exposed controller functions for users.
  // Default user is handled internally by services.
};

module.exports = userController;
