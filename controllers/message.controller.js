const shortTermMemoryService = require('../services/shorttermMemory.service'); // Renamed from messageService
const chatService = require('../services/chat.service');
const userService = require('../services/user.service'); // To get default user ID

const messageController = {
  handlePostMessageToChat: async (req, res, next) => {
    try {
      const { chatId: conversationIdParam } = req.params; // Renamed to conversationIdParam for clarity
      // Client should only send the current message. History is managed server-side.
      const { message: userMessageContent, model } = req.body;

      if (!userMessageContent) {
        return res.status(400).json({ message: "Field 'message' (current prompt) is required." });
      }

      const numericConversationId = parseInt(conversationIdParam, 10);
      if (isNaN(numericConversationId)) {
        return res.status(400).json({ message: "Valid numeric conversationId is required in path." });
      }

      // Get the default user's ID. In a real app with auth, this would be req.user.id.
      const defaultUser = await userService.getOrCreateDefaultUser();
      if (!defaultUser || !defaultUser.id) {
        return res.status(500).json({ message: "Could not retrieve default user."});
      }
      const userId = defaultUser.id;

      // Call the refactored chatService.handleNewMessage
      // It now expects (conversationId, userId, userMessageContent, model)
      // Client-sent history is no longer used.
      const result = await chatService.handleNewMessage(numericConversationId, userId, userMessageContent, model);
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
