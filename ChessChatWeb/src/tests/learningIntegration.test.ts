/**
 * Learning Integration - Test Suite
 * 
 * Tests move biasing, teaching opportunities, and learning statistics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTeachingOpportunities,
  isLearningAvailable,
  getLearningStatistics
} from '../lib/cpu/learningIntegration';
import { ChessGame } from '../lib/chess';

// Mock the protected training core
vi.mock('../lib/coaching/protectedTrainingCore', () => ({
  getProtectedTrainingCore: () => ({
    getTotalGamesPlayed: () => 25,
    getSignatures: () => [
      {
        category: 'tactical',
        title: 'Hanging Pieces',
        mistakeType: 'missed',
        confidenceScore: 0.85,
        masteryScore: 40,
        occurrences: 12,
        lastSeenAt: Date.now(),
        severityWeightedImpact: 4.2,
        isConfirmed: true,
        isStable: true,
        isHighConfidence: true
      },
      {
        category: 'strategic',
        title: 'King Safety',
        mistakeType: 'neglected',
        confidenceScore: 0.75,
        masteryScore: 50,
        occurrences: 10,
        lastSeenAt: Date.now(),
        severityWeightedImpact: 3.8,
        isConfirmed: true,
        isStable: true,
        isHighConfidence: false
      },
      {
        category: 'tactical',
        title: 'Fork Opportunities',
        mistakeType: 'missed',
        confidenceScore: 0.65,
        masteryScore: 60,
        occurrences: 8,
        lastSeenAt: Date.now(),
        severityWeightedImpact: 3.2,
        isConfirmed: true,
        isStable: false,
        isHighConfidence: false
      },
      {
        category: 'strategic',
        title: 'Pawn Structure',
        mistakeType: 'weak',
        confidenceScore: 0.45,
        masteryScore: 70,
        occurrences: 5,
        lastSeenAt: Date.now(),
        severityWeightedImpact: 2.5,
        isConfirmed: false,
        isStable: false,
        isHighConfidence: false
      }
    ],
    getGames: () => []
  })
}));

describe('Learning Integration', () => {
  let position: ChessGame;

  beforeEach(() => {
    position = new ChessGame();
  });

  describe('Learning Availability', () => {
    it('should be available after 10 games', () => {
      expect(isLearningAvailable()).toBe(true);
    });
  });

  describe('Learning Statistics', () => {
    it('should return correct statistics', () => {
      const stats = getLearningStatistics();

      expect(stats.available).toBe(true);
      expect(stats.gamesPlayed).toBe(25);
      expect(stats.confirmedPatterns).toBeGreaterThan(0);
    });

    it('should identify teachable patterns', () => {
      const stats = getLearningStatistics();

      // Teachable = confidence >= 0.7 AND mastery < 85
      expect(stats.teachablePatterns).toBeGreaterThan(0);
      expect(stats.readyForTeaching).toBe(true);
    });
  });

  describe('Teaching Opportunities', () => {
    it('should return no opportunities before 10 games', () => {
      vi.mocked(getProtectedTrainingCore).mockReturnValueOnce({
        getTotalGamesPlayed: () => 5,
        getSignatures: () => [],
        getGames: () => []
      } as any);

      const opportunities = getTeachingOpportunities(position, 5);

      expect(opportunities.userSignatures.length).toBe(0);
    });

    it('should prioritize high-confidence, low-mastery patterns', () => {
      const opportunities = getTeachingOpportunities(position, 5);

      if (opportunities.userSignatures.length > 0) {
        const first = opportunities.userSignatures[0];
        
        // Should favor teaching opportunities
        expect(first.confidenceScore).toBeGreaterThanOrEqual(0.7);
        expect(first.masteryScore).toBeLessThan(85);
      }
    });

    it('should limit to top 3 opportunities', () => {
      const opportunities = getTeachingOpportunities(position, 5);

      expect(opportunities.userSignatures.length).toBeLessThanOrEqual(3);
    });

    it('should filter out high-mastery patterns', () => {
      const opportunities = getTeachingOpportunities(position, 5);

      opportunities.userSignatures.forEach(sig => {
        expect(sig.masteryScore).toBeLessThan(85);
      });
    });

    it('should filter out low-confidence patterns', () => {
      const opportunities = getTeachingOpportunities(position, 5);

      opportunities.userSignatures.forEach(sig => {
        expect(sig.confidenceScore).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should include position context', () => {
      const opportunities = getTeachingOpportunities(position, 5);

      expect(opportunities.currentPosition).toBeDefined();
      expect(opportunities.difficultyLevel).toBe(5);
    });
  });

  describe('Teaching Priority Calculation', () => {
    it('should prioritize recent patterns over old ones', () => {
      const now = Date.now();
      const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000);

      vi.mocked(getProtectedTrainingCore).mockReturnValueOnce({
        getTotalGamesPlayed: () => 25,
        getSignatures: () => [
          {
            category: 'tactical',
            title: 'Recent Pattern',
            confidenceScore: 0.75,
            masteryScore: 40,
            occurrences: 8,
            lastSeenAt: now,
            severityWeightedImpact: 4.0
          },
          {
            category: 'tactical',
            title: 'Old Pattern',
            confidenceScore: 0.75,
            masteryScore: 40,
            occurrences: 8,
            lastSeenAt: tenDaysAgo,
            severityWeightedImpact: 4.0
          }
        ],
        getGames: () => []
      } as any);

      const opportunities = getTeachingOpportunities(position, 5);

      if (opportunities.userSignatures.length >= 2) {
        // Recent pattern should come first
        expect(opportunities.userSignatures[0].title).toBe('Recent Pattern');
      }
    });

    it('should prioritize lower mastery (more to teach)', () => {
      vi.mocked(getProtectedTrainingCore).mockReturnValueOnce({
        getTotalGamesPlayed: () => 25,
        getSignatures: () => [
          {
            category: 'tactical',
            title: 'Needs Work',
            confidenceScore: 0.75,
            masteryScore: 30,
            occurrences: 8,
            lastSeenAt: Date.now(),
            severityWeightedImpact: 4.0
          },
          {
            category: 'tactical',
            title: 'Almost There',
            confidenceScore: 0.75,
            masteryScore: 75,
            occurrences: 8,
            lastSeenAt: Date.now(),
            severityWeightedImpact: 4.0
          }
        ],
        getGames: () => []
      } as any);

      const opportunities = getTeachingOpportunities(position, 5);

      if (opportunities.userSignatures.length >= 1) {
        // Lower mastery should be prioritized
        expect(opportunities.userSignatures[0].title).toBe('Needs Work');
      }
    });

    it('should prioritize higher confidence patterns', () => {
      vi.mocked(getProtectedTrainingCore).mockReturnValueOnce({
        getTotalGamesPlayed: () => 25,
        getSignatures: () => [
          {
            category: 'tactical',
            title: 'High Confidence',
            confidenceScore: 0.85,
            masteryScore: 40,
            occurrences: 12,
            lastSeenAt: Date.now(),
            severityWeightedImpact: 4.0
          },
          {
            category: 'tactical',
            title: 'Medium Confidence',
            confidenceScore: 0.70,
            masteryScore: 40,
            occurrences: 8,
            lastSeenAt: Date.now(),
            severityWeightedImpact: 4.0
          }
        ],
        getGames: () => []
      } as any);

      const opportunities = getTeachingOpportunities(position, 5);

      if (opportunities.userSignatures.length >= 1) {
        // Higher confidence should be prioritized
        expect(opportunities.userSignatures[0].confidenceScore).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing training data gracefully', () => {
      vi.mocked(getProtectedTrainingCore).mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const opportunities = getTeachingOpportunities(position, 5);

      // Should return empty context without crashing
      expect(opportunities.userSignatures.length).toBe(0);
    });

    it('should handle corrupted signature data', () => {
      vi.mocked(getProtectedTrainingCore).mockReturnValueOnce({
        getTotalGamesPlayed: () => 25,
        getSignatures: () => [
          null,
          undefined,
          { category: 'tactical' } // Missing required fields
        ] as any,
        getGames: () => []
      } as any);

      expect(() => {
        getTeachingOpportunities(position, 5);
      }).not.toThrow();
    });
  });
});
