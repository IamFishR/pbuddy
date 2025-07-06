const messageService = require('../services/message.service');
const chatService = require('../services/chat.service'); // For handleNewMessage orchestrator

const messageController = {
  handlePostMessageToChat: async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const { userId, content, model } = req.body;

      if (!userId || !content) {
        return res.status(400).json({ message: "userId and content are required to post a message." });
      }

      const numericChatId = parseInt(chatId, 10);
      const numericUserId = parseInt(userId, 10);

      if (isNaN(numericChatId) || isNaN(numericUserId)) {
        return res.status(400).json({ message: "Valid numeric chatId and userId are required." });
      }

      const result = await chatService.handleNewMessage(numericChatId, numericUserId, content, model);
      res.status(201).json(result);
    } catch (error) {
      console.error("Controller (Message - PostToChat):", error.message);
      if (error.message.toLowerCase().includes("not found")) {
        error.statusCode = 404;
      } else if (error.message.toLowerCase().includes("ollama") || error.message.toLowerCase().includes("ai service")) {
        error.statusCode = 503; // Service Unavailable for AI backend issues
        error.message = error.message || "Error communicating with AI service.";
      }
      next(error);
    }
  },

  handleGetMessagesForChat: async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const numericChatId = parseInt(chatId, 10);
      if (isNaN(numericChatId)) {
        return res.status(400).json({ message: "Valid numeric chatId is required." });
      }

      const messages = await messageService.getMessagesByChatId(numericChatId);
      // messageService.getMessagesByChatId returns an array.
      // If the chat doesn't exist or has no messages, it will be an empty array.
      // This is generally fine, so no specific "not found" check needed here unless
      // we want to differentiate between "empty chat" and "chat does not exist".
      // For the latter, an additional check on Chat model would be required.
      res.status(200).json(messages);
    } catch (error) {
      console.error("Controller (Message - GetForChat):", error.message);
      next(error);
    }
  }
};

module.exports = messageController;
