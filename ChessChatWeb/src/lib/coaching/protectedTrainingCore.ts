/**
 * Protected Training Core - Immutable 50-Game Learning System
 * 
 * This is Wall-E's permanent memory. It:
 * - Stores up to 50 games with rich learning artifacts
 * - Auto-rolls off oldest when capacity reached (FIFO)
 * - CANNOT be reset via UI
 * - Survives reloads, updates, and corruption attempts
 * - Only accessible through controlled append operations
 */

import { TrainingExample } from './trainingCollector';
import { MistakeSignature } from './signatureEngine';
import { PlayerTendency } from './playerTendencyTracker';
import { saveTrainingGameViaAPI } from '../api/walleApiSync';

// ============================================================================
// CONSTANTS - DO NOT MODIFY CASUALLY
// ============================================================================

const TRAINING_CORE_KEY = 'wall_e_training_core_v2';
const TRAINING_CORE_BACKUP_KEY = 'wall_e_training_core_v2_backup';
const MAX_TRAINING_GAMES = 50;
const SCHEMA_VERSION = 2;
const BACKUP_INTERVAL_MS = 60000; // Backup every minute

// ============================================================================
// TYPES
// ============================================================================

interface DecisionContext {
  positionType: 'open' | 'closed' | 'semi-open' | 'tactical';
  materialBalance: number;  // Centipawns
  kingSafety: 'safe' | 'exposed' | 'critical';
  timePressure: boolean;
  phaseOfGame: 'opening' | 'middlegame' | 'endgame';
}

interface EnhancedMistakeEvent {
  id: string;
  gameId: string;
  gameIndex: number;  // Which of the 50 games (0-49)
  moveNumber: number;
  fen: string;
  playedMoveSAN: string;
  bestMoveSAN?: string;
  evalDelta?: number;
  category: string;
  motif?: string;
  principle?: string;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  tags: string[];
  
  // NEW - Deep context
  decisionContext: DecisionContext;
  repetitionLikelihood: number;  // 0-1
  playerTendency?: string;
}

interface TrainingGame {
  id: string;
  index: number;  // 0-49, position in rolling window
  timestamp: number;
  playerLevel: number;
  playerColor: 'w' | 'b';
  totalMoves: number;
  result: 'win' | 'loss' | 'draw';
  
  // Rich artifacts
  mistakes: EnhancedMistakeEvent[];
  detectedTendencies: string[];  // IDs of tendencies observed
  significantPositions: string[];  // FENs of teaching moments
}

interface ProtectedTrainingCore {
  schemaVersion: number;
  createdAt: number;
  lastModified: number;
  lastBackup: number;
  
  // The sacred 50 games
  games: TrainingGame[];
  
  // Rolling window tracking
  oldestGameIndex: number;  // Next slot to overwrite
  totalGamesEverPlayed: number;
  
  // Immutability flag
  locked: true;  // Always true, for psychological effect
  
  // Derived learning data (updated with each game)
  signatures: MistakeSignature[];
  tendencies: PlayerTendency[];
  
  // Corruption detection
  checksum: string;
}

// ============================================================================
// CORRUPTION RECOVERY
// ============================================================================

function computeChecksum(core: Omit<ProtectedTrainingCore, 'checksum'>): string {
  // Simple checksum to detect corruption
  const data = JSON.stringify(core);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function validateCore(core: ProtectedTrainingCore): boolean {
  try {
    // Check schema
    if (core.schemaVersion !== SCHEMA_VERSION) return false;
    
    // Check structure
    if (!Array.isArray(core.games)) return false;
    if (!Array.isArray(core.signatures)) return false;
    if (!Array.isArray(core.tendencies)) return false;
    
    // Check checksum
    const { checksum, ...rest } = core;
    const expectedChecksum = computeChecksum(rest);
    
    return checksum === expectedChecksum;
  } catch (e) {
    return false;
  }
}

function attemptRecovery(): ProtectedTrainingCore | null {
  console.warn('[ProtectedCore] Attempting data recovery...');
  
  // Try backup first
  try {
    const backupData = localStorage.getItem(TRAINING_CORE_BACKUP_KEY);
    if (backupData) {
      const backup = JSON.parse(backupData) as ProtectedTrainingCore;
      if (validateCore(backup)) {
        console.log('[ProtectedCore] ✅ Recovered from backup');
        return backup;
      }
    }
  } catch (e) {
    console.error('[ProtectedCore] Backup recovery failed:', e);
  }
  
  // Try to salvage partial data
  try {
    const corruptData = localStorage.getItem(TRAINING_CORE_KEY);
    if (corruptData) {
      const partial = JSON.parse(corruptData);
      
      // Try to extract games array
      if (Array.isArray(partial.games) && partial.games.length > 0) {
        console.warn('[ProtectedCore] ⚠️ Partial recovery - keeping games only');
        return createEmptyCore(partial.games);
      }
    }
  } catch (e) {
    console.error('[ProtectedCore] Partial recovery failed:', e);
  }
  
  return null;
}

// ============================================================================
// CORE MANAGEMENT
// ============================================================================

function createEmptyCore(games: TrainingGame[] = []): ProtectedTrainingCore {
  const core: Omit<ProtectedTrainingCore, 'checksum'> = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastBackup: Date.now(),
    games: games,
    oldestGameIndex: 0,
    totalGamesEverPlayed: games.length,
    locked: true,
    signatures: [],
    tendencies: []
  };
  
  return {
    ...core,
    checksum: computeChecksum(core)
  };
}

function loadCore(): ProtectedTrainingCore {
  try {
    const stored = localStorage.getItem(TRAINING_CORE_KEY);
    
    if (stored) {
      const core = JSON.parse(stored) as ProtectedTrainingCore;
      
      if (validateCore(core)) {
        console.log(`[ProtectedCore] ✅ Loaded ${core.games.length} games (${core.totalGamesEverPlayed} total played)`);
        return core;
      } else {
        console.error('[ProtectedCore] ❌ Validation failed, attempting recovery...');
        const recovered = attemptRecovery();
        
        if (recovered) {
          saveCore(recovered);
          return recovered;
        }
        
        console.error('[ProtectedCore] ⚠️ Recovery failed, keeping partial data if available');
        // DON'T auto-wipe - keep whatever we can
        if (core.games && core.games.length > 0) {
          const partial = createEmptyCore(core.games);
          saveCore(partial);
          return partial;
        }
      }
    }
  } catch (error) {
    console.error('[ProtectedCore] Load error:', error);
    const recovered = attemptRecovery();
    if (recovered) return recovered;
  }
  
  console.log('[ProtectedCore] Initializing new core');
  const newCore = createEmptyCore();
  saveCore(newCore);
  return newCore;
}

function saveCore(core: ProtectedTrainingCore): void {
  try {
    // Update metadata
    core.lastModified = Date.now();
    
    // Recompute checksum
    const { checksum, ...rest } = core;
    core.checksum = computeChecksum(rest);
    
    // Save primary
    localStorage.setItem(TRAINING_CORE_KEY, JSON.stringify(core));
    
    // Periodic backup
    if (Date.now() - core.lastBackup > BACKUP_INTERVAL_MS) {
      localStorage.setItem(TRAINING_CORE_BACKUP_KEY, JSON.stringify(core));
      core.lastBackup = Date.now();
    }
    
    console.log(`[ProtectedCore] 💾 Saved ${core.games.length} games`);
  } catch (error) {
    console.error('[ProtectedCore] ❌ Save failed:', error);
  }
}

// ============================================================================
// PUBLIC API (CONTROLLED APPEND ONLY)
// ============================================================================

class ProtectedTrainingCoreManager {
  private core: ProtectedTrainingCore;
  
  constructor() {
    this.core = loadCore();
  }
  
  /**
   * Add a new game to the training core
   * If at capacity (50), removes oldest game (FIFO)
   */
  appendGame(example: TrainingExample, enhancedMistakes: EnhancedMistakeEvent[]): void {
    const gameIndex = this.core.totalGamesEverPlayed % MAX_TRAINING_GAMES;
    
    const trainingGame: TrainingGame = {
      id: example.id,
      index: gameIndex,
      timestamp: example.timestamp,
      playerLevel: example.playerLevel,
      playerColor: example.playerColor,
      totalMoves: example.totalMoves,
      result: example.result,
      mistakes: enhancedMistakes,
      detectedTendencies: [],  // Filled by tendency tracker
      significantPositions: []  // Filled by position analyzer
    };
    
    // FIFO: Overwrite oldest slot if at capacity
    if (this.core.games.length >= MAX_TRAINING_GAMES) {
      this.core.games[this.core.oldestGameIndex] = trainingGame;
      this.core.oldestGameIndex = (this.core.oldestGameIndex + 1) % MAX_TRAINING_GAMES;
      console.log(`[ProtectedCore] 🔄 Rolled off oldest game, slot ${gameIndex}`);
    } else {
      this.core.games.push(trainingGame);
    }
    
    this.core.totalGamesEverPlayed++;
    
    saveCore(this.core);
    
    // Sync to database via API (non-blocking)
    saveTrainingGameViaAPI({
      gameIndex,
      pgn: '',
      analysis: {
        playerLevel: example.playerLevel,
        playerColor: example.playerColor,
        result: example.result,
        totalMoves: example.totalMoves,
        mistakeCount: enhancedMistakes.length,
        blunderCount: enhancedMistakes.filter(m => m.severity === 'blunder').length,
        mistakes: enhancedMistakes
      },
      metrics: {
        avgEvalDelta: enhancedMistakes.reduce((sum, m) => sum + (m.evalDelta || 0), 0) / Math.max(1, enhancedMistakes.length),
        tacticalErrors: enhancedMistakes.filter(m => m.category === 'tactics').length,
        positionalErrors: enhancedMistakes.filter(m => m.category !== 'tactics').length
      },
      timestamp: example.timestamp
    }).catch(err => console.error('[ProtectedCore] DB write failed:', err));
    
    console.log(`[ProtectedCore] ✅ Appended game ${this.core.totalGamesEverPlayed} ` +
                `(${this.core.games.length}/${MAX_TRAINING_GAMES} stored)`);
  }
  
  /**
   * Update signatures (called after each game analysis)
   */
  updateSignatures(signatures: MistakeSignature[]): void {
    this.core.signatures = signatures;
    saveCore(this.core);
  }
  
  /**
   * Update player tendencies
   */
  updateTendencies(tendencies: PlayerTendency[]): void {
    this.core.tendencies = tendencies;
    saveCore(this.core);
  }
  
  /**
   * Read-only access to games
   */
  getGames(): readonly TrainingGame[] {
    return this.core.games;
  }
  
  /**
   * Get games sorted by recency
   */
  getRecentGames(count: number = 10): readonly TrainingGame[] {
    return [...this.core.games]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
  
  /**
   * Read-only access to signatures
   */
  getSignatures(): readonly MistakeSignature[] {
    return this.core.signatures;
  }
  
  /**
   * Get high-confidence signatures only
   */
  getHighConfidenceSignatures(threshold: number = 0.7): MistakeSignature[] {
    return this.core.signatures.filter(sig => sig.confidenceScore >= threshold);
  }
  
  /**
   * Read-only access to tendencies
   */
  getTendencies(): readonly PlayerTendency[] {
    return this.core.tendencies;
  }
  
  /**
   * Get total games ever played (even those rolled off)
   */
  getTotalGamesPlayed(): number {
    return this.core.totalGamesEverPlayed;
  }
  
  /**
   * Get current storage count
   */
  getCurrentGameCount(): number {
    return this.core.games.length;
  }
  
  /**
   * Get statistics
   */
  getStatistics() {
    const games = this.core.games;
    const totalMistakes = games.reduce((sum, g) => sum + g.mistakes.length, 0);
    
    return {
      gamesStored: games.length,
      totalGamesPlayed: this.core.totalGamesEverPlayed,
      totalMistakes,
      avgMistakesPerGame: games.length > 0 ? totalMistakes / games.length : 0,
      confirmedSignatures: this.core.signatures.filter(s => s.isConfirmed).length,
      highConfidenceSignatures: this.core.signatures.filter(s => s.confidenceScore >= 0.7).length,
      createdAt: new Date(this.core.createdAt).toLocaleDateString(),
      lastModified: new Date(this.core.lastModified).toLocaleDateString()
    };
  }
  
  /**
   * Force backup (for critical operations)
   */
  forceBackup(): void {
    this.core.lastBackup = 0;  // Force backup on next save
    saveCore(this.core);
  }
  
  /**
   * ⚠️ DEVELOPER ONLY - Not exposed to UI
   * Completely reset core (for development/testing)
   */
  _dangerouslyReset(): void {
    console.warn('[ProtectedCore] ⚠️⚠️⚠️ DANGEROUS RESET CALLED ⚠️⚠️⚠️');
    this.core = createEmptyCore();
    saveCore(this.core);
    localStorage.removeItem(TRAINING_CORE_BACKUP_KEY);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ProtectedTrainingCoreManager | null = null;

export function getProtectedTrainingCore(): ProtectedTrainingCoreManager {
  if (!instance) {
    instance = new ProtectedTrainingCoreManager();
  }
  return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  ProtectedTrainingCore,
  TrainingGame,
  EnhancedMistakeEvent,
  DecisionContext
};

export {
  MAX_TRAINING_GAMES,
  SCHEMA_VERSION
};
