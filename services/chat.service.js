const { Chat, User, Message } = require('../models');
const { Op } = require('sequelize');
const ollamaService = require('./ollama.service');
const messageService = require('./message.service');

const chatService = {
  createChat: async (userId) => {
    try {
      // Verify user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }
      const newChat = await Chat.create({ userId, tokenCount: 0 });
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

  handleNewMessage: async (chatId, userId, userMessageContent, ollamaModel = 'llama2') => {
    try {
      // 0. Verify chat exists and belongs to user (optional, depends on how chatId is obtained)
      const chat = await Chat.findOne({ where: { id: chatId, userId: userId } });
      if (!chat) {
        throw new Error(`Chat with ID ${chatId} not found for user ${userId}.`);
      }

      // 1. Estimate or get token count for user's message (crude estimation for now)
      // A more accurate token counter (like tiktoken for OpenAI models) would be better.
      // For Ollama, the actual token count is returned in the response, so we save user message with estimated, then update.
      // Or, we can send user message to ollama, get prompt_tokens, then save.
      // Let's assume a simple character count for now or use 0 and update later.
      // For simplicity, we'll use the prompt_eval_count from Ollama for the user message.

      // 2. Get formatted chat history for Ollama
      const history = await messageService.getFormattedChatHistoryForOllama(chatId);

      // 3. Call Ollama service
      // The userMessageContent is the "currentPrompt"
      const ollamaResponse = await ollamaService.generateResponse(userMessageContent, history, ollamaModel);

      // 4. Save user's message with token count from Ollama's prompt_eval_count
      const userMessage = await messageService.createMessage(
        chatId,
        'user',
        userMessageContent,
        ollamaResponse.promptTokens // Tokens for the user's message and history combined
      );

      // 5. Save bot's response message with token count from Ollama's eval_count
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
