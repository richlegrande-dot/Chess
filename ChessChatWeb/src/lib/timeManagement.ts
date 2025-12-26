/**
 * Time Management and Performance Budgeting System
 * Intelligently allocates thinking time across moves
 */

import { PositionCriticality } from './positionCriticality';

export interface TimeManagementConfig {
  baseTimePerMove: number;     // Default time per move (ms)
  maxTimePerMove: number;      // Hard limit per move (ms)
  targetAverageTime: number;   // Target average across game (ms)
  maxBankTime: number;         // Maximum time that can be banked (ms)
  earlyGameMultiplier: number; // More time in early game (1.0-1.5)
  lateGameMultiplier: number;  // Less time in late game (0.7-1.0)
}

export class TimeManager {
  private config: TimeManagementConfig;
  private bankTime: number = 0;
  private movesPlayed: number = 0;
  private totalTimeUsed: number = 0;
  private timeHistory: number[] = [];
  
  constructor(config: TimeManagementConfig) {
    this.config = config;
  }
  
  /**
   * Calculate how much time to allocate for the next move
   */
  public calculateMoveTime(
    criticality: PositionCriticality,
    moveNumber: number
  ): number {
    this.movesPlayed = moveNumber;
    
    // Start with base time
    let allocatedTime = this.config.baseTimePerMove;
    
    // Apply game phase multiplier
    const phaseMultiplier = this.getGamePhaseMultiplier(moveNumber);
    allocatedTime *= phaseMultiplier;
    
    // Apply criticality multiplier
    allocatedTime *= criticality.recommendedTimeMultiplier;
    
    // Use banked time for critical positions
    if (criticality.isCritical && this.bankTime > 0) {
      const maxBonus = this.config.maxTimePerMove - allocatedTime;
      const availableBonus = Math.min(this.bankTime * 0.6, maxBonus); // Use up to 60% of bank
      allocatedTime += availableBonus;
      
      console.log(`[TimeManager] Using ${Math.round(availableBonus)}ms from time bank (${Math.round(this.bankTime)}ms available)`);
    }
    
    // For simple positions, reduce time further
    if (!criticality.isCritical && criticality.score < 20) {
      allocatedTime = Math.min(allocatedTime, this.config.baseTimePerMove * 0.5);
    }
    
    // Enforce hard limit
    const finalTime = Math.min(allocatedTime, this.config.maxTimePerMove);
    
    console.log(`[TimeManager] Move ${moveNumber}: allocated ${Math.round(finalTime)}ms (criticality: ${criticality.score}, bank: ${Math.round(this.bankTime)}ms)`);
    
    return finalTime;
  }
  
  /**
   * Record actual time used and update time bank
   */
  public recordMoveTime(allocatedTime: number, actualTime: number): void {
    this.totalTimeUsed += actualTime;
    this.timeHistory.push(actualTime);
    
    // Calculate time saved/overspent
    const timeDelta = allocatedTime - actualTime;
    
    if (timeDelta > 0) {
      // Saved time - add to bank
      this.bankTime = Math.min(
        this.bankTime + timeDelta,
        this.config.maxBankTime
      );
      console.log(`[TimeManager] Banked ${Math.round(timeDelta)}ms, bank now: ${Math.round(this.bankTime)}ms`);
    } else if (timeDelta < 0) {
      // Overspent - deduct from bank
      const overspent = Math.abs(timeDelta);
      this.bankTime = Math.max(0, this.bankTime - overspent * 0.5); // Only partially penalize
      console.log(`[TimeManager] Overspent ${Math.round(overspent)}ms, bank now: ${Math.round(this.bankTime)}ms`);
    }
    
    // Log statistics periodically
    if (this.timeHistory.length % 5 === 0) {
      this.logStatistics();
    }
  }
  
  /**
   * Get game phase multiplier
   * Early game (moves 1-15): More time available
   * Mid game (moves 16-30): Normal time
   * Late game (moves 31+): Less time (simpler positions)
   */
  private getGamePhaseMultiplier(moveNumber: number): number {
    if (moveNumber <= 15) {
      return this.config.earlyGameMultiplier;
    } else if (moveNumber <= 30) {
      return 1.0;
    } else {
      return this.config.lateGameMultiplier;
    }
  }
  
  /**
   * Log time management statistics
   */
  private logStatistics(): void {
    if (this.timeHistory.length === 0) return;
    
    const avgTime = this.totalTimeUsed / this.timeHistory.length;
    const maxTime = Math.max(...this.timeHistory);
    const minTime = Math.min(...this.timeHistory);
    
    console.log(`[TimeManager] Stats after ${this.timeHistory.length} moves:`);
    console.log(`  Average: ${Math.round(avgTime)}ms (target: ${this.config.targetAverageTime}ms)`);
    console.log(`  Range: ${Math.round(minTime)}ms - ${Math.round(maxTime)}ms`);
    console.log(`  Total: ${Math.round(this.totalTimeUsed / 1000)}s`);
    console.log(`  Bank: ${Math.round(this.bankTime)}ms`);
  }
  
  /**
   * Get current statistics
   */
  public getStatistics() {
    const avgTime = this.timeHistory.length > 0 
      ? this.totalTimeUsed / this.timeHistory.length 
      : 0;
      
    return {
      movesPlayed: this.movesPlayed,
      averageTime: avgTime,
      totalTime: this.totalTimeUsed,
      bankTime: this.bankTime,
      isUnderTarget: avgTime <= this.config.targetAverageTime
    };
  }
  
  /**
   * Reset for a new game
   */
  public reset(): void {
    this.bankTime = 0;
    this.movesPlayed = 0;
    this.totalTimeUsed = 0;
    this.timeHistory = [];
  }
}

/**
 * Create time manager with default configuration for a specific level
 */
export function createTimeManager(cpuLevel: number): TimeManager {
  const config: TimeManagementConfig = {
    baseTimePerMove: cpuLevel >= 7 ? 5000 : cpuLevel >= 5 ? 3000 : 1500,
    maxTimePerMove: cpuLevel >= 7 ? 15000 : cpuLevel >= 5 ? 8000 : 4000,
    targetAverageTime: cpuLevel >= 7 ? 4000 : cpuLevel >= 5 ? 2000 : 1000,
    maxBankTime: cpuLevel >= 7 ? 15000 : cpuLevel >= 5 ? 8000 : 5000,
    earlyGameMultiplier: 1.3,
    lateGameMultiplier: 0.9
  };
  
  return new TimeManager(config);
}
