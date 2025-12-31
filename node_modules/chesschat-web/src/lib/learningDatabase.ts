/**
 * Learning Database for Chess AI
 * Stores game outcomes, positions, and learned patterns in localStorage
 * Provides learning capabilities for CPU levels 7-8
 */

interface GameOutcome {
  result: 'win' | 'loss' | 'draw';
  cpuColor: 'white' | 'black';
  cpuLevel: number;
  moveCount: number;
  timestamp: number;
  finalPosition: string; // FEN
  openingMoves: string[]; // First 8 moves in algebraic notation
}

interface LearnedPosition {
  fen: string;
  bestMove: { from: string; to: string; promotion?: string };
  winRate: number; // 0-1
  timesPlayed: number;
  avgOutcome: number; // 1 for win, 0.5 for draw, 0 for loss
  lastUpdated: number;
}

interface OpeningLine {
  moves: string[]; // Algebraic notation
  winRate: number;
  timesPlayed: number;
  avgOutcome: number;
  cpuColor: 'white' | 'black';
  lastUpdated: number;
}

interface TacticalPattern {
  patternType: 'pin' | 'fork' | 'skewer' | 'discovered-attack' | 'double-attack' | 'sacrifice';
  position: string; // FEN
  move: { from: string; to: string; promotion?: string };
  successRate: number; // 0-1
  timesUsed: number;
}

interface LearningData {
  gameHistory: GameOutcome[];
  learnedPositions: { [fen: string]: LearnedPosition };
  openingLines: { [key: string]: OpeningLine }; // key = moves joined by ','
  tacticalPatterns: TacticalPattern[];
  statistics: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    lastUpdated: number;
  };
}

const STORAGE_KEY = 'chess_learning_database';
const MAX_POSITIONS = 1000;
const MAX_GAMES = 500;
const MAX_PATTERNS = 200;

class LearningDatabase {
  private data: LearningData;

  constructor() {
    this.data = this.loadFromStorage();
  }

  private loadFromStorage(): LearningData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate structure
        if (parsed.gameHistory && parsed.learnedPositions && parsed.openingLines) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('[LearningDB] Failed to load from storage:', error);
    }

    // Return default structure
    return {
      gameHistory: [],
      learnedPositions: {},
      openingLines: {},
      tacticalPatterns: [],
      statistics: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastUpdated: Date.now(),
      },
    };
  }

  private saveToStorage(): void {
    try {
      // Limit storage size
      this.pruneOldData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error('[LearningDB] Failed to save to storage:', error);
    }
  }

  private pruneOldData(): void {
    // Keep only recent games
    if (this.data.gameHistory.length > MAX_GAMES) {
      this.data.gameHistory = this.data.gameHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_GAMES);
    }

    // Keep only best-performing positions
    const positions = Object.entries(this.data.learnedPositions);
    if (positions.length > MAX_POSITIONS) {
      const sorted = positions.sort((a, b) => {
        // Sort by combination of winRate and timesPlayed
        const scoreA = a[1].winRate * Math.log(a[1].timesPlayed + 1);
        const scoreB = b[1].winRate * Math.log(b[1].timesPlayed + 1);
        return scoreB - scoreA;
      });
      this.data.learnedPositions = Object.fromEntries(sorted.slice(0, MAX_POSITIONS));
    }

    // Keep only successful tactical patterns
    if (this.data.tacticalPatterns.length > MAX_PATTERNS) {
      this.data.tacticalPatterns = this.data.tacticalPatterns
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, MAX_PATTERNS);
    }
  }

  /**
   * Record a completed game outcome
   */
  recordGame(outcome: Omit<GameOutcome, 'timestamp'>): void {
    const game: GameOutcome = {
      ...outcome,
      timestamp: Date.now(),
    };

    this.data.gameHistory.push(game);
    this.data.statistics.totalGames++;
    
    if (outcome.result === 'win') {
      this.data.statistics.wins++;
    } else if (outcome.result === 'loss') {
      this.data.statistics.losses++;
    } else {
      this.data.statistics.draws++;
    }

    this.data.statistics.lastUpdated = Date.now();

    // Learn from opening moves
    if (outcome.openingMoves.length > 0) {
      this.recordOpeningLine(outcome.openingMoves, outcome.result, outcome.cpuColor);
    }

    this.saveToStorage();
    console.log('[LearningDB] Recorded game:', outcome.result, 'Total games:', this.data.statistics.totalGames);
  }

  /**
   * Record an opening line with its outcome
   */
  private recordOpeningLine(moves: string[], result: 'win' | 'loss' | 'draw', cpuColor: 'white' | 'black'): void {
    // Only learn from first 6 moves
    const openingMoves = moves.slice(0, 6);
    const key = openingMoves.join(',');

    if (!this.data.openingLines[key]) {
      this.data.openingLines[key] = {
        moves: openingMoves,
        winRate: 0,
        timesPlayed: 0,
        avgOutcome: 0,
        cpuColor,
        lastUpdated: Date.now(),
      };
    }

    const line = this.data.openingLines[key];
    line.timesPlayed++;

    // Update avgOutcome (1 = win, 0.5 = draw, 0 = loss)
    const outcomeValue = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    line.avgOutcome = (line.avgOutcome * (line.timesPlayed - 1) + outcomeValue) / line.timesPlayed;
    line.winRate = line.avgOutcome;
    line.lastUpdated = Date.now();
  }

  /**
   * Record a learned position with its best move
   */
  recordPosition(fen: string, move: { from: string; to: string; promotion?: string }, outcome: 'win' | 'loss' | 'draw'): void {
    if (!this.data.learnedPositions[fen]) {
      this.data.learnedPositions[fen] = {
        fen,
        bestMove: move,
        winRate: 0,
        timesPlayed: 0,
        avgOutcome: 0,
        lastUpdated: Date.now(),
      };
    }

    const position = this.data.learnedPositions[fen];
    position.timesPlayed++;

    const outcomeValue = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
    position.avgOutcome = (position.avgOutcome * (position.timesPlayed - 1) + outcomeValue) / position.timesPlayed;
    position.winRate = position.avgOutcome;
    position.lastUpdated = Date.now();

    // Update best move if this move had better outcome
    if (outcomeValue > position.avgOutcome) {
      position.bestMove = move;
    }

    this.saveToStorage();
  }

  /**
   * Get learned move for a position (if exists and has good win rate)
   */
  getLearnedMove(fen: string, minWinRate = 0.55): { from: string; to: string; promotion?: string } | null {
    const position = this.data.learnedPositions[fen];
    if (!position) {
      return null;
    }

    // Only use if we've played it enough times and it has good results
    if (position.timesPlayed >= 3 && position.winRate >= minWinRate) {
      console.log(`[LearningDB] Using learned move for position (WR: ${(position.winRate * 100).toFixed(1)}%, N=${position.timesPlayed})`);
      return position.bestMove;
    }

    return null;
  }

  /**
   * Get opening moves that have been successful
   */
  getSuccessfulOpening(cpuColor: 'white' | 'black', minGames = 2): string[] | null {
    const lines = Object.values(this.data.openingLines)
      .filter(line => line.cpuColor === cpuColor && line.timesPlayed >= minGames)
      .sort((a, b) => b.winRate - a.winRate);

    if (lines.length > 0 && lines[0].winRate >= 0.6) {
      console.log(`[LearningDB] Using successful opening (WR: ${(lines[0].winRate * 100).toFixed(1)}%, N=${lines[0].timesPlayed})`);
      return lines[0].moves;
    }

    return null;
  }

  /**
   * Record a tactical pattern
   */
  recordTacticalPattern(
    patternType: TacticalPattern['patternType'],
    position: string,
    move: { from: string; to: string; promotion?: string },
    success: boolean
  ): void {
    const existing = this.data.tacticalPatterns.find(
      p => p.position === position && p.move.from === move.from && p.move.to === move.to
    );

    if (existing) {
      existing.timesUsed++;
      existing.successRate = (existing.successRate * (existing.timesUsed - 1) + (success ? 1 : 0)) / existing.timesUsed;
    } else {
      this.data.tacticalPatterns.push({
        patternType,
        position,
        move,
        successRate: success ? 1 : 0,
        timesUsed: 1,
      });
    }

    this.saveToStorage();
  }

  /**
   * Get statistics
   */
  getStatistics(): LearningData['statistics'] {
    return { ...this.data.statistics };
  }

  /**
   * Get win rate for specific level
   */
  getWinRateForLevel(level: number): number {
    const games = this.data.gameHistory.filter(g => g.cpuLevel === level);
    if (games.length === 0) return 0;

    const wins = games.filter(g => g.result === 'win').length;
    return wins / games.length;
  }

  /**
   * Clear all learning data (for testing or reset)
   */
  clearAll(): void {
    this.data = {
      gameHistory: [],
      learnedPositions: {},
      openingLines: {},
      tacticalPatterns: [],
      statistics: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastUpdated: Date.now(),
      },
    };
    this.saveToStorage();
    console.log('[LearningDB] All learning data cleared');
  }

  /**
   * Export learning data as JSON
   */
  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }
}

// Singleton instance
export const learningDB = new LearningDatabase();
