const { Chat, User, Message } = require('../models');
const { Op } = require('sequelize');
const ollamaService = require('./ollama.service');
const messageService = require('./message.service');
const userService = require('./user.service'); // Import userService for default user

const chatService = {
  createChat: async () => { // No longer takes userId
    try {
      const defaultUser = await userService.getOrCreateDefaultUser();
      const newChat = await Chat.create({ userId: defaultUser.id, tokenCount: 0 });
      return newChat;
    } catch (error) {
      console.error("Error in chatService.createChat:", error);
      throw error;
    }
  },

  getChatById: async (chatId) => {
    try {
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username'] // Specify attributes to include for User
          },
          {
            model: Message,
            as: 'messages',
            order: [['timestamp', 'ASC']], // Order messages by timestamp
            attributes: ['id', 'sender', 'content', 'tokenCount', 'timestamp', 'createdAt'] // Specify attributes
          }
        ]
      });
      return chat;
    } catch (error) {
      console.error("Error in chatService.getChatById:", error);
      throw error;
    }
  },

  // Renamed from getChatsByUserId
  getChatsForDefaultUser: async () => {
    try {
        const defaultUser = await userService.getOrCreateDefaultUser();
        const chats = await Chat.findAll({
            where: { userId: defaultUser.id },
            include: [
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'sender', 'content', 'tokenCount', 'timestamp'],
                    limit: 1,
                    order: [['timestamp', 'DESC']]
                }
            ],
            order: [['updatedAt', 'DESC']]
        });
        return chats;
    } catch (error) {
        console.error("Error in chatService.getChatsForDefaultUser:", error);
        throw error;
    }
  },

  handleNewMessage: async (chatId, userMessageContent, clientHistory, ollamaModel = 'llama2') => {
    try {
      const defaultUser = await userService.getOrCreateDefaultUser(); // Still useful to ensure chat belongs to default user
      // 0. Verify chat exists and belongs to the default user
      const chat = await Chat.findOne({ where: { id: chatId, userId: defaultUser.id } });
      if (!chat) {
        throw new Error(`Chat with ID ${chatId} not found for default user.`);
      }

      // userMessageContent is the current prompt.
      // clientHistory is the array of {role, content} from the client.

      // Call Ollama service
      const ollamaResponse = await ollamaService.generateResponse(userMessageContent, clientHistory, ollamaModel);

      // Save user's message.
      // For promptTokens, ollamaResponse.promptTokens includes tokens for (clientHistory + userMessageContent).
      // This is appropriate for the user's "turn" in the context of this specific API call.
      const userMessage = await messageService.createMessage(
        chatId,
        'user',
        userMessageContent,
        ollamaResponse.promptTokens
      );

      // Save bot's response message
      const botMessage = await messageService.createMessage(
        chatId,
        'bot',
        ollamaResponse.response,
        ollamaResponse.responseTokens // Tokens for the bot's reply
      );

      // 6. Update total chat token count
      const updatedChatTokens = await messageService.updateChatTokenCount(chatId);

      return {
        userMessage,
        botMessage,
        updatedTokenCount: updatedChatTokens.totalTokens,
        ollamaFullResponse: ollamaResponse // For debugging or more detailed info if needed
      };

    } catch (error) {
      console.error("Error in chatService.handleNewMessage:", error);
      throw error;
    }
  },

  getChatsByUserId: async (userId) => {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        const chats = await Chat.findAll({
            where: { userId },
            include: [
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'sender', 'content', 'tokenCount', 'timestamp'],
                    limit: 1, // Optionally, get only the last message for a summary
                    order: [['timestamp', 'DESC']]
                }
            ],
            order: [['updatedAt', 'DESC']] // Show most recent chats first
        });
        return chats;
    } catch (error) {
        console.error("Error in chatService.getChatsByUserId:", error);
        throw error;
    }
  }
  // Add other chat-related service functions here
};

module.exports = chatService;
