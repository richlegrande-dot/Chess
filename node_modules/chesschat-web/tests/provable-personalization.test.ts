/**
 * Provable Personalization Integration Tests
 * 
 * Tests that chat and analyze-game endpoints enforce the
 * ≥2 personalized references requirement.
 * 
 * ACCEPTANCE CRITERIA:
 * 1. With ≥10 games + ≥3 patterns: response has ≥2 references
 * 2. With insufficient history: insufficientHistory=true
 * 3. historyEvidence block present in all responses
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Provable Personalization - Integration Tests', () => {
  let prisma: PrismaClient;
  const testUserId = 'test-user-personalization';

  beforeAll(async () => {
    // Skip if no DATABASE_URL (CI environment without DB)
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  Skipping integration tests - DATABASE_URL not set');
      return;
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Seed test data
    await seedTestData(testUserId);
  });

  afterAll(async () => {
    if (prisma) {
      // Cleanup test data
      await cleanupTestData(testUserId);
      await prisma.$disconnect();
    }
  });

  describe('Sufficient History (≥10 games + ≥3 patterns)', () => {
    it('should include ≥2 personalized references in chat response', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('⚠️  Skipping - no DATABASE_URL');
        return;
      }

      // Import Wall-E engine
      const { getWallEEngine } = await import('../functions/lib/walleEngine');
      const engine = getWallEEngine();

      const response = await engine.chat(
        {
          userId: testUserId,
          databaseUrl: process.env.DATABASE_URL,
        },
        'What should I work on?',
        undefined
      );

      // Verify historyEvidence exists
      expect(response.historyEvidence).toBeDefined();
      expect(response.historyEvidence.personalizedReferenceCount).toBeGreaterThanOrEqual(2);
      expect(response.historyEvidence.insufficientHistory).toBe(false);

      // Verify personalizedReferences exists
      expect(response.personalizedReferences).toBeDefined();
      expect(response.personalizedReferences.length).toBeGreaterThanOrEqual(2);

      // Verify response text includes references
      expect(response.response).toBeTruthy();
      expect(response.response.length).toBeGreaterThan(50);
    });

    it('should include ≥2 personalized references in game analysis', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('⚠️  Skipping - no DATABASE_URL');
        return;
      }

      const { getWallEEngine } = await import('../functions/lib/walleEngine');
      const engine = getWallEEngine();

      const response = await engine.analyzeGame(
        {
          userId: testUserId,
          databaseUrl: process.env.DATABASE_URL,
        },
        '1. e4 e5 2. Nf3 Nc6 3. Bc4',
        ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
        {
          playerColor: 'white',
          cpuLevel: 3,
        }
      );

      // Verify historyEvidence
      expect(response.historyEvidence).toBeDefined();
      expect(response.historyEvidence.personalizedReferenceCount).toBeGreaterThanOrEqual(2);
      expect(response.historyEvidence.insufficientHistory).toBe(false);

      // Verify personalizedReferences
      expect(response.personalizedReferences).toBeDefined();
      expect(response.personalizedReferences.length).toBeGreaterThanOrEqual(2);

      // Verify analysis includes references
      expect(response.analysis).toBeTruthy();
      expect(response.personalizedInsights).toBeDefined();
      expect(response.personalizedInsights.length).toBeGreaterThan(0);
    });
  });

  describe('Insufficient History (< 2 games or 0 patterns)', () => {
    const newUserId = 'test-user-newbie';

    beforeAll(async () => {
      if (!prisma) return;

      // Seed minimal data (1 game, 0 patterns)
      await prisma.playerProfile.create({
        data: {
          userId: newUserId,
          skillRatings: JSON.stringify({ overall: 800 }),
          behavioralPatterns: JSON.stringify({}),
          gamesPlayed: 1,
        },
      });

      await prisma.trainingGame.create({
        data: {
          userId: newUserId,
          fen: 'start',
          moves: JSON.stringify(['e4', 'e5']),
          analysis: JSON.stringify({ mistakes: [] }),
          metrics: JSON.stringify({ accuracy: 95 }),
          timestamp: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (prisma) {
        await prisma.trainingGame.deleteMany({ where: { userId: newUserId } });
        await prisma.playerProfile.delete({ where: { userId: newUserId } });
      }
    });

    it('should set insufficientHistory=true with < 2 games', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('⚠️  Skipping - no DATABASE_URL');
        return;
      }

      const { getWallEEngine } = await import('../functions/lib/walleEngine');
      const engine = getWallEEngine();

      const response = await engine.chat(
        {
          userId: newUserId,
          databaseUrl: process.env.DATABASE_URL,
        },
        'Give me advice',
        undefined
      );

      expect(response.historyEvidence.insufficientHistory).toBe(true);
      expect(response.historyEvidence.insufficientReason).toBeTruthy();
      expect(response.historyEvidence.personalizedReferenceCount).toBeLessThan(2);
    });

    it('should acknowledge limited history in response text', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('⚠️  Skipping - no DATABASE_URL');
        return;
      }

      const { getWallEEngine } = await import('../functions/lib/walleEngine');
      const engine = getWallEEngine();

      const response = await engine.chat(
        {
          userId: newUserId,
          databaseUrl: process.env.DATABASE_URL,
        },
        'What can I improve?',
        undefined
      );

      // Response should mention limited history
      const lowerResponse = response.response.toLowerCase();
      expect(
        lowerResponse.includes('history') ||
        lowerResponse.includes('game') ||
        lowerResponse.includes('play more')
      ).toBe(true);
    });
  });
});

/**
 * Seed test data with ≥10 games and ≥3 mistake patterns
 */
async function seedTestData(userId: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // Create player profile
    await prisma.playerProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        skillRatings: JSON.stringify({
          overall: 1200,
          tactical: 1150,
          positional: 1250,
        }),
        behavioralPatterns: JSON.stringify({
          playsAggressively: true,
          prefersOpen: true,
        }),
        gamesPlayed: 15,
        improvementRate: 25,
      },
    });

    // Create 10 training games
    for (let i = 0; i < 10; i++) {
      await prisma.trainingGame.create({
        data: {
          userId,
          fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${i + 1}`,
          moves: JSON.stringify(['e4', 'e5', 'Nf3', 'Nc6']),
          analysis: JSON.stringify({
            mistakes: [
              { type: 'tactical_miss', move: 'Nc6' },
              { type: 'positional_error', move: 'e5' },
            ],
          }),
          metrics: JSON.stringify({
            accuracy: 85 - i * 2,
            blunders: i % 3,
            mistakes: i % 2,
          }),
          result: i % 3 === 0 ? 'win' : i % 3 === 1 ? 'loss' : 'draw',
          timestamp: new Date(Date.now() - i * 86400000),
        },
      });
    }

    // Create 3 mistake patterns
    const patterns = [
      {
        signatureKey: 'hanging_pieces',
        title: 'Leaving Pieces En Prise',
        category: 'tactical',
        occurrenceCount: 15,
      },
      {
        signatureKey: 'back_rank',
        title: 'Back Rank Weakness',
        category: 'tactical',
        occurrenceCount: 8,
      },
      {
        signatureKey: 'fork_vulnerability',
        title: 'Knight Fork Susceptibility',
        category: 'tactical',
        occurrenceCount: 5,
      },
    ];

    for (const pattern of patterns) {
      await prisma.mistakeSignature.upsert({
        where: {
          userId_signatureKey: {
            userId,
            signatureKey: pattern.signatureKey,
          },
        },
        update: {
          occurrenceCount: pattern.occurrenceCount,
        },
        create: {
          userId,
          signatureKey: pattern.signatureKey,
          title: pattern.title,
          category: pattern.category,
          occurrenceCount: pattern.occurrenceCount,
          patternDetails: JSON.stringify({
            description: `Common ${pattern.category} error`,
            examples: ['example1', 'example2'],
          }),
          examplePositions: JSON.stringify(['fen1', 'fen2']),
          relatedConcepts: JSON.stringify(['concept1', 'concept2']),
          lastSeen: new Date(),
        },
      });
    }

    console.log(`✅ Seeded test data for user: ${userId}`);
  } catch (error) {
    console.error('Failed to seed test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Cleanup test data
 */
async function cleanupTestData(userId: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    await prisma.mistakeSignature.deleteMany({ where: { userId } });
    await prisma.trainingGame.deleteMany({ where: { userId } });
    await prisma.learningMetric.deleteMany({ where: { userId } });
    await prisma.playerProfile.delete({ where: { userId } });

    console.log(`✅ Cleaned up test data for user: ${userId}`);
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}
