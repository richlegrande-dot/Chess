/**
 * Game Analysis V3 - Performance-Guarded Stockfish Analysis
 * 
 * Tiered analysis with caching and timeout protection.
 * Now uses /evaluate endpoint for fast, movetime-respecting evaluations.
 */

import { Chess } from 'chess.js';
import type { MistakeEvent } from './learningCore';
import type { Env } from './featureFlags';
import { StockfishEngine } from './stockfish';
import { timed } from './timing';

/**
 * FEN evaluation cache (per-request, in-memory)
 */
class EvalCache {
  private cache = new Map<string, { score: number; bestMove: string }>();
  
  get(fen: string) {
    return this.cache.get(fen);
  }
  
  set(fen: string, score: number, bestMove: string) {
    this.cache.set(fen, { score, bestMove });
  }
  
  size() {
    return this.cache.size;
  }
}

/**
 * Get piece value for material heuristic
 */
function getPieceValue(piece: string): number {
  const values: Record<string, number> = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
  };
  return values[piece.toLowerCase()] || 0;
}

/**
 * Analyze game with tiered approach:
 * - Always analyze player moves
 * - Skip opponent moves if time budget exceeded
 * - Cache evaluations within request
 * - Use /evaluate endpoint for fast evals
 */
export async function analyzeGameWithStockfish(
  pgn: string,
  depth: number = 14,
  maxPly: number = 40,
  env: Env
): Promise<MistakeEvent[]> {
  const requestId = crypto.randomUUID();
  const t = timed(requestId);
  const chess = new Chess();
  
  try {
    chess.loadPgn(pgn);
    t.log('pgn_load');
  } catch (error) {
    console.error('[GameAnalysis] Invalid PGN:', error);
    return [];
  }
  
  const moves = chess.history({ verbose: true });
  t.log('get_moves', { moveCount: moves.length });
  
  const mistakes: MistakeEvent[] = [];
  const evalCache = new EvalCache();
  
  // Determine player color (assume last move is player)
  const playerColor = moves.length > 0 ? moves[moves.length - 1].color : 'w';
  
  // Reset to analyze from start
  chess.reset();
  
  const stockfish = new StockfishEngine(env);
  await stockfish.init();
  t.log('stockfish_init');
  
  const analysisStart = Date.now();
  const timeBudget = 5000; // 5 seconds max (conservative for 8s Worker limit)
  
  // Analyze up to maxPly half-moves
  const plysToAnalyze = Math.min(moves.length, maxPly);
  t.log('analysis_start', { plysToAnalyze, maxPly });
  
  for (let i = 0; i < plysToAnalyze; i++) {
    // Check time budget (use 70% threshold for early exit)
    if (Date.now() - analysisStart > timeBudget * 0.7) {
      console.warn(`[GameAnalysis] Time budget exceeded at ply ${i}/${plysToAnalyze}`);
      t.log('time_budget_exceeded', { plyIndex: i, plysToAnalyze });
      break;
    }
    
    const move = moves[i];
    const fenBefore = chess.fen();
    
    // Tiered analysis: always analyze player moves, skip opponent if time tight
    const isPlayerMove = move.color === playerColor;
    const shouldAnalyze = isPlayerMove || (Date.now() - analysisStart < timeBudget * 0.5);
    
    if (!shouldAnalyze) {
      chess.move(move);
      continue;
    }
    
    const plyStart = Date.now();
    
    // Use new /evaluate endpoint for fast evaluation
    let evalBefore = evalCache.get(fenBefore);
    if (!evalBefore) {
      try {
        // Use evaluatePosition instead of computeMove
        const result = await stockfish.evaluatePosition(fenBefore, 300, 12);
        const evalMs = Date.now() - plyStart;
        
        if (!result.success) {
          console.error('[GameAnalysis] Stockfish eval failed:', result.error);
          t.log('stockfish_eval_error', { plyIndex: i, error: result.error });
          chess.move(move);
          continue;
        }
        
        evalBefore = {
          score: result.evaluation || 0,
          bestMove: result.bestMove || '',
        };
        
        t.log('stockfish_eval', { 
          plyIndex: i, 
          evalMs, 
          engineMs: result.engineMs,
          evaluation: result.evaluation,
          depth: result.depth
        });
        
        evalCache.set(fenBefore, result.evaluation || 0, result.bestMove || '');
      } catch (error) {
        console.error('[GameAnalysis] Stockfish eval failed:', error);
        t.log('stockfish_eval_exception', { plyIndex: i, error: String(error) });
        chess.move(move);
        continue;
      }
    }
    
    // Make the move
    chess.move(move);
    const fenAfter = chess.fen();
    
    // OPTIMIZATION: Check if the move played matches the best move
    // If not, it's likely a mistake - estimate delta without second eval
    const playedFromTo = move.from + move.to;
    const isBestMove = evalBefore.bestMove.startsWith(playedFromTo);
    
    // For non-best moves, estimate delta based on material/position
    // (This is less accurate but much faster)
    let delta = 0;
    if (!isBestMove) {
      // Simple heuristic: assume deviation from best move = mistake
      // For player moves, treat as potential blunder
      delta = -100; // Assume inaccuracy level
      
      // Check for obvious material loss
      if (move.captured) {
        const capturedValue = getPieceValue(move.captured);
        const attackerValue = getPieceValue(move.piece);
        if (capturedValue < attackerValue) {
          delta = -200; // Likely a mistake
        }
      }
    }
    
    const plyMs = Date.now() - plyStart;
    t.log('ply_complete', { plyIndex: i, plyMs, delta, isBestMove });
    
    // Only create mistake event if delta is significant
    if (isPlayerMove && delta <= -50) {
      const severity = delta <= -300 ? 'blunder' 
        : delta <= -150 ? 'mistake' 
        : 'inaccuracy';
      
      // Detect concepts (simplified - real version would be more sophisticated)
      const concepts = detectConcepts(fenBefore, move, delta);
      
      // Determine game phase
      const phase = determinePhase(i, moves.length);
      
      mistakes.push({
        moveNumber: Math.floor(i / 2) + 1,
        side: move.color === 'w' ? 'white' : 'black',
        moveUCI: move.from + move.to + (move.promotion || ''),
        moveSAN: move.san,
        fen: fenBefore,
        evalBefore: evalBefore.score,
        evalAfter: evalBefore.score + delta, // Estimated after eval
        delta,
        severity,
        concepts,
        phase,
        moveType: move.captured ? 'capture' : move.promotion ? 'promotion' : 'normal',
      });
    }
  }
  
  console.log(`[GameAnalysis] Analyzed ${plysToAnalyze} plys, found ${mistakes.length} mistakes, cached ${evalCache.size()} evals`);
  
  return mistakes;
}

/**
 * Detect chess concepts from move characteristics
 * (Simplified version - production would use more sophisticated heuristics)
 */
function detectConcepts(fen: string, move: any, delta: number): string[] {
  const concepts: string[] = [];
  
  // Hanging pieces (large material loss)
  if (delta <= -300 && move.captured) {
    concepts.push('hanging-pieces');
  }
  
  // Undefended pieces
  if (delta <= -200 && !move.captured) {
    concepts.push('piece-safety');
  }
  
  // Tactical oversight
  if (delta <= -150) {
    concepts.push('tactical-awareness');
  }
  
  // Pawn structure issues
  if (move.piece === 'p' && delta <= -100) {
    concepts.push('pawn-structure');
  }
  
  // King safety
  if (fen.includes('k') && delta <= -200) {
    concepts.push('king-safety');
  }
  
  // Default: general mistake
  if (concepts.length === 0) {
    concepts.push('calculation');
  }
  
  return concepts;
}

/**
 * Determine game phase
 */
function determinePhase(plyIndex: number, totalPlys: number): 'opening' | 'middlegame' | 'endgame' {
  if (plyIndex < 16) return 'opening';
  if (plyIndex / totalPlys > 0.7) return 'endgame';
  return 'middlegame';
}
