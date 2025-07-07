'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    // Helper function to check if a table exists
    const tableExists = async (tableName) => {
      try {
        await queryInterface.describeTable(tableName, { transaction });
        return true;
      } catch (e) {
        return false;
      }
    };

    try {
      const usersTableExists = await tableExists('Users');
      if (!usersTableExists) {
        throw new Error("Migration failed: 'Users' table does not exist. Ensure the initial migration is executed first.");
      }

      const messagesTableExists = await tableExists('Messages');
      const chatsTableExists = await tableExists('Chats');

      if (messagesTableExists) {
        console.log("Migration: 'Messages' table exists. Proceeding to rename to 'ShortTermMemories'.");
        await queryInterface.renameTable('Messages', 'ShortTermMemories', { transaction });
      } else {
        console.log("Migration: 'Messages' table does not exist. Skipping rename. 'ShortTermMemories' might be created by an earlier migration or needs to be created if this is a fresh setup with this migration as primary.");
        // If 'ShortTermMemories' should be created here if 'Messages' didn't exist,
        // a createTable('ShortTermMemories', ...) would be needed.
        // This migration is primarily for ALTERING, so this path implies an issue with prior migration state.
      }

      if (chatsTableExists) {
        console.log("Migration: 'Chats' table exists. Proceeding to rename to 'Conversations'.");
        await queryInterface.renameTable('Chats', 'Conversations', { transaction });
      } else {
        console.log("Migration: 'Chats' table does not exist. Skipping rename. 'Conversations' might be created by an earlier migration or needs to be created.");
      }

      // Modify Conversations table (formerly Chats)
      // These operations should only run if 'Conversations' table now exists (either renamed or created prior)
      const conversationsTableNowExists = await tableExists('Conversations');
      if (conversationsTableNowExists) {
        console.log("Migration: Modifying 'Conversations' table.");
        await queryInterface.addColumn('Conversations', 'title', { type: Sequelize.STRING, allowNull: true }, { transaction });
        await queryInterface.addColumn('Conversations', 'status', { type: Sequelize.ENUM('active', 'archived', 'ended'), defaultValue: 'active', allowNull: false }, { transaction });
        await queryInterface.addColumn('Conversations', 'last_activity_at', { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW'), allowNull: false }, { transaction });

        const conversationTableDescription = await queryInterface.describeTable('Conversations', { transaction });
        if (conversationTableDescription.tokenCount) {
          await queryInterface.removeColumn('Conversations', 'tokenCount', { transaction });
        }
      } else {
        console.log("Migration: 'Conversations' table does not exist. Skipping modifications to it.");
      }

      // Modify ShortTermMemories table (formerly Messages)
      // These operations should only run if 'ShortTermMemories' table now exists
      const shortTermMemoriesTableNowExists = await tableExists('ShortTermMemories');
      if (shortTermMemoriesTableNowExists) {
        console.log("Migration: Modifying 'ShortTermMemories' table.");
        // Drop the old foreign key constraint from Messages(chatId) to Chats(id)
        // This part is tricky as constraint names vary. We'll try to remove it if it exists.
        // This assumes the original constraint was on the 'Messages' table.
        // If 'Messages' was renamed to 'ShortTermMemories', the constraint was carried over.
        if (messagesTableExists) { // Only try to remove old FK if Messages table actually existed and was renamed
            try {
                await queryInterface.removeConstraint('ShortTermMemories', 'Messages_chatId_fkey', { transaction });
            } catch (e) {
                console.warn("Could not drop constraint 'Messages_chatId_fkey' on ShortTermMemories. It might not exist or have a different name. This is often okay.");
            }
        }

        // Rename 'chatId' to 'conversationId' only if 'chatId' column exists
        const stmDesc = await queryInterface.describeTable('ShortTermMemories', { transaction });
        if (stmDesc.chatId) {
            await queryInterface.renameColumn('ShortTermMemories', 'chatId', 'conversationId', { transaction });
        } else if (!stmDesc.conversationId) {
            // If neither chatId nor conversationId exists, but table does, this is an unexpected state.
            // For now, we assume if chatId isn't there, conversationId might be from a different path.
            console.warn("Migration: 'chatId' column not found on 'ShortTermMemories'. Skipping rename to 'conversationId'.");
        }

        // Add new foreign key from ShortTermMemories(conversationId) to Conversations(id)
        // Only if Conversations table exists and ShortTermMemories has conversationId column
        if (conversationsTableNowExists && (await queryInterface.describeTable('ShortTermMemories', { transaction })).conversationId) {
            await queryInterface.addConstraint('ShortTermMemories', {
                fields: ['conversationId'],
                type: 'foreign key',
                name: 'FK_ShortTermMemories_Conversation',
                references: { table: 'Conversations', field: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                transaction
            });
        } else {
            console.warn("Migration: Skipping adding FK from ShortTermMemories to Conversations due to missing table/column.");
        }

        await queryInterface.addColumn('ShortTermMemories', 'message_order', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, { transaction });

        // Modify 'sender' ENUM and rename to 'sender_type'
        // This assumes 'sender' column exists from the old 'Messages' table schema
        if (stmDesc.sender) {
            await queryInterface.changeColumn('ShortTermMemories', 'sender', { type: Sequelize.ENUM('user', 'ai', 'system'), allowNull: false }, { transaction });
            await queryInterface.renameColumn('ShortTermMemories', 'sender', 'sender_type', { transaction });
        } else if (!stmDesc.sender_type) {
            // If 'sender' doesn't exist, maybe 'sender_type' already does or it's a fresh schema part.
            console.warn("Migration: 'sender' column not found on 'ShortTermMemories'. Skipping ENUM change and rename to 'sender_type'.");
        }


        await queryInterface.addColumn('ShortTermMemories', 'metadata', { type: Sequelize.JSON, allowNull: true }, { transaction });

        const currentStmDesc = await queryInterface.describeTable('ShortTermMemories', { transaction });
        if (currentStmDesc.timestamp) {
          await queryInterface.removeColumn('ShortTermMemories', 'timestamp', { transaction });
        }
      } else {
        console.log("Migration: 'ShortTermMemories' table does not exist. Skipping modifications to it.");
      }

      // Create Reflections table (unconditional, as it's a new table)
      console.log("Migration: Creating 'Reflections' table.");
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
