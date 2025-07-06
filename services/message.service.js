const { Message, Chat } = require('../models');
const { Sequelize } = require('sequelize');

const messageService = {
  createMessage: async (chatId, sender, content, tokenCount) => {
    try {
      const message = await Message.create({
        chatId,
        sender,
        content,
        tokenCount,
        timestamp: new Date() // Explicitly set timestamp
      });
      return message;
    } catch (error) {
      console.error("Error in messageService.createMessage:", error);
      throw error;
    }
  },

  getMessagesByChatId: async (chatId) => {
    try {
      const messages = await Message.findAll({
        where: { chatId },
        order: [['timestamp', 'ASC']]
      });
      return messages;
    } catch (error) {
      console.error("Error in messageService.getMessagesByChatId:", error);
      throw error;
    }
  },

  updateChatTokenCount: async (chatId) => {
    try {
      const result = await Message.findAll({
        where: { chatId },
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('tokenCount')), 'totalTokens']
        ],
        raw: true // Get plain JSON results
      });

      const totalTokens = result[0] && result[0].totalTokens ? parseInt(result[0].totalTokens, 10) : 0;

      await Chat.update({ tokenCount: totalTokens }, { where: { id: chatId } });
      console.log(`Service: Updated token count for chat ${chatId} to ${totalTokens}`);
      return { chatId, totalTokens };
    } catch (error) {
      console.error("Error in messageService.updateChatTokenCount:", error);
      throw error;
    }
  },

  /**
   * Prepares chat history for Ollama, ensuring it fits within a token limit.
   * For now, it just formats. Token limiting to be added if needed.
   * @param {number} chatId
   * @returns {Promise<Array<{role: 'user' | 'assistant', content: string}>>}
   */
  getFormattedChatHistoryForOllama: async (chatId, currentTokenLimit = 4000) => {
    // This is a simplified version. A more robust version would:
    // 1. Fetch messages ordered by timestamp DESC.
    // 2. Add messages to history, summing their tokenCounts, until the limit is approached.
    // 3. Reverse the history to be chronological for Ollama.
    const messages = await Message.findAll({
      where: { chatId },
      order: [['timestamp', 'ASC']], // Fetch in chronological order
      attributes: ['sender', 'content', 'tokenCount']
    });

    let accumulatedTokens = 0;
    const history = [];

    // Iterate backwards to prioritize recent messages if truncation is needed
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (accumulatedTokens + msg.tokenCount <= currentTokenLimit) {
            history.unshift({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.content });
            accumulatedTokens += msg.tokenCount;
        } else {
            // Stop adding messages if token limit is exceeded by the next message
            // console.log(`Token limit reached for chat ${chatId}. Truncating history.`);
            break;
        }
    }
    // The history is already in correct chronological order due to unshift and iterating backwards
    // If iterated forwards and pushed, would need a .reverse() here.
    return history;
  }
};

module.exports = messageService;
