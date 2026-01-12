/**
 * Engine Analyzer - Core engine evaluation and turning point detection
 * 
 * This module handles the heavy lifting of chess position evaluation,
 * identifying critical moments in games where significant evaluation
 * changes occur (turning points) that can be used for coaching.
 */

import { Chess } from 'chess.js';
import { TurnPoint, EvaluatedMove, MoveClassification, MaterialCount } from './types';

/**
 * Configuration for engine analysis
 */
export interface EngineAnalysisConfig {
  depthLimit: number;        // Engine search depth (higher = more accurate, slower)
  timePerMove: number;       // Time limit per position in milliseconds
  blunderThreshold: number;  // Eval delta for blunders (in centipawns)
  mistakeThreshold: number;  // Eval delta for mistakes (in centipawns)
  inaccuracyThreshold: number; // Eval delta for inaccuracies (in centipawns)
  maxTurnPoints: number;     // Maximum turning points to return
}

export const DEFAULT_ENGINE_CONFIG: EngineAnalysisConfig = {
  depthLimit: 12,
  timePerMove: 1000,
  blunderThreshold: 300,    // 3.0 pawns
  mistakeThreshold: 150,    // 1.5 pawns
  inaccuracyThreshold: 75,  // 0.75 pawns
  maxTurnPoints: 10
};

/**
 * Mock engine evaluation for development/testing
 * In production, this would interface with actual Stockfish engine
 */
export class MockEngine {
  private evaluationCache = new Map<string, number>();

  /**
   * Evaluate position from FEN string
   * Returns evaluation in centipawns from white's perspective
   */
  async evaluatePosition(fen: string): Promise<number> {
    // Check cache first
    if (this.evaluationCache.has(fen)) {
      return this.evaluationCache.get(fen)!;
    }

    // Mock evaluation based on material count and simple positional factors
    const chess = new Chess(fen);
    let evaluation = this.calculateMaterialBalance(chess);
    
    // Add positional adjustments
    evaluation += this.calculatePositionalFactors(chess);
    
    // Add some randomness to simulate engine uncertainty
    evaluation += (Math.random() - 0.5) * 50;
    
    // Cache result
    this.evaluationCache.set(fen, evaluation);
    return evaluation;
  }

  /**
   * Get best move from position
   * In production, this would query actual engine
   */
  async getBestMove(fen: string): Promise<string> {
    const chess = new Chess(fen);
    const moves = chess.moves();
    
    if (moves.length === 0) return '';
    
    // Simple heuristic: prefer captures, checks, then center moves
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    for (const move of moves) {
      let score = Math.random() * 100; // Base randomness
      
      // Prefer captures
      if (move.includes('x')) score += 50;
      
      // Prefer checks
      if (move.includes('+')) score += 30;
      
      // Prefer central squares
      if (['e4', 'e5', 'd4', 'd5'].some(sq => move.includes(sq))) {
        score += 20;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  private calculateMaterialBalance(chess: Chess): number {
    const board = chess.board();
    let whiteValue = 0;
    let blackValue = 0;
    
    const pieceValues = {
      'p': 100, 'n': 300, 'b': 300, 'r': 500, 'q': 900, 'k': 0
    };
    
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = pieceValues[square.type as keyof typeof pieceValues];
          if (square.color === 'w') {
            whiteValue += value;
          } else {
            blackValue += value;
          }
        }
      });
    });
    
    return whiteValue - blackValue;
  }

  private calculatePositionalFactors(chess: Chess): number {
    let score = 0;
    
    // King safety bonus/penalty
    const whiteKing = this.findKing(chess, 'w');
    const blackKing = this.findKing(chess, 'b');
    
    if (whiteKing && blackKing) {
      // Penalize kings in center during opening/middlegame
      if (chess.moveNumber() < 15) {
        if (['e1', 'e8'].includes(whiteKing)) score -= 20;
        if (['e1', 'e8'].includes(blackKing)) score += 20;
      }
    }
    
    // Development bonus (simplified)
    const whitePieces = this.countDevelopedPieces(chess, 'w');
    const blackPieces = this.countDevelopedPieces(chess, 'b');
    score += (whitePieces - blackPieces) * 10;
    
    return score;
  }

  private findKing(chess: Chess, color: 'w' | 'b'): string | null {
    const board = chess.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === color) {
          return String.fromCharCode(97 + j) + (8 - i);
        }
      }
    }
    return null;
  }

  private countDevelopedPieces(chess: Chess, color: 'w' | 'b'): number {
    const board = chess.board();
    let developed = 0;
    
    const startRank = color === 'w' ? 7 : 0;
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.color === color && 
            ['n', 'b', 'q'].includes(piece.type) && 
            i !== startRank) {
          developed++;
        }
      }
    }
    
    return developed;
  }
}

/**
 * Main engine analyzer class
 */
export class EngineAnalyzer {
  private engine: MockEngine;
  private config: EngineAnalysisConfig;

  constructor(config: Partial<EngineAnalysisConfig> = {}) {
    this.engine = new MockEngine();
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  /**
   * Analyze complete game from PGN and identify turning points
   */
  async analyzeGame(
    pgn: string, 
    playerColor: 'white' | 'black' = 'white'
  ): Promise<TurnPoint[]> {
    const chess = new Chess();
    
    try {
      chess.loadPgn(pgn);
    } catch (error) {
      throw new Error(`Invalid PGN: ${error}`);
    }

    const history = chess.history({ verbose: true });
    const turnPoints: TurnPoint[] = [];
    
    // Reset to start position for analysis
    chess.reset();
    
    let previousEval = await this.engine.evaluatePosition(chess.fen());
    
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fenBefore = chess.fen();
      
      // Get best move before playing the actual move
      const bestMove = await this.engine.getBestMove(fenBefore);
      
      // Play the actual move
      chess.move(move.san);
      const fenAfter = chess.fen();
      
      // Evaluate after the move
      const currentEval = await this.engine.evaluatePosition(fenAfter);
      
      // Adjust evaluation perspective for black moves
      const adjustedPrevEval = move.color === 'b' ? -previousEval : previousEval;
      const adjustedCurrentEval = move.color === 'b' ? -currentEval : currentEval;
      
      const evalDelta = adjustedPrevEval - adjustedCurrentEval;
      
      // Check if this is a significant turning point
      if (Math.abs(evalDelta) >= this.config.inaccuracyThreshold) {
        turnPoints.push({
          moveNumber: Math.ceil((i + 1) / 2),
          fenBefore,
          playedMoveSAN: move.san,
          bestMoveSAN: bestMove,
          evalBefore: adjustedPrevEval,
          evalAfter: adjustedCurrentEval,
          evalDelta,
          sideToMove: move.color === 'w' ? 'white' : 'black'
        });
      }
      
      previousEval = currentEval;
    }
    
    // Sort by evaluation delta magnitude and return top turning points
    return turnPoints
      .sort((a, b) => Math.abs(b.evalDelta) - Math.abs(a.evalDelta))
      .slice(0, this.config.maxTurnPoints);
  }

  /**
   * Classify move quality based on evaluation delta
   */
  classifyMove(evalDelta: number): MoveClassification {
    const absAlphabeta = Math.abs(evalDelta);
    
    if (absAlphabeta >= this.config.blunderThreshold) return 'blunder';
    if (absAlphabeta >= this.config.mistakeThreshold) return 'mistake';
    if (absAlphabeta >= this.config.inaccuracyThreshold) return 'inaccuracy';
    if (absAlphabeta <= 25) return 'excellent';
    return 'good';
  }

  /**
   * Calculate material count for both sides
   */
  calculateMaterialCount(fen: string): MaterialCount {
    const chess = new Chess(fen);
    const board = chess.board();
    
    const pieceValues = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    let white = 0, black = 0;
    
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = pieceValues[square.type as keyof typeof pieceValues];
          if (square.color === 'w') white += value;
          else black += value;
        }
      });
    });
    
    return { white, black };
  }

  /**
   * Get engine configuration
   */
  getConfig(): EngineAnalysisConfig {
    return { ...this.config };
  }

  /**
   * Update engine configuration
   */
  updateConfig(newConfig: Partial<EngineAnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}"