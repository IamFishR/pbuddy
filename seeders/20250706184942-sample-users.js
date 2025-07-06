'use strict';

const { DEFAULT_USER_ID, DEFAULT_USERNAME } = require('../services/user.service'); // Import constants

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const defaultUser = {
      id: DEFAULT_USER_ID, // Ensure this ID is used
      username: DEFAULT_USERNAME,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Check if the default user already exists by ID or username
      const existingUserById = await queryInterface.rawSelect('Users', {
        where: { id: DEFAULT_USER_ID },
      }, ['id']);

      const existingUserByUsername = await queryInterface.rawSelect('Users', {
        where: { username: DEFAULT_USERNAME },
      }, ['id']);

      if (existingUserById && existingUserById !== DEFAULT_USER_ID) {
         console.warn(`Seed: User with ID ${DEFAULT_USER_ID} already exists but is not the intended default user, or username mismatch. Skipping seed for default user.`);
         return;
      }
      if (existingUserByUsername && existingUserByUsername !== DEFAULT_USER_ID) {
          console.warn(`Seed: User with username ${DEFAULT_USERNAME} already exists but has a different ID. Skipping seed for default user.`);
          return;
      }

      if (!existingUserById && !existingUserByUsername) {
        await queryInterface.bulkInsert('Users', [defaultUser], {
          // Ensure explicit ID insertion works if autoIncrement is also on the model.
          // For bulkInsert, Sequelize usually handles this if `id` is provided and is a PK.
        });
        console.log(`Seeded default user: ${DEFAULT_USERNAME} with ID ${DEFAULT_USER_ID}.`);
      } else {
        console.log(`Default user ${DEFAULT_USERNAME} (ID: ${DEFAULT_USER_ID}) already exists or there's a conflict. Seed skipped.`);
      }
    } catch (error) {
      console.error(`Error seeding default user: ${error.message}`);
      // If username must be unique and it already exists with a different ID, this can fail.
      // Or if ID must be unique and it's taken by a different user.
      // The rawSelect and checks above try to mitigate this.
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove only the default user if it matches both ID and username
    try {
      await queryInterface.bulkDelete('Users', {
        id: DEFAULT_USER_ID,
        username: DEFAULT_USERNAME,
      }, {});
      console.log(`Removed default user: ${DEFAULT_USERNAME} (ID: ${DEFAULT_USER_ID}).`);
    } catch (error) {
      console.error(`Error removing default user: ${error.message}`);
    }
  }
};
