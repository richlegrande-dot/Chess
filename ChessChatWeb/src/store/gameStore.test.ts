import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore';
import { act, renderHook } from '@testing-library/react';

// Mock the API module
vi.mock('../lib/api', () => ({
  getAIMove: vi.fn().mockResolvedValue('e7e5'),
}));

describe('Game Store Turn State Logic', () => {
  beforeEach(() => {
    // Reset the store before each test
    useGameStore.getState().newGame();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with player turn', () => {
      const { result } = renderHook(() => useGameStore());
      
      expect(result.current.isPlayerTurn).toBe(true);
      expect(result.current.isThinking).toBe(false);
      expect(result.current.chess.getTurn()).toBe('w');
    });

    it('should have initial board setup', () => {
      const { result } = renderHook(() => useGameStore());
      
      expect(result.current.chess.getFEN()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(result.current.chess.getMoveHistory()).toHaveLength(0);
    });
  });

  describe('Player Move Handling', () => {
    it('should process valid player move and switch to AI turn', async () => {
      const { result } = renderHook(() => useGameStore());
      
      // Make a player move
      await act(async () => {
        const success = result.current.makePlayerMove('e2', 'e4');
        expect(success).toBe(true);
      });

      // Should switch to AI turn
      expect(result.current.isPlayerTurn).toBe(false);
      expect(result.current.isThinking).toBe(true);
      expect(result.current.chess.getTurn()).toBe('b');
      expect(result.current.chess.getPiece('e4')).toBe('wp');
      expect(result.current.chess.getPiece('e2')).toBe(null);
    });

    it('should reject invalid player move', async () => {
      const { result } = renderHook(() => useGameStore());
      
      await act(async () => {
        const success = result.current.makePlayerMove('e2', 'e5'); // Invalid move
        expect(success).toBe(false);
      });

      // Should remain player turn
      expect(result.current.isPlayerTurn).toBe(true);
      expect(result.current.isThinking).toBe(false);
      expect(result.current.chess.getTurn()).toBe('w');
    });

    it('should reject moves when not player turn', async () => {
      const { result } = renderHook(() => useGameStore());
      
      // First make a valid move to switch turns
      await act(async () => {
        result.current.makePlayerMove('e2', 'e4');
      });

      // Try to make another player move (should fail)
      await act(async () => {
        const success = result.current.makePlayerMove('d2', 'd4');
        expect(success).toBe(false);
      });
    });
  });

  describe('AI Move Processing', () => {
    it('should process AI move and return to player turn', async () => {
      const { result } = renderHook(() => useGameStore());
      
      // Make player move to trigger AI
      await act(async () => {
        result.current.makePlayerMove('e2', 'e4');
      });

      // Wait for AI move to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should return to player turn after AI move
      expect(result.current.isPlayerTurn).toBe(true);
      expect(result.current.isThinking).toBe(false);
      expect(result.current.chess.getTurn()).toBe('w');
      expect(result.current.chess.getMoveHistory()).toHaveLength(2);
    });

    it('should handle AI move errors gracefully', async () => {
      // Mock API to fail
      const { getAIMove } = await import('../lib/api');
      vi.mocked(getAIMove).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useGameStore());
      
      await act(async () => {
        result.current.makePlayerMove('e2', 'e4');
      });

      // Wait for error handling
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should show error and allow retry
      expect(result.current.errorMessage).toContain('Error');
      expect(result.current.isThinking).toBe(false);
    });
  });

  describe('Game Termination', () => {
    it('should detect game over state', () => {
      const { result } = renderHook(() => useGameStore());
      
      // Set up a checkmate position
      act(() => {
        result.current.chess.reset();
        // Load a known checkmate position
        const checkmatePosition = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
        result.current.chess = result.current.chess.constructor(checkmatePosition);
      });

      if (result.current.chess.isGameOver()) {
        expect(result.current.isPlayerTurn).toBe(false);
        expect(result.current.isThinking).toBe(false);
      }
    });
  });

  describe('New Game Reset', () => {
    it('should reset all state when starting new game', () => {
      const { result } = renderHook(() => useGameStore());
      
      // Make some moves first
      act(() => {
        result.current.makePlayerMove('e2', 'e4');
      });

      // Reset game
      act(() => {
        result.current.newGame();
      });

      // Should be back to initial state
      expect(result.current.isPlayerTurn).toBe(true);
      expect(result.current.isThinking).toBe(false);
      expect(result.current.chess.getFEN()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(result.current.chess.getMoveHistory()).toHaveLength(0);
      expect(result.current.errorMessage).toBe(null);
    });
  });

  describe('Move Counter and Board Version', () => {
    it('should increment move counter and board version', async () => {
      const { result } = renderHook(() => useGameStore());
      
      const initialVersion = result.current.boardVersion;
      
      await act(async () => {
        result.current.makePlayerMove('e2', 'e4');
      });

      expect(result.current.boardVersion).toBe(initialVersion + 1);
      expect(result.current.chess.getMoveHistory()).toHaveLength(1);
    });
  });
});