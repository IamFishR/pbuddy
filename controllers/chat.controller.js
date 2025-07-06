const chatService = require('../services/chat.service');

const chatController = {
  handleCreateChat: async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "userId is required to create a chat" });
      }
      const numericUserId = parseInt(userId, 10);
      if (isNaN(numericUserId)) {
          return res.status(400).json({ message: "Valid numeric userId is required" });
      }

      const newChat = await chatService.createChat(numericUserId);
      res.status(201).json(newChat);
    } catch (error) {
      console.error("Controller (Chat - Create):", error.message);
      if (error.message.toLowerCase().includes("not found")) {
        error.statusCode = 404;
      }
      next(error);
    }
  },

  handleGetChatById: async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const numericChatId = parseInt(chatId, 10);
      if (isNaN(numericChatId)) {
        return res.status(400).json({ message: "Valid numeric chatId is required in path." });
      }
      const chat = await chatService.getChatById(numericChatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.status(200).json(chat);
    } catch (error) {
      console.error("Controller (Chat - GetById):", error.message);
      next(error);
    }
  },

  handleGetChatsByUserId: async (req, res, next) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId, 10);
        if (isNaN(numericUserId)) {
            return res.status(400).json({ message: "Valid numeric User ID is required in path." });
        }
        const chats = await chatService.getChatsByUserId(numericUserId);
        res.status(200).json(chats); // Service returns empty array if no chats, or throws if user not found
    } catch (error) {
        console.error("Controller (Chat - GetByUserId):", error.message);
        if (error.message.toLowerCase().includes("not found")) {
            error.statusCode = 404;
        }
        next(error);
    }
  }
  // Message handling is in message.controller.js
};

module.exports = chatController;
