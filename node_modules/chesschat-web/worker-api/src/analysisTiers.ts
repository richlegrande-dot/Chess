/**
 * Adaptive Analysis Tiers
 * 
 * Dynamically selects analysis depth and position count based on:
 * - Available time budget
 * - Stockfish server health/latency
 * - Request priority
 * 
 * Prevents timeouts by gracefully degrading to faster analysis when needed.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisTier {
  name: 'A' | 'B' | 'C';
  maxPositions: number;
  depth: number;
  description: string;
  estimatedTimeMs: number;
}

export interface TierSelectionInput {
  totalMoves: number;
  stockfishLatencyMs?: number;
  remainingBudgetMs: number;
  userPriority?: 'high' | 'normal' | 'low';
  smartSamplingEnabled: boolean;
}

export interface TierSelectionResult {
  tier: AnalysisTier;
  reason: string;
  adjustedPositions: number;
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export const TIER_A: AnalysisTier = {
  name: 'A',
  maxPositions: 2,
  depth: 12,
  description: 'Fast tier - guaranteed quick analysis',
  estimatedTimeMs: 1000 // ~500ms per position at depth 12
};

export const TIER_B: AnalysisTier = {
  name: 'B',
  maxPositions: 4,
  depth: 14,
  description: 'Balanced tier - good depth with reasonable speed',
  estimatedTimeMs: 2500 // ~625ms per position at depth 14
};

export const TIER_C: AnalysisTier = {
  name: 'C',
  maxPositions: 6,
  depth: 16,
  description: 'Deep tier - maximum learning signal',
  estimatedTimeMs: 5000 // ~833ms per position at depth 16
};

export const ALL_TIERS = [TIER_A, TIER_B, TIER_C];

// ============================================================================
// TIER SELECTION LOGIC
// ============================================================================

/**
 * Select appropriate analysis tier based on context
 */
export function selectAnalysisTier(
  input: TierSelectionInput
): TierSelectionResult {
  const {
    totalMoves,
    stockfishLatencyMs,
    remainingBudgetMs,
    userPriority = 'normal',
    smartSamplingEnabled
  } = input;
  
  // Short games can use deeper analysis
  const isShortGame = totalMoves <= 20;
  
  // Check Stockfish health
  const stockfishHealthy = !stockfishLatencyMs || stockfishLatencyMs < 150;
  const stockfishSlow = stockfishLatencyMs && stockfishLatencyMs > 300;
  
  // Decision logic
  
  // Force Tier A if time budget is tight
  if (remainingBudgetMs < 2000) {
    return {
      tier: TIER_A,
      reason: 'low-time-budget',
      adjustedPositions: TIER_A.maxPositions
    };
  }
  
  // Force Tier A if Stockfish is slow
  if (stockfishSlow) {
    return {
      tier: TIER_A,
      reason: 'stockfish-latency-high',
      adjustedPositions: TIER_A.maxPositions
    };
  }
  
  // Use Tier C for high priority + good conditions
  if (
    userPriority === 'high' &&
    stockfishHealthy &&
    remainingBudgetMs >= TIER_C.estimatedTimeMs &&
    smartSamplingEnabled
  ) {
    return {
      tier: TIER_C,
      reason: 'high-priority-optimal-conditions',
      adjustedPositions: TIER_C.maxPositions
    };
  }
  
  // Use Tier C for short games with good conditions
  if (
    isShortGame &&
    stockfishHealthy &&
    remainingBudgetMs >= TIER_C.estimatedTimeMs
  ) {
    return {
      tier: TIER_C,
      reason: 'short-game-deep-analysis',
      adjustedPositions: TIER_C.maxPositions
    };
  }
  
  // Use Tier B if we have good conditions and smart sampling
  if (
    stockfishHealthy &&
    remainingBudgetMs >= TIER_B.estimatedTimeMs &&
    smartSamplingEnabled
  ) {
    return {
      tier: TIER_B,
      reason: 'balanced-smart-sampling',
      adjustedPositions: TIER_B.maxPositions
    };
  }
  
  // Use Tier B as reasonable default
  if (remainingBudgetMs >= TIER_B.estimatedTimeMs) {
    return {
      tier: TIER_B,
      reason: 'default-balanced',
      adjustedPositions: TIER_B.maxPositions
    };
  }
  
  // Fallback to Tier A
  return {
    tier: TIER_A,
    reason: 'conservative-fallback',
    adjustedPositions: TIER_A.maxPositions
  };
}

/**
 * Calculate dynamic position limit based on remaining time
 * 
 * Allows adaptive scaling within a tier if we have extra time
 */
export function calculateDynamicPositionLimit(
  baseTier: AnalysisTier,
  remainingBudgetMs: number,
  avgPositionTimeMs: number = 600
): number {
  // Conservative: leave 20% buffer
  const usableBudget = remainingBudgetMs * 0.8;
  
  // How many positions can we analyze?
  const affordablePositions = Math.floor(usableBudget / avgPositionTimeMs);
  
  // Never exceed tier's max
  const limit = Math.min(affordablePositions, baseTier.maxPositions);
  
  // Minimum of 1 position
  return Math.max(1, limit);
}

/**
 * Estimate Stockfish response time based on recent measurements
 */
export function estimateStockfishLatency(
  recentLatencies: number[]
): number {
  if (recentLatencies.length === 0) {
    return 200; // Default estimate
  }
  
  // Use P90 (90th percentile) for conservative estimate
  const sorted = [...recentLatencies].sort((a, b) => a - b);
  const p90Index = Math.floor(sorted.length * 0.9);
  
  return sorted[p90Index] || sorted[sorted.length - 1];
}

/**
 * Adjust tier for cold start scenarios
 * 
 * First request after Worker wake-up may be slower
 */
export function adjustForColdStart(
  tier: AnalysisTier,
  isColdStart: boolean
): AnalysisTier {
  if (!isColdStart) {
    return tier;
  }
  
  // Downgrade one tier for cold starts
  if (tier.name === 'C') return TIER_B;
  if (tier.name === 'B') return TIER_A;
  return TIER_A;
}

/**
 * Get tier by name (type-safe)
 */
export function getTierByName(name: 'A' | 'B' | 'C'): AnalysisTier {
  switch (name) {
    case 'A': return TIER_A;
    case 'B': return TIER_B;
    case 'C': return TIER_C;
  }
}

/**
 * Validate that tier configuration is sane
 */
export function validateTierConfig(): boolean {
  // Tiers should be ordered by depth
  if (TIER_A.depth >= TIER_B.depth) return false;
  if (TIER_B.depth >= TIER_C.depth) return false;
  
  // Tiers should be ordered by max positions
  if (TIER_A.maxPositions >= TIER_B.maxPositions) return false;
  if (TIER_B.maxPositions >= TIER_C.maxPositions) return false;
  
  // Estimated times should be ordered
  if (TIER_A.estimatedTimeMs >= TIER_B.estimatedTimeMs) return false;
  if (TIER_B.estimatedTimeMs >= TIER_C.estimatedTimeMs) return false;
  
  return true;
}
