// tests/services/longtermMemory.service.test.js
const longtermMemoryService = require('../../services/longtermMemory.service');
const { LongTermMemory } = require('../../models');
const ollamaService = require('../../services/ollama.service');

// Mock dependencies
jest.mock('../../models', () => ({
  LongTermMemory: {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  // Mock other models if they were directly used by the service being tested,
  // but longtermMemoryService primarily uses LongTermMemory model directly.
}));
jest.mock('../../services/ollama.service', () => ({
  generateEmbedding: jest.fn(),
}));

describe('LongTermMemory Service', () => {
  beforeEach(() => {
    // Clears all mocks before each test to ensure test isolation
    jest.clearAllMocks();
  });

  describe('addMemory', () => {
    it('should create memory with provided embedding without calling ollamaService', async () => {
      const memoryData = { userId: 1, memoryText: 'Test memory with provided embedding', memoryType: 'fact', importanceScore: 0.8 };
      const embeddingVector = [0.1, 0.2, 0.3];
      // Mock the return value of LongTermMemory.create
      LongTermMemory.create.mockResolvedValue({
        ...memoryData,
        id: 1,
        embedding: JSON.stringify(embeddingVector),
        last_accessed_at: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await longtermMemoryService.addMemory(
        memoryData.userId, memoryData.memoryText, memoryData.memoryType, memoryData.importanceScore,
        null, null, embeddingVector // sourceMessageIds, sourceReflectionId, embeddingVector
      );

      expect(ollamaService.generateEmbedding).not.toHaveBeenCalled();
      expect(LongTermMemory.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: memoryData.userId,
        memory_text: memoryData.memoryText,
        memory_type: memoryData.memoryType,
        importance_score: memoryData.importanceScore,
        embedding: JSON.stringify(embeddingVector),
        last_accessed_at: expect.any(Date), // Check that it's a Date, not specific value
      }));
      expect(result.id).toBe(1);
      expect(result.memory_text).toBe(memoryData.memoryText);
    });

    it('should generate embedding if not provided and then create memory', async () => {
      const memoryData = { userId: 1, memoryText: 'Memory needing new embedding', memoryType: 'preference', importanceScore: 0.9 };
      const generatedEmbedding = [0.4, 0.5, 0.6];
      ollamaService.generateEmbedding.mockResolvedValue(generatedEmbedding);
      LongTermMemory.create.mockResolvedValue({
        ...memoryData,
        id: 2,
        embedding: JSON.stringify(generatedEmbedding),
        last_accessed_at: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await longtermMemoryService.addMemory(
        memoryData.userId, memoryData.memoryText, memoryData.memoryType, memoryData.importanceScore
        // Other params default to null or their defaults
      );

      expect(ollamaService.generateEmbedding).toHaveBeenCalledWith(memoryData.memoryText, 'nomic-embed-text');
      expect(LongTermMemory.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: memoryData.userId,
        memory_text: memoryData.memoryText,
        embedding: JSON.stringify(generatedEmbedding),
      }));
      expect(result.id).toBe(2);
    });

    it('should throw error if embedding generation fails and no embedding provided', async () => {
        ollamaService.generateEmbedding.mockRejectedValue(new Error("Embedding generation failed"));
        await expect(longtermMemoryService.addMemory(1, "text", "fact", 0.5))
            .rejects.toThrow("Embedding generation failed");
    });
  });

  describe('_calculateCosineSimilarity', () => {
    it('should return 1 for identical non-zero vectors', () => {
      const vec = [1, 2, 3];
      expect(longtermMemoryService._calculateCosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });
    it('should return 0 for orthogonal vectors', () => {
      expect(longtermMemoryService._calculateCosineSimilarity([1, 0], [0, 1])).toBe(0);
    });
    it('should return -1 for exact opposite vectors', () => {
      expect(longtermMemoryService._calculateCosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 5);
    });
    it('should handle zero vectors by returning 0', () => {
      expect(longtermMemoryService._calculateCosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      expect(longtermMemoryService._calculateCosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
    });
    it('should return 0 for vectors of different lengths (invalid input)', () => {
      expect(longtermMemoryService._calculateCosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('findRelevantMemories', () => {
    const userId = 1;
    const queryText = "relevant query";
    const queryEmbedding = [0.1, 0.2, 0.3]; // Example query embedding

    beforeEach(() => {
        ollamaService.generateEmbedding.mockResolvedValue(queryEmbedding);
        LongTermMemory.update.mockResolvedValue([1]); // Default mock for successful update
    });

    it('should find, rank, and return relevant memories meeting threshold', async () => {
      const mockMemoriesData = [
        // Perfect match, should be first
        { id: 1, userId, memory_text: 'Perfect match memory', embedding: JSON.stringify([0.1, 0.2, 0.3]), importance_score: 0.9, memory_type: 'fact'},
        // High similarity, should be second
        { id: 2, userId, memory_text: 'High similarity memory', embedding: JSON.stringify([0.11, 0.19, 0.28]), importance_score: 0.8, memory_type: 'preference'},
        // Lower similarity, but above a lower threshold
        { id: 3, userId, memory_text: 'Moderate similarity memory', embedding: JSON.stringify([0.3, 0.4, 0.5]), importance_score: 0.7, memory_type: 'observation'},
        // No similarity / orthogonal or opposite, should be filtered by threshold
        { id: 4, userId, memory_text: 'Irrelevant memory', embedding: JSON.stringify([-0.8, 0.7, -0.6]), importance_score: 0.6, memory_type: 'goal'},
      ];
      // Mock .get({ plain: true }) for each memory instance
      const mockMemoryInstances = mockMemoriesData.map(mem => ({...mem, get: jest.fn().mockReturnValue(mem)}));
      LongTermMemory.findAll.mockResolvedValue(mockMemoryInstances);

      const topN = 2;
      const similarityThreshold = 0.6; // Memory 3 might have similarity around 0.5-0.6 with [0.1,0.2,0.3] depending on actual math. Let's assume it's below for this example.
                                     // For [0.3,0.4,0.5] vs [0.1,0.2,0.3] sim is high. Let's make it more distinct.
                                     // Memory 3: [0.8, 0.7, 0.9] (less similar to queryEmbedding)
      mockMemoryInstances[2].embedding = JSON.stringify([0.8,0.7,0.9]);


      const results = await longtermMemoryService.findRelevantMemories(userId, queryText, topN, 'nomic-embed-text', similarityThreshold);

      expect(ollamaService.generateEmbedding).toHaveBeenCalledWith(queryText, 'nomic-embed-text');
      expect(LongTermMemory.findAll).toHaveBeenCalledWith({ where: { userId } });
      expect(results.length).toBe(topN);
      expect(results[0].id).toBe(1); // Perfect match
      expect(results[0].similarityScore).toBeCloseTo(1, 5);
      expect(results[1].id).toBe(2); // High similarity
      expect(results[1].similarityScore).toBeGreaterThan(similarityThreshold);
      // Ensure memory 3 was filtered out or not in topN
      expect(results.find(r => r.id === 3)).toBeUndefined();

      const updatedMemoryIds = results.map(r => r.id);
      expect(LongTermMemory.update).toHaveBeenCalledWith({ last_accessed_at: expect.any(Date) }, { where: { id: updatedMemoryIds } });
    });

    it('should return empty array if no memories found for user', async () => {
      LongTermMemory.findAll.mockResolvedValue([]);
      const results = await longtermMemoryService.findRelevantMemories(userId, queryText);
      expect(results.length).toBe(0);
      expect(LongTermMemory.update).not.toHaveBeenCalled();
    });

    it('should return empty array if no memories meet the similarity threshold', async () => {
      const mockMemoryInstances = [
        { id: 1, userId, memory_text: 'Low similarity memory', embedding: JSON.stringify([-0.5, -0.5, -0.5]), get: jest.fn().mockReturnThis() }
      ];
      LongTermMemory.findAll.mockResolvedValue(mockMemoryInstances);
      const results = await longtermMemoryService.findRelevantMemories(userId, queryText, 3, 'nomic-embed-text', 0.9); // High threshold
      expect(results.length).toBe(0);
    });

     it('should handle error during embedding parsing for a memory', async () => {
      const mockMemoriesData = [
        { id: 1, userId, memory_text: 'Good memory', embedding: JSON.stringify([0.1, 0.2, 0.3])},
        { id: 2, userId, memory_text: 'Corrupted memory', embedding: "this is not json"},
      ];
      const mockMemoryInstances = mockMemoriesData.map(mem => ({...mem, get: jest.fn().mockReturnValue(mem)}));
      LongTermMemory.findAll.mockResolvedValue(mockMemoryInstances);

      const results = await longtermMemoryService.findRelevantMemories(userId, queryText, 2, 'nomic-embed-text', 0.1);
      expect(results.length).toBe(1); // Only the good memory should be processed and potentially returned
      expect(results[0].id).toBe(1);
      expect(results[0].similarityScore).toBeCloseTo(1,5);
    });
  });
});
