/**
 * Personalized Reference System Tests
 * 
 * Validates that Wall-E coaching responses include provable
 * references to stored gameplay history.
 * 
 * REQUIREMENT: ≥2 personalized references per response
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildPersonalizedReferences,
  validatePersonalization,
  augmentWithPersonalization,
  formatReferences,
  type PersonalizationContext,
} from '../functions/lib/personalizedReferences';

describe('PersonalizedReferences System', () => {
  describe('buildPersonalizedReferences', () => {
    it('should build references from 10+ games and 3+ patterns', () => {
      const context: PersonalizationContext = {
        recentGames: Array.from({ length: 10 }, (_, i) => ({
          id: `game-${i}`,
          result: i % 3 === 0 ? 'win' : i % 3 === 1 ? 'loss' : 'draw',
          mistakes: [
            { type: 'tactical_miss', move: 'e4' },
            { type: 'positional_error', move: 'd4' },
          ],
        })),
        topMistakePatterns: [
          {
            key: 'hanging_pieces',
            name: 'Leaving Pieces En Prise',
            occurrences: 15,
            description: 'Leaving pieces undefended',
          },
          {
            key: 'back_rank',
            name: 'Back Rank Weakness',
            occurrences: 8,
            description: 'Missing back rank tactics',
          },
          {
            key: 'fork_vulnerability',
            name: 'Fork Vulnerability',
            occurrences: 5,
            description: 'Susceptible to knight forks',
          },
        ],
      };

      const { references, evidence } = buildPersonalizedReferences(context);

      // Must have ≥2 references
      expect(references.length).toBeGreaterThanOrEqual(2);
      expect(evidence.personalizedReferenceCount).toBeGreaterThanOrEqual(2);

      // Evidence must be accurate
      expect(evidence.lastGamesUsed).toBe(10);
      expect(evidence.gameIdsUsed.length).toBeGreaterThan(0);
      expect(evidence.topMistakePatternsUsed.length).toBeGreaterThan(0);
      expect(evidence.insufficientHistory).toBe(false);

      // References must be human-readable
      references.forEach(ref => {
        expect(ref.text).toBeTruthy();
        expect(ref.text.length).toBeGreaterThan(20);
        expect(ref.source).toBeTruthy();
      });
    });

    it('should handle insufficient history gracefully (< 2 games)', () => {
      const context: PersonalizationContext = {
        recentGames: [
          {
            id: 'game-1',
            result: 'win',
            mistakes: [],
          },
        ],
        topMistakePatterns: [],
      };

      const { references, evidence } = buildPersonalizedReferences(context);

      expect(evidence.insufficientHistory).toBe(true);
      expect(evidence.insufficientReason).toContain('only 1 game');
      expect(evidence.personalizedReferenceCount).toBeLessThan(2);
    });

    it('should handle no mistake patterns', () => {
      const context: PersonalizationContext = {
        recentGames: Array.from({ length: 10 }, (_, i) => ({
          id: `game-${i}`,
          result: 'draw',
          mistakes: [],
        })),
        topMistakePatterns: [],
      };

      const { references, evidence } = buildPersonalizedReferences(context);

      expect(evidence.insufficientHistory).toBe(true);
      expect(evidence.insufficientReason).toContain('no mistake patterns');
    });

    it('should extract game result references', () => {
      const context: PersonalizationContext = {
        recentGames: [
          { id: 'g1', result: 'win', mistakes: [] },
          { id: 'g2', result: 'win', mistakes: [] },
          { id: 'g3', result: 'loss', mistakes: [] },
          { id: 'g4', result: 'draw', mistakes: [] },
        ],
        topMistakePatterns: [
          {
            key: 'test_pattern',
            name: 'Test Pattern',
            occurrences: 5,
          },
        ],
      };

      const { references } = buildPersonalizedReferences(context);

      const gameReference = references.find(r => r.kind === 'last10games');
      expect(gameReference).toBeTruthy();
      expect(gameReference?.text).toMatch(/wins|losses|draws/i);
    });

    it('should extract top mistake pattern references', () => {
      const context: PersonalizationContext = {
        recentGames: Array.from({ length: 5 }, (_, i) => ({
          id: `game-${i}`,
          mistakes: [],
        })),
        topMistakePatterns: [
          {
            key: 'hanging_pieces',
            name: 'Leaving Pieces Undefended',
            occurrences: 12,
            description: 'Missing piece protection',
          },
        ],
      };

      const { references } = buildPersonalizedReferences(context);

      const patternReference = references.find(r => r.kind === 'topMistakePattern');
      expect(patternReference).toBeTruthy();
      expect(patternReference?.text).toContain('#1');
      expect(patternReference?.text).toContain('Leaving Pieces Undefended');
      expect(patternReference?.text).toContain('12');
    });
  });

  describe('validatePersonalization', () => {
    it('should pass validation with ≥2 references and sufficient history', () => {
      const response = `You've been improving! In 5 of your last 10 games, you struggled with tactical misses. Your #1 recurring mistake pattern is leaving pieces en prise (12 times).`;
      
      const evidence = {
        lastGamesUsed: 10,
        gameIdsUsed: ['g1', 'g2', 'g3'],
        topMistakePatternsUsed: ['hanging_pieces'],
        personalizedReferenceCount: 2,
        insufficientHistory: false,
      };

      const { valid, errors } = validatePersonalization(response, evidence);

      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with < 2 references', () => {
      const response = `General chess advice here.`;
      
      const evidence = {
        lastGamesUsed: 10,
        gameIdsUsed: ['g1'],
        topMistakePatternsUsed: [],
        personalizedReferenceCount: 1,
        insufficientHistory: false,
      };

      const { valid, errors } = validatePersonalization(response, evidence);

      expect(valid).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Only 1 personalized reference');
    });

    it('should pass with insufficient history and explanation', () => {
      const response = `I only have 1 game in your history so far. Play more games for personalized insights!`;
      
      const evidence = {
        lastGamesUsed: 1,
        gameIdsUsed: ['g1'],
        topMistakePatternsUsed: [],
        personalizedReferenceCount: 0,
        insufficientHistory: true,
        insufficientReason: 'only 1 game(s) recorded',
      };

      const { valid, errors } = validatePersonalization(response, evidence);

      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });
  });

  describe('formatReferences', () => {
    it('should format references into readable text', () => {
      const references = [
        {
          kind: 'last10games' as const,
          text: 'In 3 of your last 10 games you missed back-rank tactics.',
          source: { gameIds: ['g1', 'g2', 'g3'] },
        },
        {
          kind: 'topMistakePattern' as const,
          text: 'Your #1 recurring mistake is hanging pieces (15 times).',
          source: { patternKey: 'hanging_pieces' },
        },
      ];

      const formatted = formatReferences(references);

      expect(formatted).toContain('In 3 of your last 10 games');
      expect(formatted).toContain('Your #1 recurring mistake');
      expect(formatted.split('.').length).toBeGreaterThan(2);
    });

    it('should handle empty references', () => {
      const formatted = formatReferences([]);
      expect(formatted).toBe('');
    });
  });

  describe('augmentWithPersonalization', () => {
    it('should add personalized context to response', () => {
      const baseResponse = 'Focus on controlling the center and developing pieces.';
      
      const references = [
        {
          kind: 'last10games' as const,
          text: 'In your last 5 games, you struggled with opening development.',
          source: { gameIds: ['g1', 'g2'] },
        },
        {
          kind: 'topMistakePattern' as const,
          text: 'Your #1 mistake is moving the same piece twice in the opening.',
          source: { patternKey: 'repeated_moves' },
        },
      ];

      const evidence = {
        lastGamesUsed: 5,
        gameIdsUsed: ['g1', 'g2'],
        topMistakePatternsUsed: ['repeated_moves'],
        personalizedReferenceCount: 2,
        insufficientHistory: false,
      };

      const augmented = augmentWithPersonalization(baseResponse, references, evidence);

      expect(augmented).toContain('Based on your history');
      expect(augmented).toContain('last 5 games');
      expect(augmented).toContain('#1 mistake');
      expect(augmented.length).toBeGreaterThan(baseResponse.length);
    });

    it('should add insufficient history note when appropriate', () => {
      const baseResponse = 'General chess advice.';
      
      const evidence = {
        lastGamesUsed: 1,
        gameIdsUsed: [],
        topMistakePatternsUsed: [],
        personalizedReferenceCount: 0,
        insufficientHistory: true,
        insufficientReason: 'only 1 game(s) recorded',
      };

      const augmented = augmentWithPersonalization(baseResponse, [], evidence);

      expect(augmented).toContain('only 1 game(s) recorded');
      expect(augmented).toContain('Play more games');
    });
  });
});
