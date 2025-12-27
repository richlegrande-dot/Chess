/**
 * Opening Book for Wall-E Chess Engine
 * 
 * Purpose: Provide instant responses for common opening positions (first 6 plies)
 * Scope: Standard openings only - e4, d4, c4, Nf3 and common responses
 * Behavior: Returns null if position not in book or moveNumber > 6
 * 
 * Difficulty variation:
 * - master: best move only
 * - advanced: weighted top 2
 * - intermediate: weighted top 3  
 * - beginner: weighted top 4 (more variety)
 */

import { Chess } from 'chess.js';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'master';

interface BookEntry {
  // Candidate moves in order of strength (best first)
  moves: string[];
  // Optional: human-readable description
  name?: string;
}

/**
 * Opening book keyed by FEN (position-based, not move-history based)
 * We use FEN to be robust to transpositions
 */
const OPENING_BOOK: Record<string, BookEntry> = {
  // Starting position - White to move
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': {
    moves: ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
    name: 'Starting position',
  },

  // After 1.e4 - Black to move
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': {
    moves: ['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d5'],
    name: 'After 1.e4',
  },

  // After 1.d4 - Black to move
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1': {
    moves: ['d7d5', 'g8f6', 'e7e6', 'c7c5'],
    name: 'After 1.d4',
  },

  // After 1.c4 - Black to move
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1': {
    moves: ['e7e5', 'g8f6', 'c7c5', 'e7e6'],
    name: 'After 1.c4 (English Opening)',
  },

  // After 1.Nf3 - Black to move
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1': {
    moves: ['d7d5', 'g8f6', 'c7c5', 'e7e6'],
    name: 'After 1.Nf3 (Réti Opening)',
  },

  // After 1.e4 e5 - White to move
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2': {
    moves: ['g1f3', 'f2f4', 'b1c3', 'd2d4'],
    name: 'After 1.e4 e5',
  },

  // After 1.e4 c5 (Sicilian) - White to move
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2': {
    moves: ['g1f3', 'b1c3', 'd2d4', 'c2c3'],
    name: 'After 1.e4 c5 (Sicilian Defense)',
  },

  // After 1.e4 e6 (French) - White to move
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': {
    moves: ['d2d4', 'g1f3', 'b1c3', 'd2d3'],
    name: 'After 1.e4 e6 (French Defense)',
  },

  // After 1.e4 c6 (Caro-Kann) - White to move
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': {
    moves: ['d2d4', 'b1c3', 'g1f3', 'd2d3'],
    name: 'After 1.e4 c6 (Caro-Kann Defense)',
  },

  // After 1.d4 d5 - White to move
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2': {
    moves: ['c2c4', 'g1f3', 'b1c3', 'e2e3'],
    name: 'After 1.d4 d5',
  },

  // After 1.d4 Nf6 - White to move
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2': {
    moves: ['c2c4', 'g1f3', 'b1c3', 'e2e3'],
    name: 'After 1.d4 Nf6',
  },

  // After 1.e4 e5 2.Nf3 - Black to move
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2': {
    moves: ['b8c6', 'g8f6', 'd7d6', 'f7f5'],
    name: 'After 1.e4 e5 2.Nf3',
  },

  // After 1.e4 e5 2.Nf3 Nc6 - White to move
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3': {
    moves: ['f1b5', 'f1c4', 'd2d4', 'b1c3'],
    name: 'After 1.e4 e5 2.Nf3 Nc6',
  },

  // After 1.e4 e5 2.Nf3 Nf6 (Petrov) - White to move
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3': {
    moves: ['b1c3', 'f3xe5', 'd2d4', 'f1c4'],
    name: 'After 1.e4 e5 2.Nf3 Nf6 (Petrov Defense)',
  },

  // After 1.e4 c5 2.Nf3 - Black to move
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2': {
    moves: ['d7d6', 'b8c6', 'e7e6', 'g7g6'],
    name: 'After 1.e4 c5 2.Nf3 (Sicilian)',
  },

  // After 1.e4 c5 2.Nf3 d6 - White to move
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3': {
    moves: ['d2d4', 'f1b5', 'c2c3', 'b1c3'],
    name: 'After 1.e4 c5 2.Nf3 d6',
  },

  // After 1.d4 d5 2.c4 - Black to move
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2': {
    moves: ['e7e6', 'c7c6', 'g8f6', 'd5xc4'],
    name: 'After 1.d4 d5 2.c4 (Queen\'s Gambit)',
  },

  // After 1.d4 Nf6 2.c4 - Black to move
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2': {
    moves: ['e7e6', 'g7g6', 'c7c5', 'd7d5'],
    name: 'After 1.d4 Nf6 2.c4',
  },

  // After 1.d4 Nf6 2.c4 e6 - White to move
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3': {
    moves: ['g1f3', 'b1c3', 'g2g3', 'c1g5'],
    name: 'After 1.d4 Nf6 2.c4 e6',
  },
};

/**
 * Pick an opening move from the book based on position and difficulty
 * @param fen Current position FEN
 * @param difficulty Player skill level
 * @returns UCI move string (e.g., 'e2e4') or null if not in book
 */
export function pickOpeningMove(fen: string, difficulty: Difficulty): string | null {
  const entry = OPENING_BOOK[fen];
  
  if (!entry || entry.moves.length === 0) {
    return null;
  }

  // Validate all moves are legal (safety check)
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  const legalUciMoves = new Set(
    legalMoves.map(m => m.from + m.to + (m.promotion || ''))
  );

  const validMoves = entry.moves.filter(move => legalUciMoves.has(move));
  
  if (validMoves.length === 0) {
    console.warn(`Opening book entry for ${fen} has no legal moves`);
    return null;
  }

  // Select move based on difficulty
  switch (difficulty) {
    case 'master':
      // Always pick best move (first in list)
      return validMoves[0];

    case 'advanced':
      // Weighted selection from top 2
      return weightedRandomSelect(validMoves.slice(0, 2), [0.8, 0.2]);

    case 'intermediate':
      // Weighted selection from top 3
      return weightedRandomSelect(validMoves.slice(0, 3), [0.6, 0.3, 0.1]);

    case 'beginner':
      // Weighted selection from top 4 (more variety)
      return weightedRandomSelect(validMoves.slice(0, 4), [0.4, 0.3, 0.2, 0.1]);

    default:
      return validMoves[0];
  }
}

/**
 * Check if we should use opening book for this position
 * @param fen Current position FEN
 * @returns true if position is in opening phase (first 6 plies / 3 moves)
 */
export function shouldUseOpeningBook(fen: string): boolean {
  // Extract move number from FEN (last field before halfmove clock)
  const parts = fen.split(' ');
  const fullMoveNumber = parseInt(parts[5] || '1', 10);
  
  // Use opening book only for first 3 full moves (6 plies)
  return fullMoveNumber <= 3;
}

/**
 * Weighted random selection from array
 */
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  if (items.length === 0) {
    throw new Error('Cannot select from empty array');
  }

  if (items.length === 1 || weights.length === 0) {
    return items[0];
  }

  // Normalize weights to match items length
  const normalizedWeights = weights.slice(0, items.length);
  const totalWeight = normalizedWeights.reduce((sum, w) => sum + w, 0);
  
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= normalizedWeights[i] || 0;
    if (random <= 0) {
      return items[i];
    }
  }

  return items[0]; // Fallback
}
