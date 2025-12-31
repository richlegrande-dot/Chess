/**
 * Confidence Scorer - Advanced Learning Metrics
 * 
 * Implements logarithmic confidence growth that stabilizes around 15-20 observations.
 * This is the core of the 50-game learning system.
 */

import { MistakeSignature, DecisionContext } from './types';

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence score using logarithmic growth
 * Stabilizes around 15-20 observations
 * 
 * Formula: log10(n + 1) / log10(21)
 * - At n=3:  confidence ≈ 0.45 (pattern detected)
 * - At n=10: confidence ≈ 0.76 (pattern confirmed)
 * - At n=20: confidence ≈ 0.95 (pattern stable)
 */
export function calculateBaseConfidence(occurrences: number): number {
  if (occurrences === 0) return 0;
  return Math.log10(occurrences + 1) / Math.log10(21);
}

/**
 * Update confidence with exponential moving average
 * Combines base confidence (from count) with recent trend
 */
export function updateConfidenceScore(
  signature: MistakeSignature,
  newObservation: boolean  // true = mistake occurred, false = avoided
): number {
  const n = signature.occurrences;
  
  // Base confidence from logarithmic growth
  const baseConfidence = calculateBaseConfidence(n);
  
  // Exponential Moving Average for recent trend
  const alpha = 0.2;
  const recentWeight = newObservation ? 1 : 0;
  const emaScore = signature.confidenceScore * (1 - alpha) + recentWeight * alpha;
  
  // Combine base (70%) + recency (30%)
  const combined = baseConfidence * 0.7 + emaScore * 0.3;
  
  return Math.min(1, Math.max(0, combined));
}

// ============================================================================
// PREDICTION RELIABILITY
// ============================================================================

/**
 * Calculate how reliably we can predict this mistake will recur
 * Based on:
 * - Consistency of occurrence
 * - Context similarity
 * - Time between occurrences
 */
export function calculatePredictionReliability(
  signature: MistakeSignature
): number {
  if (signature.occurrences < 3) return 0;
  
  // Factor 1: Occurrence consistency (0-1)
  // If it happens every N games consistently, reliability is high
  const gamesSpan = signature.lastSeenGameIndex - signature.firstSeenGameIndex;
  const expectedOccurrences = gamesSpan / 3;  // Expect every 3 games for high-reliability pattern
  const consistencyScore = Math.min(1, signature.occurrences / Math.max(1, expectedOccurrences));
  
  // Factor 2: Context clustering (0-1)
  // If contexts are similar, we can predict better
  const contextScore = signature.typicalContexts.length > 0 ? 
    Math.min(1, signature.typicalContexts.length / 5) : 0;
  
  // Factor 3: Confidence threshold
  const confidenceGate = signature.confidenceScore >= 0.6 ? 1 : signature.confidenceScore / 0.6;
  
  // Combine factors
  return (consistencyScore * 0.5 + contextScore * 0.3 + confidenceGate * 0.2);
}

// ============================================================================
// SEVERITY WEIGHTED IMPACT
// ============================================================================

/**
 * Calculate the weighted impact of this signature
 * Combines frequency with severity
 */
export function calculateSeverityWeightedImpact(
  occurrences: number,
  avgSeverity: number  // 0-3 scale (inaccuracy=1, mistake=2, blunder=3)
): number {
  // Normalize severity to 0-1
  const normalizedSeverity = avgSeverity / 3;
  
  // Weight by frequency (log scale to prevent domination)
  const frequencyWeight = Math.log10(occurrences + 1);
  
  // Combine (max at occurrences=20, severity=3 → impact=10)
  return normalizedSeverity * frequencyWeight * 10;
}

// ============================================================================
// TREND DETECTION
// ============================================================================

interface TrendAnalysis {
  trend: 'improving' | 'stable' | 'worsening';
  confidence: number;  // How confident are we in this trend?
  rate: number;        // Rate of change
}

/**
 * Detect improvement trend from game indices
 */
export function detectImprovementTrend(
  signature: MistakeSignature,
  recentGames: number[]  // Game indices where this occurred
): TrendAnalysis {
  if (recentGames.length < 6) {
    return { trend: 'stable', confidence: 0, rate: 0 };
  }
  
  // Split into recent vs older observations
  const midpoint = Math.floor(recentGames.length / 2);
  const older = recentGames.slice(0, midpoint);
  const recent = recentGames.slice(midpoint);
  
  // Calculate occurrence rate in each period
  const olderSpan = older[older.length - 1] - older[0] + 1;
  const recentSpan = recent[recent.length - 1] - recent[0] + 1;
  
  const olderRate = older.length / olderSpan;
  const recentRate = recent.length / recentSpan;
  
  // Calculate change
  const delta = recentRate - olderRate;
  const percentChange = olderRate > 0 ? (delta / olderRate) * 100 : 0;
  
  // Determine trend
  let trend: 'improving' | 'stable' | 'worsening';
  if (percentChange < -20) {
    trend = 'improving';  // Fewer occurrences = improving
  } else if (percentChange > 20) {
    trend = 'worsening';  // More occurrences = worsening
  } else {
    trend = 'stable';
  }
  
  // Confidence in trend (based on data quantity)
  const confidence = Math.min(1, recentGames.length / 15);
  
  return { trend, confidence, rate: percentChange };
}

// ============================================================================
// CONTEXT CLUSTERING
// ============================================================================

/**
 * Add a context to the typical contexts, maintaining diversity
 */
export function updateTypicalContexts(
  existingContexts: DecisionContext[],
  newContext: DecisionContext,
  maxContexts: number = 5
): DecisionContext[] {
  // Check if this context is already represented
  const isDuplicate = existingContexts.some(ctx => 
    contextsAreSimilar(ctx, newContext)
  );
  
  if (isDuplicate) {
    return existingContexts;
  }
  
  // Add new context
  const updated = [...existingContexts, newContext];
  
  // Keep most recent maxContexts
  if (updated.length > maxContexts) {
    return updated.slice(-maxContexts);
  }
  
  return updated;
}

function contextsAreSimilar(ctx1: DecisionContext, ctx2: DecisionContext): boolean {
  let matches = 0;
  let total = 0;
  
  if (ctx1.positionType === ctx2.positionType) matches++;
  total++;
  
  if (Math.abs(ctx1.materialBalance - ctx2.materialBalance) < 150) matches++;
  total++;
  
  if (ctx1.kingSafety === ctx2.kingSafety) matches++;
  total++;
  
  if (ctx1.phaseOfGame === ctx2.phaseOfGame) matches++;
  total++;
  
  // Similar if >= 75% features match
  return (matches / total) >= 0.75;
}

// ============================================================================
// CONFIDENCE FLAGS
// ============================================================================

/**
 * Calculate confidence-based flags
 */
export function calculateConfidenceFlags(signature: MistakeSignature): {
  isConfirmed: boolean;
  isStable: boolean;
  isHighConfidence: boolean;
} {
  return {
    isConfirmed: signature.occurrences >= 3 && signature.confidenceScore >= 0.4,
    isStable: signature.confidenceScore >= 0.7,
    isHighConfidence: signature.confidenceScore >= 0.85
  };
}

// ============================================================================
// TEACHING OPPORTUNITY SCORING
// ============================================================================

/**
 * Score how good a teaching opportunity this signature represents
 * Higher score = better to test/pressure in gameplay
 */
export function calculateTeachingOpportunityScore(signature: MistakeSignature): number {
  // Only teach high-confidence patterns
  if (signature.confidenceScore < 0.7) return 0;
  
  // Factor 1: Not too mastered yet (room for improvement)
  const masteryGap = Math.max(0, 85 - signature.masteryScore) / 85;
  
  // Factor 2: Recent (don't teach forgotten patterns)
  const recencyDays = (Date.now() - signature.lastSeenAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - recencyDays / 30);  // Decay over 30 days
  
  // Factor 3: High confidence (we know this is real)
  const confidenceBonus = signature.confidenceScore;
  
  // Factor 4: High impact (important patterns deserve focus)
  const impactScore = Math.min(1, signature.severityWeightedImpact / 10);
  
  // Combine (max score = 10)
  return (masteryGap * 3 + recencyScore * 2 + confidenceBonus * 3 + impactScore * 2);
}

// ============================================================================
// MILESTONE DETECTION
// ============================================================================

export interface LearningMilestone {
  type: 'pattern_detected' | 'pattern_confirmed' | 'pattern_stable' | 'pattern_mastered';
  signatureId: string;
  title: string;
  description: string;
  confidenceScore: number;
  gameIndex: number;
}

/**
 * Check if a signature crossed a milestone threshold
 */
export function detectMilestone(
  signature: MistakeSignature,
  previousConfidence: number,
  currentGameIndex: number
): LearningMilestone | null {
  const conf = signature.confidenceScore;
  const prev = previousConfidence;
  
  // Pattern detected (crossed 0.4)
  if (prev < 0.4 && conf >= 0.4) {
    return {
      type: 'pattern_detected',
      signatureId: signature.signatureId,
      title: 'New Pattern Detected',
      description: `Wall-E has started noticing: ${signature.title}`,
      confidenceScore: conf,
      gameIndex: currentGameIndex
    };
  }
  
  // Pattern confirmed (crossed 0.6)
  if (prev < 0.6 && conf >= 0.6) {
    return {
      type: 'pattern_confirmed',
      signatureId: signature.signatureId,
      title: 'Pattern Confirmed',
      description: `Wall-E is confident about: ${signature.title}`,
      confidenceScore: conf,
      gameIndex: currentGameIndex
    };
  }
  
  // Pattern stable (crossed 0.8)
  if (prev < 0.8 && conf >= 0.8) {
    return {
      type: 'pattern_stable',
      signatureId: signature.signatureId,
      title: 'Pattern Highly Reliable',
      description: `Wall-E deeply understands: ${signature.title}`,
      confidenceScore: conf,
      gameIndex: currentGameIndex
    };
  }
  
  // Pattern mastered (crossed 0.9)
  if (prev < 0.9 && conf >= 0.9) {
    return {
      type: 'pattern_mastered',
      signatureId: signature.signatureId,
      title: 'Pattern Mastered',
      description: `You've mastered: ${signature.title}`,
      confidenceScore: conf,
      gameIndex: currentGameIndex
    };
  }
  
  return null;
}

export type { TrendAnalysis, LearningMilestone };
