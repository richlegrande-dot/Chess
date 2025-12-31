/**
 * Smart Position Sampling for Learning V3
 * 
 * Intelligently selects which positions to analyze with Stockfish
 * based on tactical patterns, material changes, and potential mistakes.
 * 
 * This replaces the naive "first N plies" approach with targeted analysis
 * of the most learning-valuable positions.
 */

import { Chess } from 'chess.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PositionCandidate {
  moveNumber: number;
  fen: string;
  moveSAN: string;
  moveUCI: string;
  reason: string[];
  priority: number;
  phase: 'opening' | 'middlegame' | 'endgame';
}

export interface SamplingConfig {
  maxPositions: number;
  includeOpening: boolean;
  includeTactical: boolean;
  includeMaterialSwings: boolean;
  includeCheckMate: boolean;
}

export interface SamplingResult {
  candidates: PositionCandidate[];
  totalMoves: number;
  samplingReason: string;
}

// ============================================================================
// HEURISTIC DETECTION
// ============================================================================

/**
 * Detect if move is a capture based on SAN notation
 */
function isCapture(san: string): boolean {
  return san.includes('x');
}

/**
 * Detect if move is a check based on SAN notation
 */
function isCheck(san: string): boolean {
  return san.includes('+') && !san.includes('#');
}

/**
 * Detect if move is checkmate based on SAN notation
 */
function isCheckmate(san: string): boolean {
  return san.includes('#');
}

/**
 * Detect if move is a promotion
 */
function isPromotion(san: string): boolean {
  return san.includes('=');
}

/**
 * Detect if move involves castling
 */
function isCastling(san: string): boolean {
  return san.includes('O-O');
}

/**
 * Calculate material balance from FEN
 */
function getMaterialBalance(fen: string): number {
  const pieceValues: { [key: string]: number } = {
    'p': -1, 'n': -3, 'b': -3, 'r': -5, 'q': -9,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9
  };
  
  const position = fen.split(' ')[0];
  let balance = 0;
  
  for (const char of position) {
    if (pieceValues[char]) {
      balance += pieceValues[char];
    }
  }
  
  return balance;
}

/**
 * Determine game phase based on move number and material
 */
function getGamePhase(moveNumber: number, materialCount: number): 'opening' | 'middlegame' | 'endgame' {
  if (moveNumber <= 10) return 'opening';
  if (materialCount <= 20) return 'endgame'; // Less than ~2 minor pieces per side
  return 'middlegame';
}

/**
 * Count total material on board
 */
function getTotalMaterial(fen: string): number {
  const pieceValues: { [key: string]: number } = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9
  };
  
  const position = fen.split(' ')[0];
  let total = 0;
  
  for (const char of position) {
    if (pieceValues[char]) {
      total += pieceValues[char];
    }
  }
  
  return total;
}

/**
 * Detect if king is exposed (simple heuristic)
 */
function isKingExposed(fen: string, side: 'white' | 'black'): boolean {
  const position = fen.split(' ')[0];
  const ranks = position.split('/');
  
  const kingChar = side === 'white' ? 'K' : 'k';
  
  // Find king position
  for (let rankIdx = 0; rankIdx < ranks.length; rankIdx++) {
    const rank = ranks[rankIdx];
    let fileIdx = 0;
    
    for (const char of rank) {
      if (char === kingChar) {
        // King on back rank (0 or 7) is safer
        const isBackRank = (side === 'white' && rankIdx === 7) || (side === 'black' && rankIdx === 0);
        // King in center files (c-f) is more exposed
        const isCenterFile = fileIdx >= 2 && fileIdx <= 5;
        
        return !isBackRank && isCenterFile;
      }
      
      if (char >= '1' && char <= '8') {
        fileIdx += parseInt(char);
      } else {
        fileIdx++;
      }
    }
  }
  
  return false;
}

// ============================================================================
// SMART SAMPLING ALGORITHM
// ============================================================================

/**
 * Select positions for Stockfish analysis using heuristics
 * 
 * Two-pass approach:
 * 1. Fast pass: Identify candidates using SAN patterns and FEN heuristics
 * 2. Prioritization: Rank candidates and select top N
 */
export function selectPositionsForAnalysis(
  pgn: string,
  config: SamplingConfig
): SamplingResult {
  const chess = new Chess();
  const candidates: PositionCandidate[] = [];
  
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    return {
      candidates: [],
      totalMoves: 0,
      samplingReason: 'pgn-parse-error'
    };
  }
  
  const history = chess.history({ verbose: true });
  const totalMoves = history.length;
  
  // Reset to start position
  chess.reset();
  
  let previousBalance = 0;
  let moveNumber = 0;
  
  for (const move of history) {
    moveNumber++;
    
    // Apply move to get resulting position
    chess.move(move.san);
    const fen = chess.fen();
    const currentBalance = getMaterialBalance(fen);
    const materialDelta = Math.abs(currentBalance - previousBalance);
    const totalMaterial = getTotalMaterial(fen);
    const phase = getGamePhase(moveNumber, totalMaterial);
    const side = moveNumber % 2 === 1 ? 'white' : 'black';
    
    const reasons: string[] = [];
    let priority = 0;
    
    // Opening positions (first few moves)
    if (config.includeOpening && moveNumber <= 3) {
      reasons.push('opening');
      priority += 1;
    }
    
    // Tactical patterns
    if (config.includeTactical) {
      if (isCapture(move.san)) {
        reasons.push('capture');
        priority += 3;
      }
      
      if (isCheck(move.san)) {
        reasons.push('check');
        priority += 4;
      }
      
      if (isCheckmate(move.san)) {
        reasons.push('checkmate');
        priority += 10;
      }
      
      if (isPromotion(move.san)) {
        reasons.push('promotion');
        priority += 5;
      }
      
      if (isCastling(move.san)) {
        reasons.push('castling');
        priority += 2;
      }
    }
    
    // Material swings (potential mistakes)
    if (config.includeMaterialSwings && materialDelta >= 3) {
      reasons.push('material-swing');
      priority += materialDelta; // Bigger swings = higher priority
    }
    
    // King exposure
    if (isKingExposed(fen, side)) {
      reasons.push('king-exposed');
      priority += 3;
    }
    
    // Phase-specific priorities
    if (phase === 'endgame' && totalMaterial <= 15) {
      reasons.push('endgame-critical');
      priority += 2;
    }
    
    // If move has any interesting characteristics, add as candidate
    if (reasons.length > 0) {
      candidates.push({
        moveNumber,
        fen,
        moveSAN: move.san,
        moveUCI: move.from + move.to + (move.promotion || ''),
        reason: reasons,
        priority,
        phase
      });
    }
    
    previousBalance = currentBalance;
  }
  
  // Sort by priority (highest first) and take top N
  candidates.sort((a, b) => b.priority - a.priority);
  const selected = candidates.slice(0, config.maxPositions);
  
  return {
    candidates: selected,
    totalMoves,
    samplingReason: selected.length === 0 ? 'no-candidates' : 'smart-sampling'
  };
}

/**
 * Fallback: Select first N positions (legacy behavior)
 */
export function selectFirstNPositions(
  pgn: string,
  maxPositions: number
): SamplingResult {
  const chess = new Chess();
  const candidates: PositionCandidate[] = [];
  
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    return {
      candidates: [],
      totalMoves: 0,
      samplingReason: 'pgn-parse-error'
    };
  }
  
  const history = chess.history({ verbose: true });
  const totalMoves = history.length;
  
  chess.reset();
  
  for (let i = 0; i < Math.min(maxPositions, history.length); i++) {
    const move = history[i];
    chess.move(move.san);
    
    candidates.push({
      moveNumber: i + 1,
      fen: chess.fen(),
      moveSAN: move.san,
      moveUCI: move.from + move.to + (move.promotion || ''),
      reason: ['first-n-ply'],
      priority: maxPositions - i, // Earlier moves slightly higher priority
      phase: getGamePhase(i + 1, getTotalMaterial(chess.fen()))
    });
  }
  
  return {
    candidates,
    totalMoves,
    samplingReason: 'first-n-ply'
  };
}

/**
 * Main entry point: Select positions with smart sampling or fallback
 */
export function selectPositions(
  pgn: string,
  maxPositions: number,
  smartSamplingEnabled: boolean
): SamplingResult {
  if (!smartSamplingEnabled) {
    return selectFirstNPositions(pgn, maxPositions);
  }
  
  const config: SamplingConfig = {
    maxPositions,
    includeOpening: true,
    includeTactical: true,
    includeMaterialSwings: true,
    includeCheckMate: true
  };
  
  const result = selectPositionsForAnalysis(pgn, config);
  
  // Fallback if smart sampling found nothing
  if (result.candidates.length === 0) {
    return selectFirstNPositions(pgn, Math.min(2, maxPositions));
  }
  
  return result;
}
