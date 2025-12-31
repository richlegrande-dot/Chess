/**
 * Learning Engine for Chess AI - Levels 7-8
 * Stores game outcomes, position evaluations, and opening book expansions
 * Learns from wins/losses to improve play over time
 */

import type { Chess, Move } from 'chess.js';

// ===========================
// TYPE DEFINITIONS
// ===========================

export interface GameOutcome {
  id: string;
  date: number;
  cpuLevel: number;
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  openingMoves: string[]; // First 8 moves in SAN notation
  criticalPositions: string[]; // FEN strings of key positions
}

export interface LearnedPosition {
  fen: string;
  evaluationBias: number; // Adjustment to AI evaluation (-100 to +100)
  timesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayed: number;
  bestMoveFound?: string; // SAN notation of best move discovered
}

export interface LearnedOpening {
  moves: string[]; // Sequence of SAN moves
  winRate: number; // 0 to 1
  gamesPlayed: number;
  lastPlayed: number;
}

interface LearningData {
  version: number;
  positions: { [fen: string]: LearnedPosition };
  openings: { [key: string]: LearnedOpening };
  gameHistory: GameOutcome[];
  totalGames: number;
  lastUpdated: number;
}

// ===========================
// STORAGE KEYS
// ===========================

const STORAGE_KEY = 'chess_learning_data';
const MAX_POSITIONS = 1000; // Limit stored positions
const MAX_GAMES = 100; // Limit game history
const LEARNING_RATE = 0.15; // How quickly to adjust evaluations

// ===========================
// LEARNING ENGINE CLASS
// ===========================

export class LearningEngine {
  private data: LearningData;
  private isDirty: boolean = false;
  private saveTimer: number | null = null;

  constructor() {
    this.data = this.loadData();
  }

  /**
   * Load learning data from localStorage
   */
  private loadData(): LearningData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[LearningEngine] Loaded', Object.keys(parsed.positions || {}).length, 'positions and', parsed.totalGames || 0, 'games');
        return parsed;
      }
    } catch (error) {
      console.error('[LearningEngine] Error loading data:', error);
    }

    // Return fresh data structure
    return {
      version: 1,
      positions: {},
      openings: {},
      gameHistory: [],
      totalGames: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save learning data to localStorage (batched)
   */
  private deferredSave(): void {
    this.isDirty = true;

    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      this.saveNow();
    }, 200); // Batch saves every 200ms
  }

  /**
   * Immediately save to localStorage
   */
  private saveNow(): void {
    if (!this.isDirty) return;

    try {
      this.data.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.isDirty = false;
      console.log('[LearningEngine] Saved learning data');
    } catch (error) {
      console.error('[LearningEngine] Error saving data:', error);
    }
  }

  /**
   * Record a completed game outcome
   */
  public recordGame(
    cpuLevel: number,
    result: 'win' | 'loss' | 'draw',
    moveHistory: string[],
    criticalFens: string[]
  ): void {
    const gameOutcome: GameOutcome = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: Date.now(),
      cpuLevel,
      result,
      moveCount: moveHistory.length,
      openingMoves: moveHistory.slice(0, 8),
      criticalPositions: criticalFens,
    };

    // Add to game history
    this.data.gameHistory.unshift(gameOutcome);
    if (this.data.gameHistory.length > MAX_GAMES) {
      this.data.gameHistory = this.data.gameHistory.slice(0, MAX_GAMES);
    }
    this.data.totalGames++;

    // Update opening statistics
    if (moveHistory.length >= 4) {
      const openingKey = moveHistory.slice(0, 6).join(',');
      if (!this.data.openings[openingKey]) {
        this.data.openings[openingKey] = {
          moves: moveHistory.slice(0, 6),
          winRate: 0,
          gamesPlayed: 0,
          lastPlayed: Date.now(),
        };
      }

      const opening = this.data.openings[openingKey];
      opening.gamesPlayed++;
      opening.lastPlayed = Date.now();
      
      // Update win rate (from CPU's perspective - invert if CPU lost)
      const gameValue = result === 'loss' ? 1 : result === 'draw' ? 0.5 : 0;
      opening.winRate = ((opening.winRate * (opening.gamesPlayed - 1)) + gameValue) / opening.gamesPlayed;
    }

    // Update position statistics
    criticalFens.forEach(fen => {
      this.updatePosition(fen, result);
    });

    console.log('[LearningEngine] Recorded game:', result, 'at level', cpuLevel, '- Total games:', this.data.totalGames);
    this.deferredSave();
  }

  /**
   * Update statistics for a specific position
   */
  private updatePosition(fen: string, result: 'win' | 'loss' | 'draw'): void {
    if (!this.data.positions[fen]) {
      this.data.positions[fen] = {
        fen,
        evaluationBias: 0,
        timesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastPlayed: Date.now(),
      };
    }

    const position = this.data.positions[fen];
    position.timesPlayed++;
    position.lastPlayed = Date.now();

    if (result === 'win') position.wins++;
    else if (result === 'loss') position.losses++;
    else position.draws++;

    // Adjust evaluation bias based on outcome
    // If CPU lost from this position, make it look worse
    // If CPU won, make it look better
    const performanceRatio = (position.wins + position.draws * 0.5) / position.timesPlayed;
    const targetBias = (performanceRatio - 0.5) * 200; // Range: -100 to +100
    
    // Gradually move bias toward target
    position.evaluationBias += (targetBias - position.evaluationBias) * LEARNING_RATE;

    // Prune old positions if we have too many
    if (Object.keys(this.data.positions).length > MAX_POSITIONS) {
      this.prunePositions();
    }
  }

  /**
   * Remove least useful positions to stay under limit
   */
  private prunePositions(): void {
    const positions = Object.values(this.data.positions);
    
    // Sort by usefulness: recent + frequently played = keep
    positions.sort((a, b) => {
      const scoreA = a.timesPlayed + (Date.now() - a.lastPlayed) / (1000 * 60 * 60 * 24 * 30); // Decay over months
      const scoreB = b.timesPlayed + (Date.now() - b.lastPlayed) / (1000 * 60 * 60 * 24 * 30);
      return scoreA - scoreB;
    });

    // Keep top 80% of limit
    const keepCount = Math.floor(MAX_POSITIONS * 0.8);
    const toRemove = positions.slice(0, positions.length - keepCount);
    
    toRemove.forEach(pos => {
      delete this.data.positions[pos.fen];
    });

    console.log('[LearningEngine] Pruned', toRemove.length, 'old positions');
  }

  /**
   * Get learned evaluation bias for a position
   */
  public getPositionBias(fen: string): number {
    const position = this.data.positions[fen];
    if (!position || position.timesPlayed < 2) {
      return 0; // Need at least 2 games to learn
    }
    return position.evaluationBias;
  }

  /**
   * Mark a position as being played (for learning)
   */
  public markPositionPlayed(fen: string): void {
    if (!this.data.positions[fen]) {
      this.data.positions[fen] = {
        fen,
        evaluationBias: 0,
        timesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastPlayed: Date.now(),
      };
    }
    // Don't increment timesPlayed here - wait for game outcome
    this.data.positions[fen].lastPlayed = Date.now();
  }

  /**
   * Get opening recommendations based on learned win rates
   */
  public getBestOpenings(count: number = 3): LearnedOpening[] {
    const openings = Object.values(this.data.openings)
      .filter(o => o.gamesPlayed >= 2)
      .sort((a, b) => {
        // Sort by win rate, but consider sample size
        const confidenceA = Math.min(a.gamesPlayed / 10, 1);
        const confidenceB = Math.min(b.gamesPlayed / 10, 1);
        return (b.winRate * confidenceB) - (a.winRate * confidenceA);
      });

    return openings.slice(0, count);
  }

  /**
   * Get statistics for display
   */
  public getStats(): {
    totalGames: number;
    positionsLearned: number;
    openingsLearned: number;
    bestOpenings: LearnedOpening[];
  } {
    return {
      totalGames: this.data.totalGames,
      positionsLearned: Object.keys(this.data.positions).length,
      openingsLearned: Object.keys(this.data.openings).length,
      bestOpenings: this.getBestOpenings(5),
    };
  }

  /**
   * Check if a position has been learned (played at least twice)
   */
  public hasLearnedPosition(fen: string): boolean {
    const position = this.data.positions[fen];
    return position !== undefined && position.timesPlayed >= 2;
  }

  /**
   * Get recent game history
   */
  public getRecentGames(count: number = 10): GameOutcome[] {
    return this.data.gameHistory.slice(0, count);
  }

  /**
   * Reset all learning data (for testing or user request)
   */
  public reset(): void {
    this.data = {
      version: 1,
      positions: {},
      openings: {},
      gameHistory: [],
      totalGames: 0,
      lastUpdated: Date.now(),
    };
    this.saveNow();
    console.log('[LearningEngine] Reset all learning data');
  }
}

// ===========================
// SINGLETON INSTANCE
// ===========================

let learningEngineInstance: LearningEngine | null = null;

export function getLearningEngine(): LearningEngine {
  if (!learningEngineInstance) {
    learningEngineInstance = new LearningEngine();
  }
  return learningEngineInstance;
}
