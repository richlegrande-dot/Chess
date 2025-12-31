/**
 * Type definitions for the rule-based coaching system
 */

export interface GameplayMetrics {
  moveNumber: number;
  move: string;
  fen: string;
  evaluation: number; // Material evaluation in pawns
  thinkTime?: number; // Milliseconds
  isMissedTactic?: boolean;
  tacticalPattern?: TacticalPattern;
}

// ============================================================================
// 50-GAME LEARNING SYSTEM - ENHANCED TYPES
// ============================================================================

export interface DecisionContext {
  positionType: 'open' | 'closed' | 'semi-open' | 'tactical';
  materialBalance: number;  // Centipawns
  kingSafety: 'safe' | 'exposed' | 'critical';
  timePressure: boolean;
  phaseOfGame: 'opening' | 'middlegame' | 'endgame';
}

export interface PlayerTendency {
  id: string;
  description: string;
  category: 'tactical' | 'strategic' | 'psychological' | 'time';
  
  observations: {
    gameIndex: number;
    moveNumber: number;
    strength: number;  // How strongly exhibited (0-1)
  }[];
  
  confidenceScore: number;  // 0-1, grows with repetition
  trend: 'improving' | 'stable' | 'worsening';
  lastUpdated: number;
}

export type TacticalPattern = 
  | 'fork' 
  | 'pin' 
  | 'skewer' 
  | 'discovered_attack'
  | 'mate_in_2'
  | 'mate_in_3'
  | 'back_rank_mate'
  | 'smothered_mate'
  | 'hanging_piece';

export type MistakeType = 'blunder' | 'mistake' | 'inaccuracy' | 'missed_win';

export interface TacticalMistake {
  moveNumber: number;
  move: string;
  fen: string;
  type: MistakeType;
  evaluation: number; // Material lost in pawns
  explanation: string;
  suggestedMove?: string;
  pattern?: TacticalPattern;
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export type ChessPrinciple = 
  | 'center_control'
  | 'piece_development'
  | 'king_safety'
  | 'pawn_structure'
  | 'piece_activity'
  | 'king_activity'
  | 'passed_pawns'
  | 'castling'
  | 'piece_coordination';

export interface StrategicViolation {
  moveNumber: number;
  principle: ChessPrinciple;
  phase: GamePhase;
  severity: 'minor' | 'moderate' | 'major';
  explanation: string;
  advice: string;
}

export interface Improvement {
  title: string;
  description: string;
  moveNumber?: number;
  severity: number; // 0-10 scale
  category: 'tactical' | 'strategic' | 'time_management';
}

export interface CoachingReport {
  improvements: Improvement[];
  strategicFocus: string;
  tacticalFocus: string;
  encouragement: string;
  gamePhaseAnalysis: {
    opening: string;
    middlegame: string;
    endgame: string;
  };
  statistics: {
    totalMoves: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    missedWins: number;
    principleViolations: number;
    averageThinkTime?: number;
  };
  metadata?: {
    source: 'rule-based' | 'hybrid';
    analysisTime: number;
    [key: string]: any;
  };
}

export interface AnalysisContext {
  mistakes: TacticalMistake[];
  violations: StrategicViolation[];
  metrics: GameplayMetrics[];
}

// ============================================================
// PHASE 1: Enhanced Learning System Types (December 20, 2025)
// ============================================================

/**
 * Mistake categories for structured event tracking
 */
export type MistakeCategory =
  | 'opening'
  | 'tactics'
  | 'strategy'
  | 'endgame'
  | 'time'
  | 'psychology';

/**
 * Mistake severity levels
 */
export type MistakeSeverity = 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Structured mistake event with full context
 */
export interface MistakeEvent {
  id: string;
  gameId: string;
  timestamp: number;
  moveNumber: number;
  fen: string;
  playedMoveSAN: string;
  bestMoveSAN?: string;
  evalDelta?: number;          // Material/positional loss
  category: MistakeCategory;
  motif?: string;              // fork, pin, hung-piece, etc.
  principle?: string;          // "castle early", "activate king", etc.
  severity: MistakeSeverity;
  tags: string[];
  whyDetected?: string;        // Debug: explanation of detection
}

/**
 * Stable mistake signature for pattern recognition
 */
export interface MistakeSignature {
  signatureId: string;         // stable hash: "opening_delayed_castling"
  category: MistakeCategory;
  title: string;
  description: string;
  occurrences: number;
  lastSeenAt: number;
  firstSeenAt: number;
  masteryScore: number;        // 0-100, with decay
  successRate: number;         // 0-1, when avoided/handled
  decayRate: number;           // How fast mastery decays
  exampleRefs: Array<{
    gameId: string;
    moveNumber: number;
    fen: string;
    move: string;
  }>;
  relatedPrinciples: string[];
  recommendedDrills: string[];
  
  // NEW - 50-Game Learning System
  confidenceScore: number;           // 0-1, grows logarithmically, stabilizes ~15-20 games
  firstSeenGameIndex: number;        // Which game (0-49) first saw this
  lastSeenGameIndex: number;         // Which game (0-49) last saw this
  severityWeightedImpact: number;    // Avg severity * frequency
  improvementTrend: 'improving' | 'stable' | 'worsening';
  typicalContexts: DecisionContext[]; // Where this tends to happen
  predictionReliability: number;     // 0-1, how well we predict recurrence
  
  // Confidence thresholds (computed)
  isConfirmed: boolean;              // >= 3 occurrences
  isStable: boolean;                 // Confidence >= 0.7
  isHighConfidence: boolean;         // Confidence >= 0.85
}

/**
 * Training recommendation based on mistake patterns
 */
export interface TrainingRecommendation {
  type: 'drill' | 'concept' | 'practice' | 'review';
  title: string;
  description: string;
  relatedSignatures: string[];
  priority: number;            // 0-10
  estimatedTime: number;       // minutes
  category: MistakeCategory;
}

/**
 * Enhanced coaching plan with spaced repetition
 */
export interface EnhancedCoachingPlan {
  primaryFocus: {
    signature: MistakeSignature;
    goal: string;
    expectedGames: number;
  };
  secondaryFocuses: Array<{
    signature: MistakeSignature;
    goal: string;
  }>;
  recommendations: TrainingRecommendation[];
  nextGameObjective: string;
  rotationSchedule: Array<{
    gameNumber: number;
    focus: string;
  }>;
  streaks: Array<{
    type: string;
    count: number;
    lastBrokenAt?: number;
  }>;
}

/**
 * Mastery update record for tracking changes
 */
export interface MasteryUpdate {
  signatureId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  reason: string;
  timestamp: number;
}

/**
 * Learning analytics for debug view
 */
export interface LearningDebugInfo {
  detectedEvents: MistakeEvent[];
  signatureUpdates: Array<{
    signature: MistakeSignature;
    action: 'created' | 'updated' | 'decayed';
    masteryChange: number;
  }>;
  plannerRationale: {
    topCandidates: Array<{
      signatureId: string;
      score: number;
      factors: Record<string, number>;
    }>;
    selectedFocus: string;
    reasoning: string;
  };
  appliedHeuristics: string[];
  vaultRetrievals: Array<{
    query: string;
    results: number;
    tags: string[];
  }>;
}
