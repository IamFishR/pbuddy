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

  handleNewMessage: async (chatId, userMessageContent, clientHistory, ollamaModel = 'gemma3n:e2b') => {
    try {
      const defaultUser = await userService.getOrCreateDefaultUser(); // Still useful to ensure chat belongs to default user
      // 0. Verify chat exists and belongs to the default user
      const chat = await Chat.findOne({ where: { id: chatId, userId: defaultUser.id } });
      if (!chat) {
        throw new Error(`Chat with ID ${chatId} not found for default user.`);
      }

      // userMessageContent is the current prompt.
      // clientHistory is the array of {role, content} from the client.

      // --- Tool Integration Logic ---
      let finalBotContent = '';
      let finalBotTokenCount = 0;
      let initialUserPromptTokens = 0; // Will store tokens from the first call if a tool is used

      // First call to Ollama
      let ollamaResponse = await ollamaService.generateResponse(userMessageContent, clientHistory, ollamaModel);
      initialUserPromptTokens = ollamaResponse.promptTokens; // Capture prompt tokens for the original user message

      try {
        const potentialToolCall = JSON.parse(ollamaResponse.response);

        if (potentialToolCall && potentialToolCall.tool_name) {
          console.log(`ChatService: Tool call detected: ${potentialToolCall.tool_name}`);
          const toolService = require('./tool.service'); // Require tool service
          const toolResult = await toolService.executeTool(potentialToolCall.tool_name, potentialToolCall.arguments);

          let toolResponseForLLM;
          if (toolResult.success) {
            toolResponseForLLM = `Tool "${potentialToolCall.tool_name}" executed successfully. Output: ${toolResult.output}`;
          } else {
            toolResponseForLLM = `Tool "${potentialToolCall.tool_name}" failed. Error: ${toolResult.error}`;
          }

          // Prepare for a second LLM call
          // The prompt to the LLM should guide it to use the tool's output to answer the user's original query.
          const followUpPrompt = `The user's original query was: "${userMessageContent}".
You decided to use the tool "${potentialToolCall.tool_name}".
The result of this tool call is: "${toolResult.output}".
Based on this information, please provide a natural language response to the user.`;

          // Construct history for the second call:
          // Original User Query -> LLM Tool Request -> Tool Execution Result -> LLM Final Answer
          const historyForSecondCall = [
            ...clientHistory,
            { role: 'user', content: userMessageContent },
            { role: 'assistant', content: ollamaResponse.response }, // LLM's first response (the tool call JSON)
            // We represent the tool execution result as if it's a user message providing context,
            // or some systems might use a dedicated 'tool' role.
            // For Ollama, 'user' or 'system' message providing context is common.
            { role: 'user', content: `Context from tool execution: ${toolResult.output}` }
          ];

          console.log("ChatService: Making second LLM call with tool results.");
          ollamaResponse = await ollamaService.generateResponse(followUpPrompt, historyForSecondCall, ollamaModel);
          // Note: The promptTokens for this second call are for the followUpPrompt + historyForSecondCall.
          // The responseTokens are for the final human-readable answer.
          finalBotContent = ollamaResponse.response;
          finalBotTokenCount = ollamaResponse.responseTokens;

        } else {
          // Not a tool call (or JSON parse failed, but was not a valid tool obj), use the response directly
          finalBotContent = ollamaResponse.response;
          finalBotTokenCount = ollamaResponse.responseTokens;
        }
      } catch (e) {
        // Response was not JSON or not a valid tool call structure, use it as is
        console.log("ChatService: No valid tool call detected in LLM response.", e.message);
        finalBotContent = ollamaResponse.response;
        finalBotTokenCount = ollamaResponse.responseTokens;
      }
      // --- End of Tool Integration Logic ---

      // Save user's message using tokens from the first call
      const userMessage = await messageService.createMessage(
        chatId,
        'user',
        userMessageContent,
        initialUserPromptTokens // User message prompt tokens
      );

      // Save bot's final response message
      const botMessage = await messageService.createMessage(
        chatId,
        'bot',
        finalBotContent,
        finalBotTokenCount // Bot message response tokens
      );

      // Update total chat token count
      // This will sum userMessage.tokenCount + botMessage.tokenCount + any prior messages
      const updatedChatTokens = await messageService.updateChatTokenCount(chatId);

      return {
        userMessage,
        botMessage,
        updatedTokenCount: updatedChatTokens.totalTokens,
        // ollamaFullResponse might be less relevant now or need to represent the multi-step process
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
