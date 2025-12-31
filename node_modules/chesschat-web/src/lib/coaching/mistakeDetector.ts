/**
 * Mistake Detection Pipeline
 * Converts game analysis into structured MistakeEvents
 * 
 * Phase 2 of Enhanced Learning System
 */

import { Chess } from 'chess.js';
import {
  MistakeEvent,
  MistakeCategory,
  MistakeSeverity,
  TacticalMistake,
  StrategicViolation,
  GameplayMetrics,
} from './types';

/**
 * Generate unique mistake event ID
 */
function generateEventId(gameId: string, moveNumber: number): string {
  return `${gameId}_m${moveNumber}_${Date.now()}`;
}

/**
 * Determine mistake category from context
 */
function categorizeMistake(
  moveNumber: number,
  context: 'tactical' | 'strategic' | 'time'
): MistakeCategory {
  // Opening phase: moves 1-15
  if (moveNumber <= 15) {
    return 'opening';
  }
  
  // Endgame: will be determined by piece count in FEN
  // For now, late moves (40+) are likely endgame
  if (moveNumber >= 40) {
    return 'endgame';
  }
  
  // Middlegame: categorize by type
  if (context === 'tactical') {
    return 'tactics';
  }
  
  if (context === 'strategic') {
    return 'strategy';
  }
  
  return 'tactics'; // default
}

/**
 * Determine if position is endgame based on piece count
 */
function isEndgame(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    let pieceCount = 0;
    let queenCount = 0;
    
    const board = chess.board();
    for (const row of board) {
      for (const square of row) {
        if (square && square.type !== 'k' && square.type !== 'p') {
          pieceCount++;
          if (square.type === 'q') queenCount++;
        }
      }
    }
    
    // Endgame: <= 6 non-pawn pieces, or no queens
    return pieceCount <= 6 || (queenCount === 0 && pieceCount <= 10);
  } catch {
    return false;
  }
}

/**
 * Map tactical patterns to motifs
 */
function mapTacticalMotif(pattern?: string): string | undefined {
  if (!pattern) return undefined;
  
  const motifMap: Record<string, string> = {
    'fork': 'fork',
    'pin': 'pin',
    'skewer': 'skewer',
    'discovered_attack': 'discovered-attack',
    'mate_in_2': 'mate-threat',
    'mate_in_3': 'mate-threat',
    'back_rank_mate': 'back-rank-weakness',
    'smothered_mate': 'smothered-mate',
    'hanging_piece': 'hung-piece',
  };
  
  return motifMap[pattern] || pattern;
}

/**
 * Map strategic violations to principles
 */
function mapStrategicPrinciple(principle?: string): string | undefined {
  if (!principle) return undefined;
  
  const principleMap: Record<string, string> = {
    'center_control': 'control-center',
    'piece_development': 'develop-pieces',
    'king_safety': 'castle-early',
    'pawn_structure': 'maintain-pawn-structure',
    'piece_activity': 'activate-pieces',
    'king_activity': 'activate-king',
    'passed_pawns': 'create-passed-pawns',
    'castling': 'castle-early',
    'piece_coordination': 'coordinate-pieces',
  };
  
  return principleMap[principle] || principle;
}

/**
 * Determine severity from evaluation delta
 */
function determineSeverity(evalDelta?: number): MistakeSeverity {
  if (!evalDelta) return 'inaccuracy';
  
  const absD = Math.abs(evalDelta);
  if (absD >= 3) return 'blunder';
  if (absD >= 1.5) return 'mistake';
  return 'inaccuracy';
}

/**
 * Generate explanation for why mistake was detected
 */
function generateDetectionReason(
  motif?: string,
  principle?: string,
  evalDelta?: number
): string {
  const parts: string[] = [];
  
  if (motif) {
    parts.push(`Tactical motif: ${motif}`);
  }
  
  if (principle) {
    parts.push(`Violated principle: ${principle}`);
  }
  
  if (evalDelta !== undefined) {
    parts.push(`Eval loss: ${Math.abs(evalDelta).toFixed(1)} pawns`);
  }
  
  return parts.length > 0 ? parts.join('; ') : 'Identified as suboptimal move';
}

/**
 * Main mistake detection pipeline
 * Converts coaching analysis into structured events
 */
export class MistakeDetector {
  /**
   * Detect mistakes from tactical analysis
   */
  detectTacticalMistakes(
    mistakes: TacticalMistake[],
    gameId: string
  ): MistakeEvent[] {
    return mistakes.map(mistake => {
      const category = categorizeMistake(mistake.moveNumber, 'tactical');
      const isEndgameMove = isEndgame(mistake.fen);
      const finalCategory = isEndgameMove ? 'endgame' : category;
      
      const motif = mapTacticalMotif(mistake.pattern);
      const severity = determineSeverity(mistake.evaluation);
      
      const tags: string[] = [finalCategory];
      if (motif) tags.push(motif);
      if (mistake.pattern) tags.push(mistake.pattern);
      
      return {
        id: generateEventId(gameId, mistake.moveNumber),
        gameId,
        timestamp: Date.now(),
        moveNumber: mistake.moveNumber,
        fen: mistake.fen,
        playedMoveSAN: mistake.move,
        bestMoveSAN: mistake.suggestedMove,
        evalDelta: mistake.evaluation,
        category: finalCategory,
        motif,
        principle: undefined,
        severity,
        tags,
        whyDetected: generateDetectionReason(motif, undefined, mistake.evaluation),
      };
    });
  }

  /**
   * Detect mistakes from strategic violations
   */
  detectStrategicViolations(
    violations: StrategicViolation[],
    gameId: string
  ): MistakeEvent[] {
    return violations.map(violation => {
      const principle = mapStrategicPrinciple(violation.principle);
      const category = violation.phase === 'endgame' ? 'endgame' :
                       violation.phase === 'opening' ? 'opening' : 'strategy';
      
      // Map severity
      const severityMap: Record<string, MistakeSeverity> = {
        'minor': 'inaccuracy',
        'moderate': 'mistake',
        'major': 'blunder',
      };
      const severity = severityMap[violation.severity] || 'inaccuracy';
      
      const tags: string[] = [category, violation.phase];
      if (principle) tags.push(principle);
      tags.push(violation.principle);
      
      return {
        id: generateEventId(gameId, violation.moveNumber),
        gameId,
        timestamp: Date.now(),
        moveNumber: violation.moveNumber,
        fen: '', // Not available from violations
        playedMoveSAN: '', // Not available from violations
        bestMoveSAN: undefined,
        evalDelta: undefined,
        category,
        motif: undefined,
        principle,
        severity,
        tags,
        whyDetected: `Strategic violation: ${violation.explanation}`,
      };
    });
  }

  /**
   * Detect time management issues
   */
  detectTimeMistakes(
    metrics: GameplayMetrics[],
    gameId: string
  ): MistakeEvent[] {
    const events: MistakeEvent[] = [];
    
    // Calculate average think time
    const thinkTimes = metrics
      .map(m => m.thinkTime)
      .filter((t): t is number => t !== undefined && t > 0);
    
    if (thinkTimes.length < 5) return events;
    
    const avgThinkTime = thinkTimes.reduce((a, b) => a + b, 0) / thinkTimes.length;
    const threshold = avgThinkTime * 3; // 3x average is too long
    
    metrics.forEach(metric => {
      if (metric.thinkTime && metric.thinkTime > threshold && metric.thinkTime > 10000) {
        events.push({
          id: generateEventId(gameId, metric.moveNumber),
          gameId,
          timestamp: Date.now(),
          moveNumber: metric.moveNumber,
          fen: metric.fen,
          playedMoveSAN: metric.move,
          bestMoveSAN: undefined,
          evalDelta: undefined,
          category: 'time',
          motif: undefined,
          principle: 'time-management',
          severity: 'inaccuracy',
          tags: ['time', 'slow-move'],
          whyDetected: `Excessive think time: ${(metric.thinkTime / 1000).toFixed(1)}s (avg: ${(avgThinkTime / 1000).toFixed(1)}s)`,
        });
      }
    });
    
    return events;
  }

  /**
   * Main pipeline: detect all mistakes from a game
   */
  detectMistakes(
    gameId: string,
    tacticalMistakes: TacticalMistake[],
    strategicViolations: StrategicViolation[],
    metrics: GameplayMetrics[]
  ): MistakeEvent[] {
    const events: MistakeEvent[] = [];
    
    // Tactical mistakes
    events.push(...this.detectTacticalMistakes(tacticalMistakes, gameId));
    
    // Strategic violations
    events.push(...this.detectStrategicViolations(strategicViolations, gameId));
    
    // Time management
    events.push(...this.detectTimeMistakes(metrics, gameId));
    
    // Sort by move number
    events.sort((a, b) => a.moveNumber - b.moveNumber);
    
    // Deduplicate events at same move
    const uniqueEvents = events.filter((event, index, arr) => {
      // Keep if first occurrence of this move number
      return arr.findIndex(e => e.moveNumber === event.moveNumber) === index;
    });
    
    return uniqueEvents;
  }
}

// Singleton instance
let mistakeDetectorInstance: MistakeDetector | null = null;

export function getMistakeDetector(): MistakeDetector {
  if (!mistakeDetectorInstance) {
    mistakeDetectorInstance = new MistakeDetector();
  }
  return mistakeDetectorInstance;
}
