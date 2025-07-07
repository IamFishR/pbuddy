const { Reflection, ShortTermMemory } = require('../models');
const ollamaService = require('./ollama.service');
const shortTermMemoryService = require('./shorttermMemory.service'); // To get messages if not provided directly
const longtermMemoryService = require('./longtermMemory.service'); // To potentially store reflections as LTM

const reflectionService = {
  /**
   * Generates reflections based on recent messages in a conversation.
   * @param {number} userId - The ID of the user.
   * @param {number} conversationId - The ID of the conversation.
   * @param {number} [messageLookbackCount=10] - How many recent messages to consider.
   * @param {string} [llmModel='gemma:2b'] - The LLM model to use for generating reflections.
   * @returns {Promise<Array<Reflection>>} Array of created Reflection objects.
   */
  generateAndStoreReflections: async (userId, conversationId, messageLookbackCount = 10, llmModel = 'gemma:2b') => {
    try {
      console.log(`Reflection Service: Starting reflection process for user ${userId}, conversation ${conversationId}`);

      // 1. Gather Context: Fetch recent messages
      // We use ShortTermMemory's own getFormattedHistoryForOllama as it already handles some formatting,
      // but we need raw messages with IDs for triggering_message_ids.
      // Let's fetch recent messages directly.
      const recentMessages = await ShortTermMemory.findAll({
        where: { conversationId },
        order: [['message_order', 'DESC']],
        limit: messageLookbackCount,
        attributes: ['id', 'sender_type', 'content']
      });

      if (recentMessages.length === 0) {
        console.log("Reflection Service: No recent messages to reflect upon.");
        return [];
      }

      // Messages are currently in reverse chronological order, let's make them chronological for the prompt
      const orderedMessages = recentMessages.reverse();
      const triggeringMessageIds = orderedMessages.map(msg => msg.id);

      // 2. Format messages for the LLM reflection prompt
      const promptMessages = orderedMessages.map(msg => `${msg.sender_type === 'ai' ? 'Assistant' : 'User'}: ${msg.content}`).join('\n');

      const reflectionPrompt = `Based on the following recent conversation snippets, what are 2-3 high-level observations, insights, or questions that could be important for future interactions or understanding the user better?
Consider user's statements, preferences, goals, or significant information revealed.
Format your response ONLY as a JSON list of strings, where each string is a concise reflection.
Example:
User: I love hiking on weekends. Last month I went to Eagle Peak.
User: I'm planning another hike for this Saturday.
Assistant: Sounds fun!
Expected JSON Output: ["User enjoys hiking as a weekend activity and recently hiked Eagle Peak.", "User is planning another hike soon."]

If no significant insights are found, output an empty JSON list: [].

Conversation Snippets:
${promptMessages}

JSON Output of Reflections:`;

      // 3. Call LLM to generate reflections
      // The ollamaService.generateResponse expects history + current prompt.
      // We'll treat the entire reflectionPrompt as the "currentPrompt" and provide no additional history for this specific task.
      const llmResponse = await ollamaService.generateResponse(reflectionPrompt, [], llmModel);

      let reflectionTexts = [];
      try {
        // Attempt to parse the LLM response as JSON.
        // The LLM might sometimes include explanations or markdown around the JSON.
        const responseContent = llmResponse.response;
        const jsonMatch = responseContent.match(/(\[.*?\])/s); // Try to find JSON array within the response

        if (jsonMatch && jsonMatch[1]) {
          reflectionTexts = JSON.parse(jsonMatch[1]);
        } else {
          // Fallback if no clear JSON array is found, try parsing the whole thing
          reflectionTexts = JSON.parse(responseContent);
        }

        if (!Array.isArray(reflectionTexts)) {
            console.warn("Reflection Service: LLM response was not a valid JSON list of strings. Raw response:", responseContent);
            reflectionTexts = []; // Default to empty if parsing fails or not an array
        }
      } catch (e) {
        console.error("Reflection Service: Failed to parse LLM reflection response as JSON list.", e.message, "Raw response:", llmResponse.response);
        return []; // Or handle error appropriately
      }

      if (reflectionTexts.length === 0) {
        console.log("Reflection Service: LLM generated no new reflections.");
        return [];
      }

      // 4. Store Reflections
      const createdReflections = [];
      for (const text of reflectionTexts) {
        if (typeof text === 'string' && text.trim() !== "") {
          const reflection = await Reflection.create({
            userId,
            reflection_text: text.trim(),
            triggering_message_ids: JSON.stringify(triggeringMessageIds), // Store as JSON string
            status: 'pending', // Default status
          });
          createdReflections.push(reflection);
          console.log(`Reflection Service: Stored reflection: "${text.trim()}"`);

          // 5. OPTIONAL: Process Reflection into LTM immediately (type 'synthesized')
          // This part could be a separate step or configurable.
          // For now, let's add a basic LTM entry from the reflection.
          // Importance score for synthesized memories might be default or also LLM-derived.
          try {
            await longtermMemoryService.addMemory(
              userId,
              text.trim(), // memoryText is the reflection itself
              'synthesized', // memoryType
              0.6, // Default importance for synthesized memories, can be refined
              null, // sourceMessageIds (already captured in reflection)
              reflection.id // sourceReflectionId
              // Embedding will be generated by addMemory
            );
            console.log(`Reflection Service: Synthesized LTM entry created from reflection ID ${reflection.id}`);
            // Update reflection status if LTM creation is part of this flow
            await reflection.update({ status: 'processed' });

          } catch (ltmError) {
            console.error(`Reflection Service: Failed to create LTM from reflection ID ${reflection.id}`, ltmError);
          }
        }
      }
      return createdReflections;
    } catch (error) {
      console.error("Error in reflectionService.generateAndStoreReflections:", error);
      throw error;
    }
  },
};

module.exports = reflectionService;
