const Ollama = require('ollama').Ollama; // Using .Ollama as per ollama version 0.1.8 docs
const dotenv = require('dotenv');
dotenv.config();

// Default host, can be overridden by OLLAMA_HOST in .env
const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
const ollama = new Ollama({ host: ollamaHost });

const ollamaService = {
  /**
   * Generates a response from Ollama based on the current prompt and chat history.
   * @param {string} currentPrompt - The latest message from the user.
   * @param {Array<{role: 'user' | 'assistant', content: string}>} history - Array of previous messages.
   * @param {string} model - The Ollama model to use.
   * @returns {Promise<{response: string, promptTokens: number, responseTokens: number}>}
   */
  generateResponse: async (currentPrompt, history = [], model = 'gemma:2b') => { // Default model changed
    console.log(`Ollama Service: Generating response for prompt: "${currentPrompt}" with model ${model}`);

    const systemPromptForTools = `You have access to the following tools:
- get_current_time: Useful for finding the current time. To use this tool, you MUST output ONLY a JSON object in the following format, and nothing else:
  {"tool_name": "get_current_time", "arguments": {}}

If the user asks "What time is it?", "current time", or similar, you should respond with the JSON for the get_current_time tool.
Example:
User: What is the current time?
Assistant: {"tool_name": "get_current_time", "arguments": {}}

If you do not need to use a tool, respond normally.`;

    const messages = [
      { role: 'system', content: systemPromptForTools }, // Added system prompt
      ...history,
      { role: 'user', content: currentPrompt }
    ];

    try {
      // Check if Ollama service is accessible by trying to list models
      // This also helps to confirm if the specified model might be available,
      // though ollama.chat will ultimately determine model availability.
      try {
        const models = await ollama.list();
        // Optional: Check if the requested 'model' is in the list
        // const modelAvailable = models.models.some(m => m.name.startsWith(model));
        // if (!modelAvailable) {
        //   throw new Error(`Model ${model} not found in Ollama. Available models: ${models.models.map(m=>m.name).join(', ')}`);
        // }
      } catch (e) {
        console.error("Ollama service is not accessible or failed to list models.", e.message);
        throw new Error(`Ollama service error: ${e.message}`); // Propagate as a generic Ollama error
      }

      const response = await ollama.chat({
        model: model,
        messages: messages,
        stream: false, // For now, get the full response. True for streaming.
      });

      console.log('Ollama response received:', response);

      // Extracting token counts. Names might vary based on Ollama version or model.
      // Based on recent ollama-js, it should be response.message.content,
      // and token counts like response.prompt_eval_count, response.eval_count
      const botResponseContent = response.message && response.message.content ? response.message.content : "Sorry, I could not generate a response.";
      const promptTokens = response.prompt_eval_count || 0; // Tokens for the input prompt
      const responseTokens = response.eval_count || 0;   // Tokens for the generated response

      return {
        response: botResponseContent,
        promptTokens: promptTokens,
        responseTokens: responseTokens
      };

    } catch (error) {
      console.error('Error communicating with Ollama:', error);
      // Consider how to handle this error in the calling service/controller
      // For now, return a structured error response
      return {
        response: "Error: Could not get response from Ollama.",
        promptTokens: 0, // Assuming 0 tokens if there's an error
        responseTokens: 0
      };
    }
  }
};

module.exports = ollamaService;
