/**
 * Simple Opening Book
 * Provides instant opening moves for common positions to avoid slow depth searches
 */

import { Square } from 'chess.js';

interface BookMove {
  from: Square;
  to: Square;
}

// Opening book: FEN position -> good move
const OPENING_BOOK: { [fen: string]: BookMove[] } = {
  // Starting position - White's first move
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
    { from: 'e2', to: 'e4' },
    { from: 'd2', to: 'd4' },
    { from: 'g1', to: 'f3' },
    { from: 'c2', to: 'c4' },
  ],
  
  // After 1.e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': [
    { from: 'e7', to: 'e5' },
    { from: 'c7', to: 'c5' },
    { from: 'e7', to: 'e6' },
    { from: 'c7', to: 'c6' },
  ],
  
  // After 1.d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1': [
    { from: 'd7', to: 'd5' },
    { from: 'g8', to: 'f6' },
    { from: 'e7', to: 'e6' },
    { from: 'c7', to: 'c5' },
  ],
  
  // After 1.e4 e5
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2': [
    { from: 'g1', to: 'f3' },
    { from: 'f1', to: 'c4' },
    { from: 'b1', to: 'c3' },
  ],
  
  // After 1.d4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2': [
    { from: 'c2', to: 'c4' },
    { from: 'g1', to: 'f3' },
    { from: 'b1', to: 'c3' },
    { from: 'e2', to: 'e3' },
  ],
  
  // After 1.d4 d5 2.c4 (Queen's Gambit)
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2': [
    { from: 'e7', to: 'e6' },
    { from: 'c7', to: 'c6' },
    { from: 'd5', to: 'c4' },
    { from: 'g8', to: 'f6' },
  ],
  
  // After 1.d4 d5 2.e4 (Center Game / Blackmar-Diemer)
  'rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR b KQkq e3 0 2': [
    { from: 'd5', to: 'e4' },
    { from: 'e7', to: 'e6' },
    { from: 'c7', to: 'c6' },
  ],
  
  // After 1.e4 c5 (Sicilian)
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2': [
    { from: 'g1', to: 'f3' },
    { from: 'b1', to: 'c3' },
    { from: 'c2', to: 'c3' },
  ],
  
  // After 1.e4 e5 2.Nf3
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2': [
    { from: 'b8', to: 'c6' },
    { from: 'g8', to: 'f6' },
    { from: 'f8', to: 'c5' },
  ],
  
  // After 1.e4 e5 2.Nf3 Nc6
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3': [
    { from: 'f1', to: 'c4' },
    { from: 'f1', to: 'b5' },
    { from: 'd2', to: 'd4' },
    { from: 'b1', to: 'c3' },
  ],
  
  // After 1.d4 Nf6
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2': [
    { from: 'c2', to: 'c4' },
    { from: 'g1', to: 'f3' },
    { from: 'b1', to: 'c3' },
  ],
  
  // After 1.d4 Nf6 2.c4
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2': [
    { from: 'e7', to: 'e6' },
    { from: 'g7', to: 'g6' },
    { from: 'c7', to: 'c5' },
  ],
  
  // After 1.Nf3
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1': [
    { from: 'd7', to: 'd5' },
    { from: 'g8', to: 'f6' },
    { from: 'c7', to: 'c5' },
  ],
  
  // After 1.c4 (English Opening)
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1': [
    { from: 'e7', to: 'e5' },
    { from: 'g8', to: 'f6' },
    { from: 'c7', to: 'c5' },
  ],
};

/**
 * Look up a move from the opening book
 * @param fen - Current position FEN
 * @returns A good opening move, or null if position not in book
 */
export function getBookMove(fen: string): BookMove | null {
  const moves = OPENING_BOOK[fen];
  if (!moves || moves.length === 0) {
    return null;
  }
  
  // Return random move from the book moves for variety
  const randomIndex = Math.floor(Math.random() * moves.length);
  return moves[randomIndex];
}

/**
 * Check if position is in the opening book
 */
export function isInBook(fen: string): boolean {
  return fen in OPENING_BOOK;
}
