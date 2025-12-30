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

/** Total timeout including grace period */
export const CPU_TOTAL_TIMEOUT_MS = CPU_MOVE_TIME_MS + CPU_MOVE_GRACE_MS;

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
 * - Difficulty increases via:
 *   1. Deeper search targets
 *   2. Better move ordering (wider beam)
 *   3. Quiescence search
 *   4. Aspiration windows
 *   5. Tactical pre-scanning
 *   6. More sophisticated evaluation
 */
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    minDepth: 1,
    targetDepth: 2,
    hardCap: 3,
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
    targetDepth: 3,
    hardCap: 4,
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
    targetDepth: 4,
    hardCap: 5,
    beamWidth: 12,
    useQuiescence: true,
    quiescenceMaxDepth: 4,
    useAspiration: false,
    aspirationWindow: 0,
    evalComplexity: 'lite',
    tacticalScan: 'basic',
    openingBook: true,
    nullMoveReduction: 2,
    lmrThreshold: 5,
  },
  
  4: {
    minDepth: 2,
    targetDepth: 5,
    hardCap: 6,
    beamWidth: 14,
    useQuiescence: true,
    quiescenceMaxDepth: 5,
    useAspiration: true,
    aspirationWindow: 50,
    evalComplexity: 'full',
    tacticalScan: 'basic',
    openingBook: true,
    nullMoveReduction: 3,
    lmrThreshold: 5,
  },
  
  5: {
    minDepth: 2,
    targetDepth: 6,
    hardCap: 7,
    beamWidth: 16,
    useQuiescence: true,
    quiescenceMaxDepth: 6,
    useAspiration: true,
    aspirationWindow: 40,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 3,
    lmrThreshold: 6,
  },
  
  6: {
    minDepth: 3,
    targetDepth: 7,
    hardCap: 8,
    beamWidth: 18,
    useQuiescence: true,
    quiescenceMaxDepth: 6,
    useAspiration: true,
    aspirationWindow: 35,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 3,
    lmrThreshold: 6,
  },
  
  7: {
    minDepth: 3,
    targetDepth: 8,
    hardCap: 10,
    beamWidth: 12,
    useQuiescence: true,
    quiescenceMaxDepth: 6,
    useAspiration: true,
    aspirationWindow: 30,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 3,
    lmrThreshold: 7,
  },
  
  8: {
    minDepth: 4,
    targetDepth: 10,
    hardCap: 12,
    beamWidth: 15,
    useQuiescence: true,
    quiescenceMaxDepth: 8,
    useAspiration: true,
    aspirationWindow: 25,
    evalComplexity: 'full',
    tacticalScan: 'full',
    openingBook: true,
    nullMoveReduction: 3,
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
