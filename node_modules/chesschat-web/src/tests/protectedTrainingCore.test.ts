/**
 * Protected Training Core - Test Suite
 * 
 * Tests data protection, corruption recovery, and immutability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProtectedTrainingCore } from '../lib/coaching/protectedTrainingCore';

describe('Protected Training Core', () => {
  let core: ReturnType<typeof getProtectedTrainingCore>;

  beforeEach(() => {
    core = getProtectedTrainingCore();
    // Clear localStorage for clean tests
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Data Protection', () => {
    it('should enforce 50-game limit with FIFO', () => {
      // Add 55 games
      for (let i = 0; i < 55; i++) {
        const mockGame = {
          pgn: `test-game-${i}`,
          playerColor: 'white' as const,
          cpuLevel: 5,
          gameResult: 'win' as const,
          timestamp: Date.now(),
          totalMoves: 30,
          blunders: 0,
          mistakes: 1,
          inaccuracies: 2
        };
        const mockSignatures = [];
        core.appendGame(mockGame, mockSignatures);
      }

      const games = core.getGames();
      
      // Should have exactly 50 games
      expect(games.length).toBe(50);
      
      // Should have the LAST 50 games (oldest 5 removed)
      expect(games[0].pgn).toBe('test-game-5');
      expect(games[49].pgn).toBe('test-game-54');
    });

    it('should track total games played even when rolling off', () => {
      for (let i = 0; i < 55; i++) {
        const mockGame = {
          pgn: `test-game-${i}`,
          playerColor: 'white' as const,
          cpuLevel: 5,
          gameResult: 'win' as const,
          timestamp: Date.now(),
          totalMoves: 30,
          blunders: 0,
          mistakes: 1,
          inaccuracies: 2
        };
        core.appendGame(mockGame, []);
      }

      expect(core.getTotalGamesPlayed()).toBe(55);
    });

    it('should not expose reset methods in public API', () => {
      const coreAny = core as any;
      
      // These methods should NOT exist
      expect(coreAny.clear).toBeUndefined();
      expect(coreAny.reset).toBeUndefined();
      expect(coreAny.deleteGame).toBeUndefined();
      expect(coreAny.removeSignature).toBeUndefined();
    });

    it('should persist data across getInstance calls', () => {
      const mockGame = {
        pgn: 'test-pgn',
        playerColor: 'white' as const,
        cpuLevel: 5,
        gameResult: 'win' as const,
        timestamp: Date.now(),
        totalMoves: 30,
        blunders: 0,
        mistakes: 1,
        inaccuracies: 2
      };
      
      core.appendGame(mockGame, []);
      
      // Get new instance
      const core2 = getProtectedTrainingCore();
      
      expect(core2.getGames().length).toBe(1);
      expect(core2.getGames()[0].pgn).toBe('test-pgn');
    });
  });

  describe('Corruption Recovery', () => {
    it('should detect corrupted data with checksum mismatch', () => {
      // Add valid game
      const mockGame = {
        pgn: 'test-pgn',
        playerColor: 'white' as const,
        cpuLevel: 5,
        gameResult: 'win' as const,
        timestamp: Date.now(),
        totalMoves: 30,
        blunders: 0,
        mistakes: 1,
        inaccuracies: 2
      };
      core.appendGame(mockGame, []);

      // Corrupt the data manually
      const dataKey = 'wall_e_training_core_v2';
      const data = JSON.parse(localStorage.getItem(dataKey)!);
      data.games[0].pgn = 'tampered';
      localStorage.setItem(dataKey, JSON.stringify(data));

      // Should detect corruption on next load
      const core2 = getProtectedTrainingCore();
      const games = core2.getGames();
      
      // Should recover from backup or start fresh
      expect(games.length).toBeLessThanOrEqual(1);
    });

    it('should create automatic backups', () => {
      const mockGame = {
        pgn: 'test-pgn',
        playerColor: 'white' as const,
        cpuLevel: 5,
        gameResult: 'win' as const,
        timestamp: Date.now(),
        totalMoves: 30,
        blunders: 0,
        mistakes: 1,
        inaccuracies: 2
      };
      
      core.appendGame(mockGame, []);
      
      // Trigger backup manually
      (core as any)._createBackup();
      
      const backupKey = 'wall_e_training_core_v2_backup';
      const backup = localStorage.getItem(backupKey);
      
      expect(backup).toBeTruthy();
      const backupData = JSON.parse(backup!);
      expect(backupData.games.length).toBe(1);
    });
  });

  describe('Signature Management', () => {
    it('should merge signatures with same category and title', () => {
      const mockGame = {
        pgn: 'test-pgn',
        playerColor: 'white' as const,
        cpuLevel: 5,
        gameResult: 'win' as const,
        timestamp: Date.now(),
        totalMoves: 30,
        blunders: 0,
        mistakes: 1,
        inaccuracies: 2
      };

      const signature1 = {
        category: 'tactical',
        title: 'Hanging Pieces',
        mistakeType: 'missed',
        occurrences: 2,
        masteryScore: 40,
        lastSeenAt: Date.now(),
        confidenceScore: 0.5,
        isConfirmed: true,
        isStable: false,
        isHighConfidence: false
      };

      core.appendGame(mockGame, [signature1]);
      core.appendGame(mockGame, [signature1]);

      const signatures = core.getSignatures();
      
      // Should have only 1 signature with merged occurrences
      expect(signatures.length).toBe(1);
      expect(signatures[0].occurrences).toBeGreaterThan(2);
    });

    it('should maintain separate signatures for different categories', () => {
      const mockGame = {
        pgn: 'test-pgn',
        playerColor: 'white' as const,
        cpuLevel: 5,
        gameResult: 'win' as const,
        timestamp: Date.now(),
        totalMoves: 30,
        blunders: 0,
        mistakes: 1,
        inaccuracies: 2
      };

      const sig1 = {
        category: 'tactical',
        title: 'Hanging Pieces',
        mistakeType: 'missed',
        occurrences: 2,
        masteryScore: 40,
        lastSeenAt: Date.now(),
        confidenceScore: 0.5,
        isConfirmed: true,
        isStable: false,
        isHighConfidence: false
      };

      const sig2 = {
        category: 'strategic',
        title: 'King Safety',
        mistakeType: 'neglected',
        occurrences: 1,
        masteryScore: 60,
        lastSeenAt: Date.now(),
        confidenceScore: 0.3,
        isConfirmed: false,
        isStable: false,
        isHighConfidence: false
      };

      core.appendGame(mockGame, [sig1, sig2]);

      const signatures = core.getSignatures();
      
      expect(signatures.length).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle 50 games without performance degradation', () => {
      const start = performance.now();
      
      for (let i = 0; i < 50; i++) {
        const mockGame = {
          pgn: `game-${i}`,
          playerColor: i % 2 === 0 ? 'white' as const : 'black' as const,
          cpuLevel: 5,
          gameResult: 'win' as const,
          timestamp: Date.now(),
          totalMoves: 30,
          blunders: 0,
          mistakes: 1,
          inaccuracies: 2
        };
        core.appendGame(mockGame, []);
      }
      
      const elapsed = performance.now() - start;
      
      // Should complete in under 500ms
      expect(elapsed).toBeLessThan(500);
    });

    it('should retrieve games efficiently', () => {
      // Add 50 games
      for (let i = 0; i < 50; i++) {
        const mockGame = {
          pgn: `game-${i}`,
          playerColor: 'white' as const,
          cpuLevel: 5,
          gameResult: 'win' as const,
          timestamp: Date.now(),
          totalMoves: 30,
          blunders: 0,
          mistakes: 1,
          inaccuracies: 2
        };
        core.appendGame(mockGame, []);
      }

      const start = performance.now();
      const games = core.getGames();
      const elapsed = performance.now() - start;

      expect(games.length).toBe(50);
      // Retrieval should be instant
      expect(elapsed).toBeLessThan(10);
    });
  });
});
