/**
 * CPU Chess Engine Configuration
 * 
 * Single global timeout for all difficulty levels.
 * Difficulty scales via depth, evaluation complexity, tactical scanning, and search sophistication.
 */

// ============================================================================
// GLOBAL TIME BUDGET (Same for ALL levels)
// ============================================================================

/** Maximum time allowed for CPU move computation (milliseconds) */
export const CPU_MOVE_TIME_MS = 2500;

/** Grace period for worker messaging overhead (milliseconds) */
export const CPU_MOVE_GRACE_MS = 250;

/** 
 * Total timeout including grace period and cold start buffer
 * Increased to 120s to handle Render.com free tier cold starts (30-60s)
 * Cold start only affects first move after idle, subsequent moves use normal timeout
 */
export const CPU_TOTAL_TIMEOUT_MS = 120000; // 120 seconds for cold start tolerance

// ============================================================================
// DIFFICULTY CONFIGURATION (How levels differ)
// ============================================================================

export type EvalComplexity = 'lite' | 'full';
export type TacticalScan = 'off' | 'basic' | 'full';

export interface LevelConfig {
  /** Minimum depth to search (always complete this) */
  minDepth: number;
  
  /** Target depth to reach if time permits */
  targetDepth: number;
  
  /** Hard cap on depth (never exceed this) */
  hardCap: number;
  
  /** Number of top moves to explore at root (beam search) */
  beamWidth: number;
  
  /** Enable quiescence search for tactical accuracy */
  useQuiescence: boolean;
  
  /** Maximum quiescence depth */
  quiescenceMaxDepth: number;
  
  /** Use aspiration windows for faster deep search */
  useAspiration: boolean;
  
  /** Aspiration window initial size (centipawns) */
  aspirationWindow: number;
  
  /** Evaluation function complexity */
  evalComplexity: EvalComplexity;
  
  /** Tactical pattern detection level */
  tacticalScan: TacticalScan;
  
  /** Use opening book moves */
  openingBook: boolean;
  
  /** Null move pruning reduction factor */
  nullMoveReduction: number;
  
  /** Late move reduction threshold */
  lmrThreshold: number;
}

/**
 * Configuration for each difficulty level (1-8)
 * 
 * Key principles:
 * - All levels use the SAME time budget (CPU_MOVE_TIME_MS)
 * - Depth LIMITED to 1-2 to match Cloudflare Worker constraints (10ms CPU limit)
 * - Difficulty increases via:
 *   1. Move ordering (wider beam)
 *   2. Evaluation complexity
 *   3. Tactical scanning depth
 * 
 * CRITICAL: Worker API enforces max depth 2 to prevent timeouts
 */
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    minDepth: 1,
    targetDepth: 1,
    hardCap: 1,
    beamWidth: 8,
    useQuiescence: false,
    quiescenceMaxDepth: 0,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'lite',
    tacticalScan: 'off',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 4,
  },
  
  2: {
    minDepth: 1,
    targetDepth: 1,
    hardCap: 1,
    beamWidth: 10,
    useQuiescence: false,
    quiescenceMaxDepth: 0,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'lite',
    tacticalScan: 'basic',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 4,
  },
  
  3: {
    minDepth: 1,
    targetDepth: 1,
    hardCap: 1,
    beamWidth: 12,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'lite',
    tacticalScan: 'basic',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 5,
  },
  
  4: {
    minDepth: 1,
    targetDepth: 2,
    hardCap: 2,
    beamWidth: 14,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'full',
    tacticalScan: 'basic',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 5,
  },
  
  5: {
    minDepth: 1,
    targetDepth: 2,
    hardCap: 2,
    beamWidth: 16,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 6,
  },
  
  6: {
    minDepth: 1,
    targetDepth: 2,
    hardCap: 2,
    beamWidth: 18,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 6,
  },
  
  7: {
    minDepth: 2,
    targetDepth: 2,
    hardCap: 2,
    beamWidth: 20,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 7,
  },
  
  8: {
    minDepth: 2,
    targetDepth: 2,
    hardCap: 2,
    beamWidth: 22,
    useQuiescence: true,
    quiescenceMaxDepth: 2,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 8,
  },
};

/**
 * Get configuration for a specific difficulty level
 */
export function getLevelConfig(level: number): LevelConfig {
  if (level < 1 || level > 8) {
    console.warn(`Invalid CPU level ${level}, defaulting to level 4`);
    return LEVEL_CONFIGS[4];
  }
  return LEVEL_CONFIGS[level];
}

/**
 * Get time budget for move computation (same for all levels)
 */
export function getTimeBudget(): number {
  return CPU_MOVE_TIME_MS;
}

/**
 * Get total timeout including grace period
 */
export function getTotalTimeout(): number {
  return CPU_TOTAL_TIMEOUT_MS;
}
