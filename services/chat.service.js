const { Conversation, User, ShortTermMemory } = require('../models'); // Updated model names
const { Op } = require('sequelize');
const ollamaService = require('./ollama.service');
const shortTermMemoryService = require('./shorttermMemory.service'); // Renamed
const longtermMemoryService = require('./longtermMemory.service'); // Added
const reflectionService = require('./reflection.service'); // Added
const userService = require('./user.service');
const tokenizerService = require('./tokenizer.service'); // Import the new service

const DEFAULT_LLM_MODEL = 'gemma:2b'; // Default model for chat operations
const EMBEDDING_MODEL = 'nomic-embed-text'; // Default for embeddings
const CONTEXT_TOKEN_LIMIT = 4096; // Max tokens for LLM context (history + LTMs + current prompt)
const REFLECTION_TRIGGER_COUNT = 5; // Trigger reflection every N user/AI message pairs

const chatService = {
  /**
   * Creates a new conversation for the default user.
   * @async
   * @returns {Promise<Conversation>} The newly created conversation object.
   * @throws {Error} If user retrieval or conversation creation fails.
   */
  createConversation: async () => { // Renamed from createChat
    try {
      const defaultUser = await userService.getOrCreateDefaultUser();
      // tokenCount removed from Conversation model
      const newConversation = await Conversation.create({ userId: defaultUser.id });
      return newConversation;
    } catch (error) {
      console.error("Error in chatService.createConversation:", error);
      throw error;
    }
  },

  getConversationById: async (conversationId) => { // Renamed from getChatById
    try {
      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          {
            model: ShortTermMemory,
            as: 'messages', // Alias defined in Conversation model associations
            order: [['message_order', 'ASC']], // Use message_order
            attributes: ['id', 'sender_type', 'content', 'token_count', 'message_order', 'createdAt']
          }
        ]
      });
      return conversation;
    } catch (error) {
      console.error("Error in chatService.getConversationById:", error);
      throw error;
    }
  },

  getConversationsForDefaultUser: async () => { // Renamed from getChatsForDefaultUser
    try {
        const defaultUser = await userService.getOrCreateDefaultUser();
        const conversations = await Conversation.findAll({
            where: { userId: defaultUser.id },
            include: [
                {
                    model: ShortTermMemory,
                    as: 'messages',
                    attributes: ['id', 'sender_type', 'content', 'token_count', 'message_order', 'createdAt'],
                    limit: 1,
                    order: [['message_order', 'DESC']]
                }
            ],
            order: [['last_activity_at', 'DESC']] // Use last_activity_at
        });
        return conversations;
    } catch (error) {
        console.error("Error in chatService.getConversationsForDefaultUser:", error);
        throw error;
    }
  },

  handleNewMessage: async (conversationId, userId, userMessageContent, ollamaModel = DEFAULT_LLM_MODEL) => {
    try {
      // 0. Verify conversation exists and belongs to the user
      const conversation = await Conversation.findOne({ where: { id: conversationId, userId: userId } });
      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found for user ID ${userId}.`);
      }

      // 1. Tokenize and store user message
      const userMessageTokenCount = await tokenizerService.countTokens(userMessageContent, ollamaModel);
      const storedUserMessage = await shortTermMemoryService.addMessage(
        conversationId,
        'user',
        userMessageContent,
        userMessageTokenCount
      );

      // 2. Retrieve Long-Term Memories
      const relevantLTMs = await longtermMemoryService.findRelevantMemories(
        userId,
        userMessageContent,
        3, // topN LTMs
        EMBEDDING_MODEL
      );
      let ltmContextString = "";
      if (relevantLTMs.length > 0) {
        ltmContextString = "You recall the following relevant information about the user or past topics:\n" +
          relevantLTMs.map(mem => `- ${mem.memory_text} (Importance: ${mem.importance_score.toFixed(2)}, Type: ${mem.memory_type})`).join("\n") + "\n\n";
      }
      const ltmTokenCount = await tokenizerService.countTokens(ltmContextString, ollamaModel);

      // 3. Retrieve Short-Term Memory (dynamic context window)
      // Adjust STM token limit to account for LTMs, system prompt, and user's current message.
      // A more precise calculation would sum tokens of LTMs, system prompt, user message, and leave remainder for STM.
      const systemPromptForTools = `You have access to the following tools:
- get_current_time: Useful for finding the current time. To use this tool, you MUST output ONLY a JSON object in the following format, and nothing else:
  {"tool_name": "get_current_time", "arguments": {}}

If the user asks "What time is it?", "current time", or similar, you should respond with the JSON for the get_current_time tool.
Example:
User: What time is it?
Assistant: {"tool_name": "get_current_time", "arguments": {}}

If you do not need to use a tool, respond normally.`; // Existing system prompt

      const systemPromptTokenCount = await tokenizerService.countTokens(systemPromptForTools, ollamaModel);
      const availableTokensForSTM = CONTEXT_TOKEN_LIMIT - (ltmTokenCount + systemPromptTokenCount + userMessageTokenCount + 200); // 200 for buffer/response

      const shortTermHistory = await shortTermMemoryService.getFormattedHistoryForOllama(
        conversationId,
        availableTokensForSTM > 0 ? availableTokensForSTM : 0 // Ensure non-negative
      );

      // 4. Construct messages for Ollama (incorporating LTMs)
      const messagesForOllama = [
        { role: 'system', content: systemPromptForTools },
      ];
      if (ltmContextString) {
        // Add LTM context as a system message or part of the initial user message context
        messagesForOllama.push({ role: 'system', content: "Relevant information from memory:\n" + ltmContextString });
      }
      messagesForOllama.push(...shortTermHistory); // Add STM (already includes user's last message via service logic if it fits)
      // The `ollamaService.generateResponse` will append the `userMessageContent` as the last user message.

      // --- Tool Integration Logic (adapted) ---
      let finalBotContent = '';
      let finalBotTokenCount = 0;
      let toolExecutionInfo = null;

      // First LLM call (to detect tool use or get direct answer)
      // The history sent to ollamaService should not include the current userMessageContent,
      // as generateResponse appends it.
      let historyForFirstCall = messagesForOllama.filter(m => m.role !== 'user' || m.content !== userMessageContent);
      // If shortTermHistoryService already includes the latest user message, remove it before passing to ollamaService
      // For now, assume shortTermHistory is up to message *before* current userMessageContent.
      // Actually, getFormattedHistoryForOllama fetches *all* messages. The current user message was just added.
      // So, shortTermHistory will include the current user message if it was fetched *after* storing.
      // Let's ensure STM is fetched *before* current user message is part of it for this history construction.
      // The current `shortTermMemoryService.addMessage` adds it, then `getFormattedHistoryForOllama` would include it.
      // This is fine, `ollamaService.generateResponse` takes `currentPrompt` and `history`.
      // `shortTermHistory` will be the history *including* the latest user message.
      // `generateResponse` wants history *before* the current prompt.

      const actualHistoryForOllama = shortTermHistory.slice(0, -1); // Remove last message if it's the current user message.
                                                                // This assumes addMessage was called, then getFormattedHistory.

      let ollamaResponse = await ollamaService.generateResponse(userMessageContent, actualHistoryForOllama, ollamaModel);

      try {
        const potentialToolCall = JSON.parse(ollamaResponse.response);
        if (potentialToolCall && potentialToolCall.tool_name) {
          // ... (tool execution logic remains largely the same as original) ...
          console.log(`ChatService: Tool call detected: ${potentialToolCall.tool_name}`);
          const toolService = require('./tool.service'); // Assuming tool.service.js exists
          const toolResult = await toolService.executeTool(potentialToolCall.tool_name, potentialToolCall.arguments);

          toolExecutionInfo = { /* ... */ }; // Populate as before

          const followUpPrompt = `The user's original query was: "${userMessageContent}".
You decided to use the tool "${potentialToolCall.tool_name}".
The result of this tool call is: "${toolResult.output}".
Based on this information, please provide a natural language response to the user.`;

          const historyForSecondCall = [
            ...actualHistoryForOllama, // History up to user's current message
            { role: 'user', content: userMessageContent }, // User's current message
            { role: 'assistant', content: ollamaResponse.response }, // LLM's tool call
            { role: 'user', content: `Context from tool execution: ${toolResult.output}` } // Tool output
          ];

          ollamaResponse = await ollamaService.generateResponse(followUpPrompt, historyForSecondCall, ollamaModel);
          finalBotContent = ollamaResponse.response;
          finalBotTokenCount = ollamaResponse.responseTokens;
        } else {
          finalBotContent = ollamaResponse.response;
          finalBotTokenCount = ollamaResponse.responseTokens;
        }
      } catch (e) {
        finalBotContent = ollamaResponse.response;
        finalBotTokenCount = ollamaResponse.responseTokens;
      }
      // --- End of Tool Integration Logic ---

      // 5. Store AI's response
      const storedAiMessage = await shortTermMemoryService.addMessage(
        conversationId,
        'ai',
        finalBotContent,
        finalBotTokenCount,
        toolExecutionInfo ? { tool_executed: toolExecutionInfo } : null // Store tool info in metadata
      );

      // 6. Trigger Reflection (asynchronously)
      // Check message_order of the latest AI message
      if (storedAiMessage.message_order > 0 && (storedAiMessage.message_order / 2) % REFLECTION_TRIGGER_COUNT === 0) {
        console.log(`ChatService: Triggering reflection for user ${userId}, conversation ${conversationId} after message pair ${storedAiMessage.message_order / 2}`);
        reflectionService.generateAndStoreReflections(userId, conversationId)
          .then(reflections => console.log(`ChatService: Async reflection completed, ${reflections.length} new reflections generated.`))
          .catch(e => console.error('ChatService: Async reflection process failed:', e));
      }

      return {
        userMessage: storedUserMessage, // The one stored in DB
        botMessage: storedAiMessage, // The one stored in DB
        toolExecutionInfo: toolExecutionInfo
      };

    } catch (error) {
      console.error("Error in chatService.handleNewMessage:", error);
      throw error;
    }
  }
  // getChatsByUserId was removed as getConversationsForDefaultUser covers it.
};

module.exports = chatService;
