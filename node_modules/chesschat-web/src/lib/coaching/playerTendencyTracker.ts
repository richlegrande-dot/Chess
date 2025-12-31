/**
 * Player Tendency Tracker
 * 
 * Identifies and tracks recurring behavioral patterns beyond simple mistakes.
 * Examples:
 * - "Avoids piece exchanges"
 * - "Delays castling"
 * - "Rushes in time pressure"
 * - "Passive in open positions"
 */

import { PlayerTendency, DecisionContext } from './types';
import { ChessGame } from '../ChessGame';

// ============================================================================
// TENDENCY DEFINITIONS
// ============================================================================

interface TendencySignal {
  id: string;
  description: string;
  category: 'tactical' | 'strategic' | 'psychological' | 'time';
  detector: (position: ChessGame, context: DecisionContext, moveHistory: string[]) => number;  // Returns strength 0-1
}

const TENDENCY_SIGNALS: TendencySignal[] = [
  {
    id: 'avoids_exchanges',
    description: 'avoids piece exchanges when equal or ahead',
    category: 'strategic',
    detector: (position, context, history) => {
      // Check if player had exchange opportunities but didn't take them
      if (context.materialBalance >= 0) {
        const lastMove = history[history.length - 1];
        const availableCaptures = countAvailableCaptures(position);
        
        if (availableCaptures > 0 && !lastMove?.includes('x')) {
          return 0.7;  // Strong signal
        }
      }
      return 0;
    }
  },
  {
    id: 'delays_castling',
    description: 'delays castling past move 10',
    category: 'strategic',
    detector: (position, context, history) => {
      if (history.length > 10 && !position.hasCastled()) {
        return 0.8;
      }
      return 0;
    }
  },
  {
    id: 'rushes_in_time_pressure',
    description: 'makes hasty moves under time pressure',
    category: 'psychological',
    detector: (position, context, history) => {
      if (context.timePressure) {
        return 0.6;
      }
      return 0;
    }
  },
  {
    id: 'passive_in_open_positions',
    description: 'plays passively in open tactical positions',
    category: 'tactical',
    detector: (position, context, history) => {
      if (context.positionType === 'open' || context.positionType === 'tactical') {
        const moveStr = history[history.length - 1] || '';
        const isPassive = !moveStr.includes('x') && !moveStr.includes('+');
        
        if (isPassive) {
          return 0.5;
        }
      }
      return 0;
    }
  },
  {
    id: 'overextends_pawns',
    description: 'pushes pawns too far forward',
    category: 'strategic',
    detector: (position, context, history) => {
      // Would need pawn structure analysis
      // Placeholder for now
      return 0;
    }
  },
  {
    id: 'neglects_king_safety',
    description: 'doesn\'t prioritize king safety',
    category: 'strategic',
    detector: (position, context, history) => {
      if (context.kingSafety === 'exposed' || context.kingSafety === 'critical') {
        return 0.7;
      }
      return 0;
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countAvailableCaptures(position: ChessGame): number {
  try {
    const moves = position.moves({ verbose: true });
    return moves.filter((m: any) => m.captured).length;
  } catch {
    return 0;
  }
}

// ============================================================================
// TENDENCY TRACKER
// ============================================================================

export class PlayerTendencyTracker {
  private tendencies: Map<string, PlayerTendency> = new Map();
  
  /**
   * Analyze a position and update tendency observations
   */
  analyzeTendencies(
    gameIndex: number,
    moveNumber: number,
    position: ChessGame,
    context: DecisionContext,
    moveHistory: string[]
  ): void {
    
    TENDENCY_SIGNALS.forEach(signal => {
      const strength = signal.detector(position, context, moveHistory);
      
      if (strength > 0.3) {  // Only record meaningful signals
        this.recordObservation(signal, gameIndex, moveNumber, strength);
      }
    });
  }
  
  /**
   * Record a tendency observation
   */
  private recordObservation(
    signal: TendencySignal,
    gameIndex: number,
    moveNumber: number,
    strength: number
  ): void {
    
    let tendency = this.tendencies.get(signal.id);
    
    if (!tendency) {
      tendency = {
        id: signal.id,
        description: signal.description,
        category: signal.category,
        observations: [],
        confidenceScore: 0,
        trend: 'stable',
        lastUpdated: Date.now()
      };
      this.tendencies.set(signal.id, tendency);
    }
    
    // Add observation
    tendency.observations.push({
      gameIndex,
      moveNumber,
      strength
    });
    
    // Update confidence (log growth, stabilizes around 10 observations)
    const n = tendency.observations.length;
    tendency.confidenceScore = Math.min(1, Math.log10(n + 1) / Math.log10(11));
    
    // Update trend
    tendency.trend = this.detectTrend(tendency);
    tendency.lastUpdated = Date.now();
  }
  
  /**
   * Detect if tendency is improving, stable, or worsening
   */
  private detectTrend(tendency: PlayerTendency): 'improving' | 'stable' | 'worsening' {
    if (tendency.observations.length < 6) {
      return 'stable';  // Not enough data
    }
    
    const recent = tendency.observations.slice(-5);
    const older = tendency.observations.slice(-10, -5);
    
    const recentAvgStrength = recent.reduce((sum, o) => sum + o.strength, 0) / recent.length;
    const olderAvgStrength = older.reduce((sum, o) => sum + o.strength, 0) / older.length;
    
    const delta = recentAvgStrength - olderAvgStrength;
    
    if (delta < -0.2) return 'improving';  // Tendency weakening
    if (delta > 0.2) return 'worsening';   // Tendency strengthening
    return 'stable';
  }
  
  /**
   * Get all tracked tendencies
   */
  getTendencies(): PlayerTendency[] {
    return Array.from(this.tendencies.values());
  }
  
  /**
   * Get high-confidence tendencies
   */
  getHighConfidenceTendencies(threshold: number = 0.6): PlayerTendency[] {
    return this.getTendencies().filter(t => t.confidenceScore >= threshold);
  }
  
  /**
   * Get tendency by ID
   */
  getTendency(id: string): PlayerTendency | undefined {
    return this.tendencies.get(id);
  }
  
  /**
   * Clear all tendencies (developer only)
   */
  _dangerouslyClear(): void {
    this.tendencies.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: PlayerTendencyTracker | null = null;

export function getPlayerTendencyTracker(): PlayerTendencyTracker {
  if (!instance) {
    instance = new PlayerTendencyTracker();
  }
  return instance;
}
