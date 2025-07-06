const chatService = require('../services/chat.service');

const chatController = {
  handleCreateChat: async (req, res, next) => { // userId no longer in req.body
    try {
      // const { userId } = req.body; // Removed
      // if (!userId) { // Removed
      //   return res.status(400).json({ message: "userId is required to create a chat" });
      // }
      // const numericUserId = parseInt(userId, 10); // Removed
      // if (isNaN(numericUserId)) { // Removed
      //     return res.status(400).json({ message: "Valid numeric userId is required" });
      // }

      const newChat = await chatService.createChat(); // No userId passed
      res.status(201).json(newChat);
    } catch (error) {
      console.error("Controller (Chat - Create):", error.message);
      // "not found" for user should be handled by getOrCreateDefaultUser,
      // but if it throws for other reasons:
      if (error.message.toLowerCase().includes("not found")) {
        error.statusCode = 404; // Should ideally not happen if default user logic is robust
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
      // TODO: Ensure this chat belongs to the default user if direct access by ID is sensitive.
      // For now, getChatById doesn't restrict by user.
      const chat = await chatService.getChatById(numericChatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      // We might want to add a check here: if (chat.userId !== userService.DEFAULT_USER_ID) return res.status(403).json...
      res.status(200).json(chat);
    } catch (error) {
      console.error("Controller (Chat - GetById):", error.message);
      next(error);
    }
  },

  // Changed from handleGetChatsByUserId
  handleGetChatsForDefaultUser: async (req, res, next) => {
    try {
        // const { userId } = req.params; // Removed
        // const numericUserId = parseInt(userId, 10); // Removed
        // if (isNaN(numericUserId)) { // Removed
        //     return res.status(400).json({ message: "Valid numeric User ID is required in path." });
        // }
        const chats = await chatService.getChatsForDefaultUser(); // Service method updated
        res.status(200).json(chats);
    } catch (error) {
        console.error("Controller (Chat - GetForDefaultUser):", error.message);
        // "not found" for user should be handled by getOrCreateDefaultUser
        if (error.message.toLowerCase().includes("not found")) {
            error.statusCode = 404; // Should ideally not happen
        }
        next(error);
    }
  }
  // Message handling is in message.controller.js
};

module.exports = chatController;
