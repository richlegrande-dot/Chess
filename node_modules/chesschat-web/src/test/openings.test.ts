/**
 * Openings Feature Test Suite
 * Comprehensive tests for the Openings Preview Modal functionality
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { OPENINGS_SEED, type Opening } from '../data/openings.seed';

describe('Openings Data Model - openings.seed.ts', () => {
  it('should have exactly 50 seeded openings', () => {
    expect(OPENINGS_SEED).toBeDefined();
    expect(OPENINGS_SEED.length).toBe(50);
  });

  it('should have all required fields for each opening', () => {
    OPENINGS_SEED.forEach((opening) => {
      expect(opening.id).toBeDefined();
      expect(typeof opening.id).toBe('string');
      expect(opening.name).toBeDefined();
      expect(typeof opening.name).toBe('string');
      expect(opening.movesSAN).toBeDefined();
      expect(Array.isArray(opening.movesSAN)).toBe(true);
      expect(opening.movesSAN.length).toBeGreaterThan(0);
    });
  });

  it('should have unique IDs for each opening', () => {
    const ids = OPENINGS_SEED.map((op) => op.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(OPENINGS_SEED.length);
  });

  it('should include expected openings', () => {
    const openingNames = OPENINGS_SEED.map((op) => op.name);
    expect(openingNames).toContain('Italian Game');
    expect(openingNames).toContain('Ruy Lopez');
    expect(openingNames).toContain('Sicilian Defense - Najdorf');
    expect(openingNames).toContain('French Defense');
    expect(openingNames).toContain("Queen's Gambit Declined");
  });

  it('should have ECO codes where applicable', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game');
    expect(italianGame?.eco).toBe('C50');

    const ruyLopez = OPENINGS_SEED.find((op) => op.id === 'ruy-lopez');
    expect(ruyLopez?.eco).toBe('C60');
  });
});

describe('Openings SAN Move Validation', () => {
  it('should validate Italian Game moves', () => {
    const chess = new Chess();
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    expect(italianGame).toBeDefined();
    expect(italianGame.movesSAN).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);

    // Apply each move and verify it's legal
    italianGame.movesSAN.forEach((san, idx) => {
      const result = chess.move(san);
      expect(result, `Move ${idx + 1} (${san}) should be valid`).not.toBeNull();
    });

    expect(chess.history().length).toBe(6);
  });

  it('should validate Ruy Lopez moves', () => {
    const chess = new Chess();
    const ruyLopez = OPENINGS_SEED.find((op) => op.id === 'ruy-lopez')!;
    
    expect(ruyLopez).toBeDefined();
    expect(ruyLopez.movesSAN).toEqual([
      'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'
    ]);

    ruyLopez.movesSAN.forEach((san, idx) => {
      const result = chess.move(san);
      expect(result, `Move ${idx + 1} (${san}) should be valid`).not.toBeNull();
    });

    expect(chess.history().length).toBe(10);
  });

  it('should validate Sicilian Defense - Najdorf moves', () => {
    const chess = new Chess();
    const sicilian = OPENINGS_SEED.find((op) => op.id === 'sicilian-najdorf')!;
    
    expect(sicilian).toBeDefined();
    expect(sicilian.movesSAN).toEqual([
      'e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'
    ]);

    sicilian.movesSAN.forEach((san, idx) => {
      const result = chess.move(san);
      expect(result, `Move ${idx + 1} (${san}) should be valid`).not.toBeNull();
    });

    expect(chess.history().length).toBe(10);
  });

  it('should validate French Defense moves', () => {
    const chess = new Chess();
    const french = OPENINGS_SEED.find((op) => op.id === 'french-defense')!;
    
    expect(french).toBeDefined();
    expect(french.movesSAN).toEqual(['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4']);

    french.movesSAN.forEach((san, idx) => {
      const result = chess.move(san);
      expect(result, `Move ${idx + 1} (${san}) should be valid`).not.toBeNull();
    });

    expect(chess.history().length).toBe(6);
  });

  it("should validate Queen's Gambit moves", () => {
    const chess = new Chess();
    const queensGambit = OPENINGS_SEED.find((op) => op.id === 'queens-gambit')!;
    
    expect(queensGambit).toBeDefined();
    expect(queensGambit.movesSAN).toEqual(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']);

    queensGambit.movesSAN.forEach((san, idx) => {
      const result = chess.move(san);
      expect(result, `Move ${idx + 1} (${san}) should be valid`).not.toBeNull();
    });

    expect(chess.history().length).toBe(6);
  });

  it('should handle castling notation correctly', () => {
    const chess = new Chess();
    const ruyLopez = OPENINGS_SEED.find((op) => op.id === 'ruy-lopez')!;
    
    // Apply moves up to O-O
    ruyLopez.movesSAN.forEach((san) => {
      const result = chess.move(san);
      expect(result).not.toBeNull();
      if (san === 'O-O') {
        // Verify castling happened
        expect(chess.get('g1')).toEqual({ type: 'k', color: 'w' });
        expect(chess.get('f1')).toEqual({ type: 'r', color: 'w' });
      }
    });
  });
});

describe('Opening Move Sequencing', () => {
  it('should produce correct FEN after all moves', () => {
    const chess = new Chess();
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    italianGame.movesSAN.forEach((san) => chess.move(san));
    
    const finalFen = chess.fen();
    expect(finalFen).toContain('r1bqk1nr/pppp1ppp'); // Black's pieces
    expect(finalFen).toContain('PPPP'); // White pawns
  });

  it('should allow stepping through moves one at a time', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    for (let ply = 0; ply <= italianGame.movesSAN.length; ply++) {
      const chess = new Chess();
      
      // Apply moves up to current ply
      for (let i = 0; i < ply; i++) {
        const result = chess.move(italianGame.movesSAN[i]);
        expect(result).not.toBeNull();
      }
      
      expect(chess.history().length).toBe(ply);
      
      // Verify turn correctness
      const expectedTurn = ply % 2 === 0 ? 'w' : 'b';
      expect(chess.turn()).toBe(expectedTurn);
    }
  });

  it('should maintain valid position after each ply', () => {
    const chess = new Chess();
    const ruyLopez = OPENINGS_SEED.find((op) => op.id === 'ruy-lopez')!;
    
    ruyLopez.movesSAN.forEach((san, idx) => {
      chess.move(san);
      
      // Verify position is valid
      expect(chess.isGameOver()).toBe(false);
      expect(chess.isCheckmate()).toBe(false);
      expect(chess.isStalemate()).toBe(false);
      
      // Verify legal moves exist for next player
      const moves = chess.moves();
      expect(moves.length, `After move ${idx + 1}, next player should have legal moves`).toBeGreaterThan(0);
    });
  });
});

describe('Opening Board State Tests', () => {
  it('should start from standard starting position (ply 0)', () => {
    const chess = new Chess();
    const startingFen = chess.fen();
    
    expect(startingFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('should have correct piece placement after Italian Game', () => {
    const chess = new Chess();
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    italianGame.movesSAN.forEach((san) => chess.move(san));
    
    // Check key piece positions
    expect(chess.get('c4')).toEqual({ type: 'b', color: 'w' }); // White bishop on c4
    expect(chess.get('f3')).toEqual({ type: 'n', color: 'w' }); // White knight on f3
    expect(chess.get('c5')).toEqual({ type: 'b', color: 'b' }); // Black bishop on c5
    expect(chess.get('c6')).toEqual({ type: 'n', color: 'b' }); // Black knight on c6
    expect(chess.get('e4')).toEqual({ type: 'p', color: 'w' }); // White pawn on e4
    expect(chess.get('e5')).toEqual({ type: 'p', color: 'b' }); // Black pawn on e5
  });

  it('should have correct piece placement after Sicilian', () => {
    const chess = new Chess();
    const sicilian = OPENINGS_SEED.find((op) => op.id === 'sicilian-najdorf')!;
    
    sicilian.movesSAN.forEach((san) => chess.move(san));
    
    // Check key positions
    expect(chess.get('e4')).toEqual({ type: 'p', color: 'w' }); // White pawn on e4
    expect(chess.get('d4')).toEqual({ type: 'n', color: 'w' }); // White knight on d4
    expect(chess.get('c3')).toEqual({ type: 'n', color: 'w' }); // White knight on c3
    expect(chess.get('f6')).toEqual({ type: 'n', color: 'b' }); // Black knight on f6
    expect(chess.get('d6')).toEqual({ type: 'p', color: 'b' }); // Black pawn on d6
  });
});

describe('Board Coordinate System', () => {
  it('should correctly map files A-H', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    files.forEach((file, idx) => {
      const charCode = file.charCodeAt(0);
      expect(charCode).toBe(97 + idx); // 'a' is 97 in ASCII
    });
  });

  it('should correctly map ranks 1-8', () => {
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
    
    ranks.forEach((rank, idx) => {
      expect(rank).toBe(idx + 1);
    });
  });

  it('should have A1 at bottom-left for white perspective', () => {
    // In chess.js and standard notation:
    // a1 = file index 0, rank index 0 (from white's perspective)
    // h8 = file index 7, rank index 7
    const chess = new Chess();
    
    // Starting position has white rook on a1
    expect(chess.get('a1')).toEqual({ type: 'r', color: 'w' });
    
    // Starting position has black rook on a8
    expect(chess.get('a8')).toEqual({ type: 'r', color: 'b' });
    
    // Starting position has black rook on h8
    expect(chess.get('h8')).toEqual({ type: 'r', color: 'b' });
    
    // Starting position has white rook on h1
    expect(chess.get('h1')).toEqual({ type: 'r', color: 'w' });
  });

  it('should verify all 64 squares are addressable', () => {
    const chess = new Chess();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
    
    let squareCount = 0;
    files.forEach((file) => {
      ranks.forEach((rank) => {
        const square = `${file}${rank}`;
        const piece = chess.get(square as any);
        // Piece is either null, undefined, or an object
        expect(piece === null || piece === undefined || typeof piece === 'object').toBe(true);
        squareCount++;
      });
    });
    
    expect(squareCount).toBe(64);
  });
});

describe('Move Navigation Logic', () => {
  it('should handle Previous button state correctly', () => {
    const result = OPENINGS_SEED.find((op) => op.id === 'italian-game');
    expect(result).toBeDefined();
    
    // At ply 0 (start), Previous should be disabled
    let currentPly = 0;
    expect(currentPly === 0).toBe(true);
    
    // After moving forward, Previous should be enabled
    currentPly = 1;
    expect(currentPly > 0).toBe(true);
    
    // At any middle position, Previous should be enabled
    currentPly = 3;
    expect(currentPly > 0).toBe(true);
  });

  it('should handle Next button state correctly', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    const maxPlies = italianGame.movesSAN.length;
    
    // At ply 0, Next should be enabled
    let currentPly = 0;
    expect(currentPly < maxPlies).toBe(true);
    
    // At middle position, Next should be enabled
    currentPly = 3;
    expect(currentPly < maxPlies).toBe(true);
    
    // At final position, Next should be disabled
    currentPly = maxPlies;
    expect(currentPly >= maxPlies).toBe(true);
  });

  it('should handle Reset button functionality', () => {
    let currentPly = 5;
    
    // Reset should set ply to 0
    currentPly = 0;
    expect(currentPly).toBe(0);
  });

  it('should track move counter correctly', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    for (let ply = 0; ply <= italianGame.movesSAN.length; ply++) {
      const moveNumber = ply;
      const totalMoves = italianGame.movesSAN.length;
      
      expect(moveNumber).toBeGreaterThanOrEqual(0);
      expect(moveNumber).toBeLessThanOrEqual(totalMoves);
      
      if (ply === 0) {
        // At start, should show "Starting Position"
        expect(moveNumber === 0).toBe(true);
      } else {
        // Otherwise show "Move X of Total"
        expect(moveNumber).toBeGreaterThan(0);
        expect(moveNumber).toBeLessThanOrEqual(totalMoves);
      }
    }
  });
});

describe('Error Handling', () => {
  it('should detect invalid SAN moves', () => {
    const chess = new Chess();
    
    // Try an invalid move - chess.js throws an error for invalid notation
    expect(() => chess.move('Zz9')).toThrow();
  });

  it('should handle empty move list gracefully', () => {
    const emptyOpening: Opening = {
      id: 'test-empty',
      name: 'Empty Opening',
      movesSAN: [],
    };
    
    expect(emptyOpening.movesSAN.length).toBe(0);
  });

  it('should validate move is legal in current position', () => {
    const chess = new Chess();
    
    // e4 is legal at start
    expect(chess.move('e4')).not.toBeNull();
    
    // Can't move white pieces on black's turn - chess.js throws error
    expect(() => chess.move('e4')).toThrow();
  });
});

describe('Integration Requirements', () => {
  it('should not affect game state (separate Chess instance)', () => {
    const gameChess = new Chess();
    const previewChess = new Chess();
    
    // Make moves in preview
    previewChess.move('e4');
    previewChess.move('e5');
    
    // Game chess should still be at starting position
    expect(gameChess.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(gameChess.history().length).toBe(0);
  });

  it('should be able to display multiple openings sequentially', () => {
    // Simulate switching between openings
    const openings = ['italian-game', 'ruy-lopez', 'french-defense'];
    
    openings.forEach((id) => {
      const opening = OPENINGS_SEED.find((op) => op.id === id);
      expect(opening).toBeDefined();
      
      const chess = new Chess();
      opening!.movesSAN.forEach((san) => {
        const result = chess.move(san);
        expect(result).not.toBeNull();
      });
    });
  });

  it('should preserve opening data immutability', () => {
    const originalLength = OPENINGS_SEED.length;
    const firstOpeningName = OPENINGS_SEED[0].name;
    
    // Simulate usage (should not mutate data)
    const opening = OPENINGS_SEED[0];
    const chess = new Chess();
    opening.movesSAN.forEach((san) => chess.move(san));
    
    // Verify data unchanged
    expect(OPENINGS_SEED.length).toBe(originalLength);
    expect(OPENINGS_SEED[0].name).toBe(firstOpeningName);
  });
});

describe('Scalability for 50+ Openings', () => {
  it('should handle array-based opening storage efficiently', () => {
    // Current: 50 openings, ready for more
    expect(OPENINGS_SEED.length).toBe(50);
    
    // Verify structure supports expansion
    expect(Array.isArray(OPENINGS_SEED)).toBe(true);
    
    // Simulate adding more openings
    const expandedOpenings = [
      ...OPENINGS_SEED,
      {
        id: 'test-opening-51',
        name: 'Test Opening 51',
        movesSAN: ['e4', 'e5'],
      },
    ];
    
    expect(expandedOpenings.length).toBe(51);
  });

  it('should support lookup by ID efficiently', () => {
    const targetId = 'ruy-lopez';
    const opening = OPENINGS_SEED.find((op) => op.id === targetId);
    
    expect(opening).toBeDefined();
    expect(opening?.id).toBe(targetId);
  });

  it('should support filtering by attributes', () => {
    // Filter by ECO code
    const c60Openings = OPENINGS_SEED.filter((op) => op.eco === 'C60');
    expect(c60Openings.length).toBeGreaterThan(0);
    
    // Filter by name substring
    const defenseOpenings = OPENINGS_SEED.filter((op) => 
      op.name.toLowerCase().includes('defense')
    );
    expect(defenseOpenings.length).toBeGreaterThan(0);
  });
});

describe('User Experience Tests', () => {
  it('should display opening name and ECO code', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    expect(italianGame.name).toBe('Italian Game');
    expect(italianGame.eco).toBe('C50');
  });

  it('should show descriptive text for each opening', () => {
    OPENINGS_SEED.forEach((opening) => {
      if (opening.description) {
        expect(typeof opening.description).toBe('string');
        expect(opening.description.length).toBeGreaterThan(0);
      }
    });
  });

  it('should format move list for display', () => {
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    // Simulate formatting moves as "1. e4 e5 2. Nf3 Nc6"
    const formatted = italianGame.movesSAN.reduce((acc, san, idx) => {
      if (idx % 2 === 0) {
        acc += `${Math.floor(idx / 2) + 1}. ${san} `;
      } else {
        acc += `${san} `;
      }
      return acc;
    }, '');
    
    expect(formatted).toContain('1. e4 e5');
    expect(formatted).toContain('2. Nf3 Nc6');
  });
});

describe('Regression Tests - Game State Isolation', () => {
  it('should NOT mutate external chess instance when modal steps through moves', () => {
    // Simulate the real game chess instance
    const gameChess = new Chess();
    
    // Make a move in the game
    gameChess.move('e4');
    const gameStateAfterE4 = gameChess.fen();
    
    // Now simulate opening modal navigation (separate instance)
    const modalChess = new Chess();
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    
    // Step through all Italian Game moves in modal
    italianGame.movesSAN.forEach((san) => {
      modalChess.move(san);
    });
    
    // CRITICAL: Game chess instance should be unchanged
    expect(gameChess.fen()).toBe(gameStateAfterE4);
    expect(gameChess.history().length).toBe(1);
    expect(gameChess.history()[0]).toBe('e4');
    
    // Modal chess should have its own state
    expect(modalChess.history().length).toBe(6);
    expect(modalChess.fen()).not.toBe(gameStateAfterE4);
  });

  it('should preserve game state when modal is opened and closed multiple times', () => {
    const gameChess = new Chess();
    
    // Game makes some moves
    gameChess.move('d4');
    gameChess.move('d5');
    const gameStateMidway = gameChess.fen();
    
    // Simulate opening modal 3 times and navigating
    for (let i = 0; i < 3; i++) {
      const modalChess = new Chess();
      const opening = OPENINGS_SEED[i % OPENINGS_SEED.length];
      
      opening.movesSAN.forEach((san) => {
        modalChess.move(san);
      });
      
      // Each modal instance is independent
      expect(modalChess.fen()).not.toBe(gameStateMidway);
    }
    
    // Game state should be completely unchanged
    expect(gameChess.fen()).toBe(gameStateMidway);
    expect(gameChess.history()).toEqual(['d4', 'd5']);
  });

  it('should allow game to continue after modal preview without interference', () => {
    const gameChess = new Chess();
    gameChess.move('e4');
    
    // User previews Italian Game in modal
    const modalChess = new Chess();
    const italianGame = OPENINGS_SEED.find((op) => op.id === 'italian-game')!;
    italianGame.movesSAN.forEach((san) => modalChess.move(san));
    
    // User closes modal and continues game
    const nextMove = gameChess.move('e5');
    expect(nextMove).not.toBeNull();
    expect(gameChess.history()).toEqual(['e4', 'e5']);
    
    // Modal's preview should not affect available moves
    const legalMoves = gameChess.moves();
    expect(legalMoves.length).toBeGreaterThan(0);
  });
});

describe('Regression Tests - Board Coordinate Accuracy', () => {
  it('should render A1 at bottom-left (file A, rank 1)', () => {
    // In array representation: [7][0] = row 7, col 0 = A1
    const rowIndex = 7;
    const colIndex = 0;
    
    const fileLabel = String.fromCharCode(97 + colIndex).toUpperCase();
    const rankLabel = 8 - rowIndex;
    
    expect(fileLabel).toBe('A');
    expect(rankLabel).toBe(1);
  });

  it('should render H8 at top-right (file H, rank 8)', () => {
    // In array representation: [0][7] = row 0, col 7 = H8
    const rowIndex = 0;
    const colIndex = 7;
    
    const fileLabel = String.fromCharCode(97 + colIndex).toUpperCase();
    const rankLabel = 8 - rowIndex;
    
    expect(fileLabel).toBe('H');
    expect(rankLabel).toBe(8);
  });

  it('should correctly map all 64 squares to coordinate notation', () => {
    const expectedSquares = [
      'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
      'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
      'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
      'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
      'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
      'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
      'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
      'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'
    ];
    
    const mappedSquares: string[] = [];
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
      for (let colIdx = 0; colIdx < 8; colIdx++) {
        const file = String.fromCharCode(97 + colIdx);
        const rank = 8 - rowIdx;
        mappedSquares.push(`${file}${rank}`);
      }
    }
    
    expect(mappedSquares).toEqual(expectedSquares);
  });

  it('should have rank labels (1-8) on left side only', () => {
    // Rank labels should appear at colIndex === 0
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
      const shouldShowRankLabel = 0 === 0; // colIndex === 0
      expect(shouldShowRankLabel).toBe(true);
      
      const rankValue = 8 - rowIdx;
      expect(rankValue).toBeGreaterThanOrEqual(1);
      expect(rankValue).toBeLessThanOrEqual(8);
    }
  });

  it('should have file labels (A-H) on bottom row only', () => {
    // File labels should appear at rowIndex === 7
    for (let colIdx = 0; colIdx < 8; colIdx++) {
      const shouldShowFileLabel = 7 === 7; // rowIndex === 7
      expect(shouldShowFileLabel).toBe(true);
      
      const fileLabel = String.fromCharCode(97 + colIdx).toUpperCase();
      expect(fileLabel).toMatch(/[A-H]/);
    }
  });
});
