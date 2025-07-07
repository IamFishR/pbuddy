'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Rename existing tables first
      // Note: Foreign key constraints might need to be dropped and re-added explicitly if renaming causes issues.
      // Assuming for now that the DB handles renaming gracefully or tables are empty/constraints deferred.
      await queryInterface.renameTable('Messages', 'ShortTermMemories', { transaction });
      await queryInterface.renameTable('Chats', 'Conversations', { transaction });

      // Modify Conversations table (formerly Chats)
      await queryInterface.addColumn('Conversations', 'title', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('Conversations', 'status', { type: Sequelize.ENUM('active', 'archived', 'ended'), defaultValue: 'active', allowNull: false }, { transaction });
      await queryInterface.addColumn('Conversations', 'last_activity_at', { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW'), allowNull: false }, { transaction });

      // Check if 'tokenCount' column exists before trying to remove it
      const conversationTableDescription = await queryInterface.describeTable('Conversations', { transaction });
      if (conversationTableDescription.tokenCount) {
        await queryInterface.removeColumn('Conversations', 'tokenCount', { transaction });
      }

      // Modify ShortTermMemories table (formerly Messages)
      // Drop the old foreign key constraint from Messages(chatId) to Chats(id)
      // The default constraint name might vary. Common patterns: Messages_chatId_fkey, chatId_foreign_idx
      // This is the trickiest part. If this fails, the migration might need manual DB intervention or more specific constraint name.
      try {
        // Attempt to remove constraint by convention (table_column_foreign_key_suffix or similar)
        // This is a common pattern but not guaranteed.
        await queryInterface.removeConstraint('ShortTermMemories', 'Messages_chatId_fkey', { transaction });
      } catch (e) {
        console.warn("Could not drop constraint 'Messages_chatId_fkey' on ShortTermMemories. It might not exist or have a different name. Continuing...");
        // If the constraint name is unknown, this step might be skipped, and renaming column + adding new constraint might still work
        // or fail if the old constraint is still active on the old column name.
      }

      await queryInterface.renameColumn('ShortTermMemories', 'chatId', 'conversationId', { transaction });

      // Add new foreign key from ShortTermMemories(conversationId) to Conversations(id)
      await queryInterface.addConstraint('ShortTermMemories', {
        fields: ['conversationId'],
        type: 'foreign key',
        name: 'FK_ShortTermMemories_Conversation', // Explicitly named constraint
        references: { table: 'Conversations', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addColumn('ShortTermMemories', 'message_order', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, { transaction });

      // Modify 'sender' ENUM and rename to 'sender_type'
      // For MySQL:
      await queryInterface.changeColumn('ShortTermMemories', 'sender', { type: Sequelize.ENUM('user', 'ai', 'system'), allowNull: false }, { transaction });
      await queryInterface.renameColumn('ShortTermMemories', 'sender', 'sender_type', { transaction });
      // For PostgreSQL, this would require more complex raw SQL (dropping constraint, altering type, re-adding constraint)
      // For SQLite, this is not directly possible (new table, copy, drop, rename).

      await queryInterface.addColumn('ShortTermMemories', 'metadata', { type: Sequelize.JSON, allowNull: true }, { transaction });

      const shortTermMemoryTableDescription = await queryInterface.describeTable('ShortTermMemories', { transaction });
      if (shortTermMemoryTableDescription.timestamp) {
        await queryInterface.removeColumn('ShortTermMemories', 'timestamp', { transaction }); // Rely on createdAt
      }

      // Create Reflections table (before LongTermMemories due to FK)
      await queryInterface.createTable('Reflections', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        reflection_text: { type: Sequelize.TEXT, allowNull: false },
        triggering_message_ids: { type: Sequelize.JSON, allowNull: false },
        status: { type: Sequelize.ENUM('pending', 'processed', 'archived'), defaultValue: 'pending', allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      // Create LongTermMemories table
      await queryInterface.createTable('LongTermMemories', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        memory_text: { type: Sequelize.TEXT, allowNull: false },
        embedding: { type: Sequelize.TEXT('long'), allowNull: false, comment: "Stores JSON string representation of a float array for the embedding." },
        memory_type: { type: Sequelize.ENUM('fact', 'preference', 'goal', 'synthesized', 'observation'), allowNull: false },
        importance_score: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0.5 },
        source_message_ids: { type: Sequelize.JSON, allowNull: true },
        sourceReflectionId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Reflections', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        last_accessed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      console.error("Migration failed:", err);
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    // Reverting this migration is complex and data loss is possible.
    // This 'down' is a simplified attempt and might need manual adjustments.
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('LongTermMemories', { transaction });
      await queryInterface.dropTable('Reflections', { transaction });

      // Revert ShortTermMemories changes (simplified)
      await queryInterface.addColumn('ShortTermMemories', 'timestamp', { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }, { transaction });
      await queryInterface.removeColumn('ShortTermMemories', 'metadata', { transaction });
      await queryInterface.renameColumn('ShortTermMemories', 'sender_type', 'sender', { transaction });
      await queryInterface.changeColumn('ShortTermMemories', 'sender', { type: Sequelize.ENUM('user', 'bot'), allowNull: false }, { transaction }); // Revert ENUM
      await queryInterface.removeColumn('ShortTermMemories', 'message_order', { transaction });

      // Revert conversationId FK and rename
      await queryInterface.removeConstraint('ShortTermMemories', 'FK_ShortTermMemories_Conversation', { transaction });
      await queryInterface.renameColumn('ShortTermMemories', 'conversationId', 'chatId', { transaction });
      // Re-add old FK from Messages(chatId) to Chats(id) - requires Chats table to exist with that name.

      // Revert Conversations changes (simplified)
      await queryInterface.addColumn('Conversations', 'tokenCount', { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false }, { transaction });
      await queryInterface.removeColumn('Conversations', 'last_activity_at', { transaction });
      await queryInterface.removeColumn('Conversations', 'status', { transaction });
      await queryInterface.removeColumn('Conversations', 'title', { transaction });

      // Rename tables back
      await queryInterface.renameTable('ShortTermMemories', 'Messages', { transaction });
      await queryInterface.renameTable('Conversations', 'Chats', { transaction });

      // Re-add original FK from Messages(chatId) to Chats(id)
      // This assumes 'Messages' and 'Chats' tables now exist again.
      await queryInterface.addConstraint('Messages', { // Now 'Messages' table
        fields: ['chatId'],
        type: 'foreign key',
        name: 'Messages_chatId_fkey', // Assuming this was the original name or similar
        references: { table: 'Chats', field: 'id' }, // Now 'Chats' table
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });


      await transaction.commit();
    } catch (err) {
      console.error("Down migration failed:", err);
      await transaction.rollback();
      throw err;
    }
  }
};
