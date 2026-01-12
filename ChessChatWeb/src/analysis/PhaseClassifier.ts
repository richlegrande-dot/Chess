/**
 * Phase Classifier - Determines game phase for contextual coaching
 * 
 * This module analyzes chess positions to determine the current game phase
 * (opening, middlegame, endgame) which affects coaching advice and theme
 * assignment. Different phases require different strategic considerations.
 */

import { Chess } from 'chess.js';
import { GamePhase, MaterialCount } from './types';

/**
 * Configuration for phase classification
 */
export interface PhaseClassifierConfig {
  // Material thresholds for phase transitions
  endgameThreshold: number;    // Total material below which = endgame
  openingMoveLimit: number;    // Move number below which could be opening
  
  // Development criteria for opening phase
  minDevelopedPieces: number;  // Pieces that should be developed
  castlingWeight: number;      // Importance of castling in opening
  centerControlWeight: number; // Importance of center control
}

export const DEFAULT_PHASE_CONFIG: PhaseClassifierConfig = {
  endgameThreshold: 16,  // 16 points of material or less
  openingMoveLimit: 15,  // First 15 moves could be opening
  minDevelopedPieces: 3, // At least 3 pieces should be developed
  castlingWeight: 2.0,   // Castling is important
  centerControlWeight: 1.5 // Center control matters
};

/**
 * Analyzes game positions to determine phase
 */
export class PhaseClassifier {
  private config: PhaseClassifierConfig;

  constructor(config: Partial<PhaseClassifierConfig> = {}) {
    this.config = { ...DEFAULT_PHASE_CONFIG, ...config };
  }

  /**
   * Classify current game phase from FEN position
   */
  classifyPhase(fen: string, moveNumber: number = 1): GamePhase {
    const chess = new Chess(fen);
    const materialCount = this.calculateMaterialCount(chess);
    const totalMaterial = materialCount.white + materialCount.black;
    
    // Clear endgame: low material
    if (totalMaterial <= this.config.endgameThreshold) {
      return 'endgame';
    }
    
    // Opening phase analysis
    if (moveNumber <= this.config.openingMoveLimit) {
      const openingScore = this.calculateOpeningScore(chess);
      
      // Still in opening if development is incomplete
      if (openingScore < 0.7) {
        return 'opening';
      }
    }
    
    // Default to middlegame
    return 'middlegame';
  }

  /**
   * Calculate detailed phase information with confidence scores
   */
  analyzePhaseDetails(fen: string, moveNumber: number = 1): {
    phase: GamePhase;
    confidence: number;
    factors: {
      materialScore: number;
      developmentScore: number;
      structureScore: number;
      mobilityScore: number;
    };
  } {
    const chess = new Chess(fen);
    const materialCount = this.calculateMaterialCount(chess);
    const totalMaterial = materialCount.white + materialCount.black;
    
    const factors = {
      materialScore: this.calculateMaterialScore(totalMaterial),
      developmentScore: this.calculateDevelopmentScore(chess),
      structureScore: this.calculateStructureScore(chess),
      mobilityScore: this.calculateMobilityScore(chess)
    };
    
    let phase: GamePhase;
    let confidence: number;
    
    // Endgame classification
    if (totalMaterial <= this.config.endgameThreshold) {
      phase = 'endgame';
      confidence = Math.min(0.9, 1 - (totalMaterial / this.config.endgameThreshold));
    }
    // Opening classification
    else if (moveNumber <= this.config.openingMoveLimit && factors.developmentScore < 0.7) {
      phase = 'opening';
      confidence = Math.max(0.6, 1 - factors.developmentScore);
    }
    // Middlegame default
    else {
      phase = 'middlegame';
      confidence = 0.8; // Default confidence for middlegame
    }
    
    return { phase, confidence, factors };
  }

  /**
   * Determine if position has specific phase characteristics
   */
  hasPhaseCharacteristics(fen: string, targetPhase: GamePhase): boolean {
    const analysis = this.analyzePhaseDetails(fen);
    return analysis.phase === targetPhase && analysis.confidence > 0.7;
  }

  /**
   * Calculate material count for both sides
   */
  private calculateMaterialCount(chess: Chess): MaterialCount {
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
   * Score based on total material remaining
   * 0.0 = clear endgame, 1.0 = full material
   */
  private calculateMaterialScore(totalMaterial: number): number {
    const maxMaterial = 78; // Starting material for both sides
    return Math.min(1.0, totalMaterial / maxMaterial);
  }

  /**
   * Score piece development (0.0 = undeveloped, 1.0 = fully developed)
   */
  private calculateDevelopmentScore(chess: Chess): number {
    let developmentScore = 0;
    const maxScore = 10; // Arbitrary max for normalization
    
    // Check piece development
    const whiteDeveloped = this.countDevelopedPieces(chess, 'w');
    const blackDeveloped = this.countDevelopedPieces(chess, 'b');
    developmentScore += (whiteDeveloped + blackDeveloped) * 0.5;
    
    // Check castling status
    const whiteCanCastle = this.canCastle(chess, 'w');
    const blackCanCastle = this.canCastle(chess, 'b');
    
    // Bonus for having castled (indicated by king not being on starting square)
    const whiteKingMoved = !this.isKingOnStartSquare(chess, 'w');
    const blackKingMoved = !this.isKingOnStartSquare(chess, 'b');
    
    if (whiteKingMoved || !whiteCanCastle) developmentScore += 1;
    if (blackKingMoved || !blackCanCastle) developmentScore += 1;
    
    // Check center control
    developmentScore += this.calculateCenterControl(chess) * 2;
    
    return Math.min(1.0, developmentScore / maxScore);
  }

  /**
   * Score pawn structure complexity
   */
  private calculateStructureScore(chess: Chess): number {
    const board = chess.board();
    let structureComplexity = 0;
    
    // Count pawn chains, isolated pawns, passed pawns
    for (let file = 0; file < 8; file++) {
      const whitePawns: number[] = [];
      const blackPawns: number[] = [];
      
      for (let rank = 0; rank < 8; rank++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'p') {
          if (piece.color === 'w') whitePawns.push(rank);
          else blackPawns.push(rank);
        }
      }
      
      // Doubled pawns increase complexity
      if (whitePawns.length > 1) structureComplexity += 0.5;
      if (blackPawns.length > 1) structureComplexity += 0.5;
    }
    
    return Math.min(1.0, structureComplexity / 5.0);
  }

  /**
   * Calculate piece mobility and activity
   */
  private calculateMobilityScore(chess: Chess): number {
    const whiteMoves = chess.moves({ color: 'w' }).length;
    const blackMoves = chess.moves({ color: 'b' }).length;
    const totalMoves = whiteMoves + blackMoves;
    
    // Normalize based on typical move counts
    // Early game: ~40-60 moves, Endgame: ~20-30 moves
    const normalizedScore = Math.min(1.0, totalMoves / 50.0);
    
    return normalizedScore;
  }

  /**
   * Count developed pieces (off back rank)
   */
  private countDevelopedPieces(chess: Chess, color: 'w' | 'b'): number {
    const board = chess.board();
    let developed = 0;
    const backRank = color === 'w' ? 7 : 0;
    
    board.forEach((row, rank) => {
      row.forEach(square => {
        if (square && 
            square.color === color && 
            ['n', 'b', 'q'].includes(square.type) && 
            rank !== backRank) {
          developed++;
        }
      });
    });
    
    return developed;
  }

  /**
   * Check if side can still castle
   */
  private canCastle(chess: Chess, color: 'w' | 'b'): boolean {
    const castlingRights = chess.getCastlingRights(color);
    return castlingRights.k || castlingRights.q;
  }

  /**
   * Check if king is still on starting square
   */
  private isKingOnStartSquare(chess: Chess, color: 'w' | 'b'): boolean {
    const startSquare = color === 'w' ? 'e1' : 'e8';
    const piece = chess.get(startSquare);
    return piece !== null && piece.type === 'k' && piece.color === color;
  }

  /**
   * Calculate center control (e4, e5, d4, d5 squares)
   */
  private calculateCenterControl(chess: Chess): number {
    const centerSquares = ['e4', 'e5', 'd4', 'd5'];
    let controlScore = 0;
    
    centerSquares.forEach(square => {
      const piece = chess.get(square);
      if (piece) {
        controlScore += piece.type === 'p' ? 0.5 : 0.3; // Pawns better for control
      }
    });
    
    return Math.min(1.0, controlScore / 2.0);
  }

  /**
   * Get configuration
   */
  getConfig(): PhaseClassifierConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PhaseClassifierConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}"