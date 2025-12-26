/**
 * Performance Metrics Tracking
 * Collects and analyzes AI performance data
 */

export interface MovePerformanceMetric {
  moveNumber: number;
  depth: number;
  timeMs: number;
  timeAllocated: number;
  criticalityScore: number;
  isCritical: boolean;
  source: string;
  timestamp: number;
}

export interface GamePerformanceMetrics {
  gameId: string;
  cpuLevel: number;
  moves: MovePerformanceMetric[];
  startTime: number;
  endTime?: number;
}

export class PerformanceMetricsTracker {
  private currentGame: GamePerformanceMetrics | null = null;
  private gameHistory: GamePerformanceMetrics[] = [];
  
  /**
   * Start tracking a new game
   */
  public startGame(cpuLevel: number): void {
    this.currentGame = {
      gameId: `game-${Date.now()}`,
      cpuLevel,
      moves: [],
      startTime: Date.now()
    };
  }
  
  /**
   * Record a move's performance metrics
   */
  public recordMove(metric: MovePerformanceMetric): void {
    if (!this.currentGame) {
      console.warn('[PerformanceMetrics] No active game to record move');
      return;
    }
    
    this.currentGame.moves.push(metric);
  }
  
  /**
   * End the current game
   */
  public endGame(): void {
    if (!this.currentGame) return;
    
    this.currentGame.endTime = Date.now();
    this.gameHistory.push(this.currentGame);
    
    // Keep only last 10 games
    if (this.gameHistory.length > 10) {
      this.gameHistory.shift();
    }
    
    // Log summary
    this.logGameSummary(this.currentGame);
    
    this.currentGame = null;
  }
  
  /**
   * Get statistics for the current game
   */
  public getCurrentGameStats() {
    if (!this.currentGame || this.currentGame.moves.length === 0) {
      return null;
    }
    
    const moves = this.currentGame.moves;
    const times = moves.map(m => m.timeMs);
    const criticalMoves = moves.filter(m => m.isCritical);
    
    return {
      totalMoves: moves.length,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      maxTime: Math.max(...times),
      minTime: Math.min(...times),
      criticalMovesCount: criticalMoves.length,
      criticalMovesPercent: (criticalMoves.length / moves.length) * 100,
      averageCriticalTime: criticalMoves.length > 0 
        ? criticalMoves.map(m => m.timeMs).reduce((a, b) => a + b, 0) / criticalMoves.length 
        : 0,
      averageDepth: moves.map(m => m.depth).reduce((a, b) => a + b, 0) / moves.length,
      timeEfficiency: this.calculateTimeEfficiency(moves)
    };
  }
  
  /**
   * Calculate how efficiently time was used
   * Returns 0-100 score (higher is better)
   */
  private calculateTimeEfficiency(moves: MovePerformanceMetric[]): number {
    if (moves.length === 0) return 0;
    
    // Good efficiency = used less time than allocated on simple positions,
    // used close to allocated time on critical positions
    let efficiencyScore = 0;
    
    for (const move of moves) {
      const timeUtilization = move.timeMs / move.timeAllocated;
      
      if (move.isCritical) {
        // Critical moves should use most of allocated time (0.8-1.0 is good)
        if (timeUtilization >= 0.8 && timeUtilization <= 1.1) {
          efficiencyScore += 1.0;
        } else if (timeUtilization >= 0.6 && timeUtilization < 0.8) {
          efficiencyScore += 0.7;
        } else {
          efficiencyScore += 0.4;
        }
      } else {
        // Non-critical moves should be fast (0.3-0.7 is good)
        if (timeUtilization <= 0.7) {
          efficiencyScore += 1.0;
        } else if (timeUtilization <= 0.9) {
          efficiencyScore += 0.7;
        } else {
          efficiencyScore += 0.4;
        }
      }
    }
    
    return (efficiencyScore / moves.length) * 100;
  }
  
  /**
   * Log game summary to console
   */
  private logGameSummary(game: GamePerformanceMetrics): void {
    const stats = this.getGameStats(game);
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`🎮 Game Performance Summary (Level ${game.cpuLevel})`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`Total Moves: ${stats.totalMoves}`);
    console.log(`Average Time: ${stats.averageTime.toFixed(0)}ms`);
    console.log(`Time Range: ${stats.minTime.toFixed(0)}ms - ${stats.maxTime.toFixed(0)}ms`);
    console.log(`Average Depth: ${stats.averageDepth.toFixed(1)}`);
    console.log(`Critical Moves: ${stats.criticalMovesCount} (${stats.criticalMovesPercent.toFixed(1)}%)`);
    console.log(`Critical Avg Time: ${stats.averageCriticalTime.toFixed(0)}ms`);
    console.log(`Time Efficiency: ${stats.timeEfficiency.toFixed(1)}%`);
    console.log(`Game Duration: ${((game.endTime! - game.startTime) / 1000 / 60).toFixed(1)} minutes`);
    console.log(`═══════════════════════════════════════════\n`);
  }
  
  /**
   * Get statistics for a completed game
   */
  private getGameStats(game: GamePerformanceMetrics) {
    const moves = game.moves;
    const times = moves.map(m => m.timeMs);
    const criticalMoves = moves.filter(m => m.isCritical);
    
    return {
      totalMoves: moves.length,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      maxTime: Math.max(...times),
      minTime: Math.min(...times),
      criticalMovesCount: criticalMoves.length,
      criticalMovesPercent: (criticalMoves.length / moves.length) * 100,
      averageCriticalTime: criticalMoves.length > 0 
        ? criticalMoves.map(m => m.timeMs).reduce((a, b) => a + b, 0) / criticalMoves.length 
        : 0,
      averageDepth: moves.map(m => m.depth).reduce((a, b) => a + b, 0) / moves.length,
      timeEfficiency: this.calculateTimeEfficiency(moves)
    };
  }
  
  /**
   * Get historical performance data
   */
  public getHistoricalStats(cpuLevel?: number) {
    const games = cpuLevel 
      ? this.gameHistory.filter(g => g.cpuLevel === cpuLevel)
      : this.gameHistory;
      
    if (games.length === 0) return null;
    
    const allStats = games.map(g => this.getGameStats(g));
    
    return {
      gamesPlayed: games.length,
      averageTimePerMove: allStats.reduce((sum, s) => sum + s.averageTime, 0) / allStats.length,
      averageDepth: allStats.reduce((sum, s) => sum + s.averageDepth, 0) / allStats.length,
      averageTimeEfficiency: allStats.reduce((sum, s) => sum + s.timeEfficiency, 0) / allStats.length,
      criticalMoveRate: allStats.reduce((sum, s) => sum + s.criticalMovesPercent, 0) / allStats.length
    };
  }
}

// Global singleton instance
let metricsTracker: PerformanceMetricsTracker | null = null;

export function getMetricsTracker(): PerformanceMetricsTracker {
  if (!metricsTracker) {
    metricsTracker = new PerformanceMetricsTracker();
  }
  return metricsTracker;
}
