'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const users = [
      {
        username: 'testuser1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        username: 'testuser2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        username: 'ollama_tester',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    // Check if users already exist to prevent duplicate entries if seeder runs multiple times
    // This is a simple check; more complex logic might be needed for more robust idempotency
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT username FROM "Users" WHERE username IN (:usernames)`,
      {
        replacements: { usernames: users.map(u => u.username) },
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );

    const existingUsernames = existingUsers.map(u => u.username);
    const usersToInsert = users.filter(u => !existingUsernames.includes(u.username));

    if (usersToInsert.length > 0) {
      await queryInterface.bulkInsert('Users', usersToInsert, {});
      console.log(`Seeded ${usersToInsert.length} users.`);
    } else {
      console.log('Users already seeded or no new users to seed.');
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove only the specific users seeded, or all users if that's desired.
    // For this example, we'll remove the specific users.
    const usernamesToDelete = ['testuser1', 'testuser2', 'ollama_tester'];
    await queryInterface.bulkDelete('Users', {
      username: {
        [Sequelize.Op.in]: usernamesToDelete,
      },
    }, {});
    console.log(`Removed sample users: ${usernamesToDelete.join(', ')}`);
  }
};
