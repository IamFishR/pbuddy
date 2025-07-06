const { User } = require('../models');

const DEFAULT_USER_ID = 1;
const DEFAULT_USERNAME = 'default_user';

const userService = {
  DEFAULT_USER_ID, // Export for use in other services if needed directly
  DEFAULT_USERNAME,

  getOrCreateDefaultUser: async () => {
    try {
      let user = await User.findByPk(DEFAULT_USER_ID);
      if (!user) {
        console.log(`Default user (ID: ${DEFAULT_USER_ID}) not found. Creating...`);
        user = await User.create({
          id: DEFAULT_USER_ID, // Explicitly set ID
          username: DEFAULT_USERNAME,
          // createdAt and updatedAt will be set by Sequelize
        });
        console.log(`Default user "${DEFAULT_USERNAME}" with ID ${DEFAULT_USER_ID} created.`);
      } else {
        // console.log(`Default user (ID: ${DEFAULT_USER_ID}, Username: ${user.username}) found.`);
        // Ensure username matches, though findByPk should be sufficient if ID is primary key and unique.
        if (user.username !== DEFAULT_USERNAME) {
            console.warn(`Warning: User with ID ${DEFAULT_USER_ID} exists but has username '${user.username}' instead of expected '${DEFAULT_USERNAME}'.`);
            // Optionally update username here if strict consistency is required:
            // user.username = DEFAULT_USERNAME;
            // await user.save();
        }
      }
      return user;
    } catch (error) {
      // Handle potential errors, e.g., unique constraint violation if ID is not properly managed
      // or if username unique constraint conflicts during creation (less likely if ID is fixed)
      console.error("Error in userService.getOrCreateDefaultUser:", error);
      // If this fails, the app might not function correctly. Consider how to handle critical failure.
      throw new Error(`Failed to get or create default user: ${error.message}`);
    }
  },

  // We can remove createUser and getUserById if they are no longer exposed via API
  // For now, let's keep them commented in case any internal service still relies on them,
  // but they won't be used by controllers directly for API exposure.
  /*
  createUser: async (username) => {
    // This should not be called if we only have a default user managed internally
    console.warn("userService.createUser called - this should not happen with default user setup.");
    // ... old implementation ...
  },

  getUserById: async (userId) => {
    // This might still be useful internally or for debugging
    try {
      const user = await User.findByPk(userId);
      return user;
    } catch (error) {
      console.error("Error in userService.getUserById:", error);
      throw error;
    }
  }
  */
};

// Ensure default user is checked/created on service load (optional, alternative to lazy creation)
// (async () => {
//   try {
//     await userService.getOrCreateDefaultUser();
//   } catch (error) {
//     console.error("Failed to initialize default user on service load:", error);
//     // Depending on severity, you might want to process.exit(1) here
//   }
// })();


module.exports = userService;
