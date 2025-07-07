const { ShortTermMemory, Conversation } = require('../models'); // Updated models
const { Sequelize, Op } = require('sequelize'); // Op needed for queries like MAX

const shortTermMemoryService = {
  /**
   * Adds a new message to the short-term memory for a conversation.
   * @param {number} conversationId - The ID of the conversation.
   * @param {string} senderType - 'user', 'ai', or 'system'.
   * @param {string} content - The text content of the message.
   * @param {number} tokenCount - The number of tokens in the content.
   * @param {object} [metadata=null] - Optional metadata for the message.
   * @returns {Promise<ShortTermMemory>} The created message object.
   */
  addMessage: async (conversationId, senderType, content, tokenCount, metadata = null) => {
    try {
      // Determine message_order
      const lastMessage = await ShortTermMemory.findOne({
        where: { conversationId },
        order: [['message_order', 'DESC']],
        attributes: ['message_order']
      });
      const messageOrder = lastMessage ? lastMessage.message_order + 1 : 1;

      const message = await ShortTermMemory.create({
        conversationId,
        message_order: messageOrder,
        sender_type: senderType,
        content,
        token_count: tokenCount,
        metadata
      });

      // Update conversation's last_activity_at
      // Ensure Conversation model is correctly imported and available
      if (Conversation) {
        await Conversation.update(
          { last_activity_at: new Date() },
          { where: { id: conversationId } }
        );
      } else {
        console.warn("Conversation model not available for updating last_activity_at");
      }


      return message;
    } catch (error) {
      console.error("Error in shortTermMemoryService.addMessage:", error);
      throw error;
    }
  },

  /**
   * Retrieves all messages for a given conversation ID, ordered by message_order.
   * @param {number} conversationId - The ID of the conversation.
   * @returns {Promise<Array<ShortTermMemory>>} Array of messages.
   */
  getMessagesByConversationId: async (conversationId) => {
    try {
      const messages = await ShortTermMemory.findAll({
        where: { conversationId },
        order: [['message_order', 'ASC']]
      });
      return messages;
    } catch (error) {
      console.error("Error in shortTermMemoryService.getMessagesByConversationId:", error);
      throw error;
    }
  },

  /**
   * Prepares chat history for Ollama, ensuring it fits within a token limit.
   * Prioritizes recent messages.
   * @param {number} conversationId
   * @param {number} [contextTokenLimit=4000] - Max tokens for the history context.
   * @returns {Promise<Array<{role: 'user' | 'assistant' | 'system', content: string}>>}
   */
  getFormattedHistoryForOllama: async (conversationId, contextTokenLimit = 4000) => {
    // Fetch messages in chronological order (ASC) to process them from oldest to newest if needed,
    // but we will iterate backwards to select the most recent ones fitting the token limit.
    const messages = await ShortTermMemory.findAll({
      where: { conversationId },
      order: [['message_order', 'ASC']],
      attributes: ['sender_type', 'content', 'token_count']
    });

    let accumulatedTokens = 0;
    const history = [];

    // Iterate backwards through all messages of the conversation
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        // Ensure msg.token_count is a non-negative number
        const messageTokens = (typeof msg.token_count === 'number' && msg.token_count > 0) ? msg.token_count : 0;

        if (accumulatedTokens + messageTokens <= contextTokenLimit) {
            let role;
            if (msg.sender_type === 'user') {
                role = 'user';
            } else if (msg.sender_type === 'ai') {
                role = 'assistant';
            } else if (msg.sender_type === 'system') {
                // System messages might be handled differently or prepended.
                // For typical chat history, they might be included if they are part of the flow.
                role = 'system';
            } else {
                console.warn(`Unknown sender_type: ${msg.sender_type} for message in conversation ${conversationId}`);
                continue; // Skip unknown sender types
            }
            history.unshift({ role, content: msg.content }); // Add to the beginning to maintain chronological order
            accumulatedTokens += messageTokens;
        } else {
            // Stop if adding the current message (from past) would exceed the token limit
            // console.log(`Token limit reached for conversation ${conversationId}. History includes ${history.length} messages with ${accumulatedTokens} tokens.`);
            break;
        }
    }
    return history; // `history` is now in chronological order [oldest_included, ..., newest_included]
  }
};

module.exports = shortTermMemoryService;
