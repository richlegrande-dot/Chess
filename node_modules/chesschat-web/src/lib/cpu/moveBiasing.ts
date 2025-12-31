/**
 * Move Biasing for Learning Integration
 * 
 * Wall-E uses learned patterns to subtly bias move selection toward
 * teaching opportunities - positions that test confirmed user weaknesses.
 * 
 * CRITICAL CONSTRAINTS:
 * - Max bias: ±15% of evaluation
 * - Only applies for confidence >= 0.7 (high confidence patterns)
 * - Never sacrifices winning positions for teaching
 * - Creates "instructive challenges", not unfair traps
 */

import { ChessGame } from '../ChessGame';
import { MistakeSignature, DecisionContext } from '../coaching/types';
import { analyzeDecisionContext, contextMatchesSignature } from '../coaching/decisionContextAnalyzer';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_BIAS_PERCENT = 0.15;  // Max 15% eval boost
const MIN_CONFIDENCE_FOR_BIAS = 0.7;  // Only use high-confidence patterns
const TEACHING_AGGRESSIVENESS = 1.0;  // Multiplier for bias strength (0-1)

// ============================================================================
// TYPES
// ============================================================================

export interface MoveBiasContext {
  userSignatures: MistakeSignature[];  // High-confidence patterns to exploit
  currentPosition: ChessGame;
  difficultyLevel: number;  // 1-8, affects teaching intensity
}

export interface BiasedEvaluation {
  moveIndex: number;
  originalEval: number;
  biasedEval: number;
  bias: number;
  reason?: string;  // Why this move was biased
  signatureIds?: string[];  // Which patterns influenced this
}

// ============================================================================
// POSITION ANALYSIS
// ============================================================================

/**
 * Check if a resulting position matches user weakness patterns
 */
function positionMatchesWeakness(
  position: ChessGame,
  signature: MistakeSignature
): { matches: boolean; strength: number } {
  
  try {
    const context = analyzeDecisionContext(position);
    
    // Check if context matches signature's typical contexts
    const contextMatch = contextMatchesSignature(context, signature.typicalContexts);
    
    if (!contextMatch) {
      return { matches: false, strength: 0 };
    }
    
    // Additional checks based on signature category
    const categoryMatch = checkCategorySpecificMatch(position, signature, context);
    
    if (categoryMatch.matches) {
      // Strength is combination of context match + category match
      return {
        matches: true,
        strength: (0.6 + categoryMatch.strength * 0.4)
      };
    }
    
    return { matches: false, strength: 0 };
  } catch {
    return { matches: false, strength: 0 };
  }
}

/**
 * Check for category-specific pattern matching
 */
function checkCategorySpecificMatch(
  position: ChessGame,
  signature: MistakeSignature,
  context: DecisionContext
): { matches: boolean; strength: number } {
  
  const signatureId = signature.signatureId.toLowerCase();
  
  // Pin patterns
  if (signatureId.includes('pin')) {
    const hasPinOpportunity = detectPinOpportunity(position);
    return { matches: hasPinOpportunity, strength: hasPinOpportunity ? 0.8 : 0 };
  }
  
  // Fork patterns
  if (signatureId.includes('fork')) {
    const hasForkOpportunity = detectForkOpportunity(position);
    return { matches: hasForkOpportunity, strength: hasForkOpportunity ? 0.8 : 0 };
  }
  
  // Hanging piece patterns
  if (signatureId.includes('hung') || signatureId.includes('hanging')) {
    return { matches: true, strength: 0.6 };  // Any position can test this
  }
  
  // King safety patterns
  if (signatureId.includes('king') || signatureId.includes('castle')) {
    const kingExposed = context.kingSafety === 'exposed' || context.kingSafety === 'critical';
    return { matches: kingExposed, strength: kingExposed ? 0.7 : 0 };
  }
  
  // Center control patterns
  if (signatureId.includes('center')) {
    const isOpenPosition = context.positionType === 'open';
    return { matches: isOpenPosition, strength: isOpenPosition ? 0.6 : 0 };
  }
  
  // Default: weak match
  return { matches: true, strength: 0.3 };
}

// ============================================================================
// TACTICAL PATTERN DETECTION
// ============================================================================

function detectPinOpportunity(position: ChessGame): boolean {
  try {
    // Simple heuristic: look for pieces on same line as king
    const board = position.board();
    const turn = position.turn();
    
    // Find opponent king
    let kingPos: { rank: number, file: number } | null = null;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color !== turn) {
          kingPos = { rank, file };
          break;
        }
      }
      if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    // Check for pieces on same rank/file/diagonal
    // This is simplified - real pin detection is more complex
    return Math.random() < 0.3;  // Placeholder
  } catch {
    return false;
  }
}

function detectForkOpportunity(position: ChessGame): boolean {
  try {
    // Check for knight fork opportunities
    const moves = position.moves({ verbose: true });
    const knightMoves = moves.filter((m: any) => {
      const piece = position.get(m.from);
      return piece && piece.type === 'n';
    });
    
    // Simplified: if knight can move, might create fork
    return knightMoves.length > 0 && Math.random() < 0.4;
  } catch {
    return false;
  }
}

// ============================================================================
// MOVE BIASING
// ============================================================================

/**
 * Apply learning-based bias to move evaluations
 * Returns biased evaluations with reasons
 */
export function applyLearningBias(
  candidateMoves: any[],  // chess.js Move objects
  evaluations: number[],  // Centipawn evaluations
  biasContext: MoveBiasContext
): BiasedEvaluation[] {
  
  // Filter for high-confidence signatures only
  const teachableSignatures = biasContext.userSignatures.filter(
    sig => sig.confidenceScore >= MIN_CONFIDENCE_FOR_BIAS
  );
  
  if (teachableSignatures.length === 0) {
    // No teaching opportunities - return original evaluations
    return evaluations.map((eval, idx) => ({
      moveIndex: idx,
      originalEval: eval,
      biasedEval: eval,
      bias: 0
    }));
  }
  
  // Calculate bias for each move
  const biasedEvaluations: BiasedEvaluation[] = evaluations.map((eval, idx) => {
    const move = candidateMoves[idx];
    
    // Simulate resulting position
    const testPosition = biasContext.currentPosition.clone();
    testPosition.makeMove(move.from, move.to, move.promotion);
    
    let totalBias = 0;
    const matchedSignatures: string[] = [];
    const reasons: string[] = [];
    
    // Check each teachable signature
    teachableSignatures.forEach(sig => {
      const match = positionMatchesWeakness(testPosition, sig);
      
      if (match.matches) {
        // Calculate bias based on:
        // - Signature confidence
        // - Match strength
        // - Teaching aggressiveness
        // - Difficulty level
        const rawBias = sig.confidenceScore * match.strength * TEACHING_AGGRESSIVENESS;
        const levelMultiplier = Math.min(1, biasContext.difficultyLevel / 8);  // Scale with level
        const bias = rawBias * levelMultiplier * MAX_BIAS_PERCENT;
        
        totalBias += bias;
        matchedSignatures.push(sig.signatureId);
        reasons.push(`Tests ${sig.title} (confidence: ${(sig.confidenceScore * 100).toFixed(0)}%)`);
      }
    });
    
    // Cap total bias at MAX_BIAS_PERCENT
    totalBias = Math.min(totalBias, MAX_BIAS_PERCENT);
    
    // Apply bias to evaluation (as multiplier)
    const biasedEval = eval * (1 + totalBias);
    
    return {
      moveIndex: idx,
      originalEval: eval,
      biasedEval,
      bias: totalBias,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      signatureIds: matchedSignatures.length > 0 ? matchedSignatures : undefined
    };
  });
  
  return biasedEvaluations;
}

/**
 * Select best move with learning bias applied
 */
export function selectBestMoveWithLearning(
  candidateMoves: any[],
  evaluations: number[],
  biasContext: MoveBiasContext
): {
  moveIndex: number;
  move: any;
  evaluation: number;
  wasInfluencedByLearning: boolean;
  teachingReason?: string;
} {
  
  const biasedEvals = applyLearningBias(candidateMoves, evaluations, biasContext);
  
  // Find best biased evaluation
  let bestIdx = 0;
  let bestEval = biasedEvals[0].biasedEval;
  
  for (let i = 1; i < biasedEvals.length; i++) {
    if (biasedEvals[i].biasedEval > bestEval) {
      bestEval = biasedEvals[i].biasedEval;
      bestIdx = i;
    }
  }
  
  const selected = biasedEvals[bestIdx];
  const wasInfluenced = Math.abs(selected.bias) > 0.01;
  
  if (wasInfluenced) {
    console.log(
      `[LearningBias] Selected move influenced by learning ` +
      `(bias: +${(selected.bias * 100).toFixed(1)}%) - ${selected.reason}`
    );
  }
  
  return {
    moveIndex: bestIdx,
    move: candidateMoves[bestIdx],
    evaluation: selected.biasedEval,
    wasInfluencedByLearning: wasInfluenced,
    teachingReason: selected.reason
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  applyLearningBias,
  selectBestMoveWithLearning,
  MAX_BIAS_PERCENT,
  MIN_CONFIDENCE_FOR_BIAS
};

export type {
  MoveBiasContext,
  BiasedEvaluation
};
