const { LongTermMemory } = require('../models');
const ollamaService = require('./ollama.service'); // Assuming ollamaService is correctly exported

const longtermMemoryService = {
  /**
   * Adds a memory to the LongTermMemory table.
   * If embeddingVector is not provided, it will be generated using ollamaService.
   *
   * @param {number} userId - The ID of the user this memory belongs to.
   * @param {string} memoryText - The core text of the memory.
   * @param {string} memoryType - Type of memory ('fact', 'preference', 'goal', 'synthesized', 'observation').
   * @param {number} importanceScore - Importance score (0.0 to 1.0).
   * @param {Array<number>} [sourceMessageIds=null] - Optional: Array of ShortTermMemory IDs.
   * @param {number} [sourceReflectionId=null] - Optional: ID of the Reflection that generated this memory.
   * @param {Array<number>} [embeddingVector=null] - Optional: Pre-computed embedding vector.
   * @param {string} [embeddingModel='nomic-embed-text'] - Model to use if generating embedding.
   * @returns {Promise<LongTermMemory>} The created LongTermMemory object.
   */
  addMemory: async (
    userId,
    memoryText,
    memoryType,
    importanceScore,
    sourceMessageIds = null,
    sourceReflectionId = null,
    embeddingVector = null,
    embeddingModel = 'nomic-embed-text' // Consistent with ollamaService default
  ) => {
    try {
      let finalEmbedding = embeddingVector;
      if (!finalEmbedding) {
        if (!memoryText) {
          throw new Error("memoryText is required to generate an embedding.");
        }
        console.log(`LTM Service: Generating embedding for memory text: "${memoryText.substring(0,50)}..." using model ${embeddingModel}`);
        finalEmbedding = await ollamaService.generateEmbedding(memoryText, embeddingModel);
      }

      if (!finalEmbedding || !Array.isArray(finalEmbedding) || finalEmbedding.length === 0) {
        throw new Error("Failed to obtain a valid embedding vector.");
      }

      // Embeddings are stored as JSON strings in the database (TEXT column)
      const embeddingJsonString = JSON.stringify(finalEmbedding);

      const newMemory = await LongTermMemory.create({
        userId,
        memory_text: memoryText,
        embedding: embeddingJsonString,
        memory_type: memoryType,
        importance_score: importanceScore,
        source_message_ids: sourceMessageIds ? JSON.stringify(sourceMessageIds) : null, // Ensure JSON format if model expects JSON type
        sourceReflectionId, // FK, directly stored
        last_accessed_at: new Date(), // Set last_accessed_at to now on creation
        // createdAt and updatedAt are handled by Sequelize timestamps
      });

      console.log(`LTM Service: Memory added successfully for user ${userId}, type ${memoryType}, text: "${memoryText.substring(0,50)}..."`);
      return newMemory;
    } catch (error) {
      console.error("Error in longtermMemoryService.addMemory:", error);
      // Log more details if possible, e.g., if embedding generation failed.
      if (error.message.includes("Ollama") || error.message.includes("embedding")) {
        console.error("Details: Embedding generation or processing likely failed.");
      }
      throw error;
    }
  },

  // Future methods for LTM retrieval will go here:
  // e.g., findRelevantMemories(userId, queryText, topN = 5)

  /**
   * Calculates the cosine similarity between two vectors.
   * @param {Array<number>} vecA - The first vector.
   * @param {Array<number>} vecB - The second vector.
   * @returns {number} The cosine similarity, or 0 if input is invalid.
   */
  _calculateCosineSimilarity: (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0; // Invalid input
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0; // Avoid division by zero if one vector is all zeros
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  /**
   * Finds relevant long-term memories for a given user and query text.
   * @param {number} userId - The ID of the user.
   * @param {string} queryText - The text to find relevant memories for.
   * @param {number} [topN=3] - The maximum number of memories to return.
   * @param {string} [embeddingModel='nomic-embed-text'] - Model to use for query embedding.
   * @param {number} [similarityThreshold=0.5] - Minimum similarity score for a memory to be considered relevant.
   * @returns {Promise<Array<LongTermMemory & {similarityScore: number}>>} Sorted array of relevant memories with their scores.
   */
  findRelevantMemories: async function( // Use function keyword to access 'this' for _calculateCosineSimilarity
    userId,
    queryText,
    topN = 3,
    embeddingModel = 'nomic-embed-text',
    similarityThreshold = 0.5
  ) {
    try {
      if (!queryText || queryText.trim() === "") {
        return [];
      }

      console.log(`LTM Service: Finding relevant memories for user ${userId}, query: "${queryText.substring(0,50)}..."`);
      const queryEmbedding = await ollamaService.generateEmbedding(queryText, embeddingModel);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error("LTM Service: Failed to generate embedding for query text.");
        return [];
      }

      const userMemories = await LongTermMemory.findAll({
        where: { userId },
        // order: [['last_accessed_at', 'DESC']], // Optionally pre-sort or fetch all and sort later
      });

      if (userMemories.length === 0) {
        return [];
      }

      const scoredMemories = userMemories.map(memory => {
        let storedEmbeddingVec;
        try {
          storedEmbeddingVec = JSON.parse(memory.embedding); // Stored as JSON string
        } catch (e) {
          console.error(`LTM Service: Failed to parse stored embedding for memory ID ${memory.id}`, e);
          return { ...memory.get({ plain: true }), similarityScore: 0 }; // Assign 0 score if parsing fails
        }

        if (!Array.isArray(storedEmbeddingVec) || storedEmbeddingVec.length === 0) {
            console.warn(`LTM Service: Invalid or empty stored embedding for memory ID ${memory.id}`);
            return { ...memory.get({ plain: true }), similarityScore: 0 };
        }

        const similarityScore = this._calculateCosineSimilarity(queryEmbedding, storedEmbeddingVec);
        return { ...memory.get({ plain: true }), similarityScore }; // Get plain object for easier modification
      });

      // Sort by similarity score in descending order
      scoredMemories.sort((a, b) => b.similarityScore - a.similarityScore);

      // Filter by threshold and select topN
      const relevantMemories = scoredMemories
        .filter(memory => memory.similarityScore >= similarityThreshold)
        .slice(0, topN);

      // Optionally, update last_accessed_at for retrieved memories (could be done in a separate call or here)
      if (relevantMemories.length > 0) {
          const accessedMemoryIds = relevantMemories.map(mem => mem.id);
          await LongTermMemory.update(
              { last_accessed_at: new Date() },
              { where: { id: accessedMemoryIds } }
          );
          console.log(`LTM Service: Updated last_accessed_at for ${accessedMemoryIds.length} memories.`);
      }

      console.log(`LTM Service: Found ${relevantMemories.length} relevant memories (topN=${topN}, threshold=${similarityThreshold}).`);
      return relevantMemories;

    } catch (error) {
      console.error("Error in longtermMemoryService.findRelevantMemories:", error);
      throw error;
    }
  }
};

module.exports = longtermMemoryService;
