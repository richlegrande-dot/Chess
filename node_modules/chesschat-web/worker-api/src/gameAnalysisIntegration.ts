/**
 * Game Analysis Integration for Architecture Change #3
 * 
 * This module handles asynchronous game analysis by calling the Render Stockfish
 * /analyze-game endpoint and storing results in the learning_events table.
 */

import type { PrismaClient } from '@prisma/client/edge';

interface Env {
  STOCKFISH_SERVER_URL: string;
  STOCKFISH_API_KEY: string;
  STOCKFISH_GAME_ANALYSIS_ENABLED?: string;
  DATABASE_URL: string;
}

interface AnalyzeGameRequest {
  pgn: string;
  depth?: number;
  samplingStrategy?: 'smart' | 'all';
  playerColor?: 'white' | 'black';
}

interface KeyMoment {
  ply: number;
  fen: string;
  move: string;
  fenAfterMove: string;
  evalCp: number;
  evalSwing: number;
  classification: 'blunder' | 'mistake' | 'brilliant' | 'good';
  bestMove: string;
  depth: number;
  mate?: number | null;
}

interface AnalyzeGameResponse {
  success: boolean;
  gameId: string;
  playerColor: string;
  keyMoments: KeyMoment[];
  statistics: {
    totalMoves: number;
    playerMoves: number;
    positionsAnalyzed: number;
    blunders: number;
    mistakes: number;
    brilliant: number;
    accuracy: number;
  };
  depth: number;
  samplingStrategy: string;
  computeTimeMs: number;
  timestamp: string;
  requestId: string;
  error?: string;
  errorCode?: string;
}

/**
 * Call Render Stockfish /analyze-game endpoint
 */
export async function analyzeGameWithRender(
  pgn: string,
  playerColor: 'white' | 'black',
  env: Env,
  requestId: string
): Promise<AnalyzeGameResponse> {
  const depth = 14; // Standard depth for game analysis
  const samplingStrategy = 'smart'; // First 4, last 4, every 6th ply
  
  console.log(`[GameAnalysis] Calling Render /analyze-game: requestId=${requestId} depth=${depth}`);
  
  try {
    const response = await fetch(`${env.STOCKFISH_SERVER_URL}/analyze-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.STOCKFISH_API_KEY}`,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        pgn,
        depth,
        samplingStrategy,
        playerColor,
      } as AnalyzeGameRequest),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Render /analyze-game failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json() as AnalyzeGameResponse;
    
    console.log(`[GameAnalysis] Analysis complete: keyMoments=${result.keyMoments.length} computeTimeMs=${result.computeTimeMs}`);
    
    return result;
    
  } catch (error: any) {
    console.error(`[GameAnalysis] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Store game analysis results in learning_events table
 */
export async function storeGameAnalysis(
  gameId: string,
  userId: string,
  pgn: string,
  analysis: AnalyzeGameResponse,
  prisma: any
): Promise<void> {
  console.log(`[GameAnalysis] Storing results: gameId=${gameId} keyMoments=${analysis.keyMoments.length}`);
  
  try {
    // Create learning events for each key moment
    const events = analysis.keyMoments.map(moment => ({
      game_id: gameId,
      player_id: userId,
      event_type: 'mistake', // Type based on classification
      ply_number: moment.ply,
      position_fen: moment.fen,
      player_move: moment.move,
      engine_suggestion: moment.bestMove,
      eval_before_cp: moment.evalCp + moment.evalSwing,
      eval_after_cp: moment.evalCp,
      eval_delta_cp: -moment.evalSwing, // Negative because it's a mistake
      mistake_severity: moment.classification,
      concept_keys: [], // Will be enriched by concept detection later
      phase: classifyGamePhase(moment.ply),
      created_at: new Date().toISOString(),
    }));
    
    // Batch insert events
    if (events.length > 0) {
      await prisma.learning_events.createMany({
        data: events,
        skipDuplicates: true,
      });
      
      console.log(`[GameAnalysis] Stored ${events.length} learning events for game ${gameId}`);
    } else {
      console.log(`[GameAnalysis] No significant moments to store for game ${gameId}`);
    }
    
    // Store game summary
    await prisma.games.upsert({
      where: { id: gameId },
      update: {
        analyzed: true,
        analysis_timestamp: new Date().toISOString(),
        accuracy: analysis.statistics.accuracy,
        blunders: analysis.statistics.blunders,
        mistakes: analysis.statistics.mistakes,
        brilliant_moves: analysis.statistics.brilliant,
      },
      create: {
        id: gameId,
        player_id: userId,
        pgn,
        analyzed: true,
        analysis_timestamp: new Date().toISOString(),
        accuracy: analysis.statistics.accuracy,
        blunders: analysis.statistics.blunders,
        mistakes: analysis.statistics.mistakes,
        brilliant_moves: analysis.statistics.brilliant,
        created_at: new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error(`[GameAnalysis] Storage error: ${error.message}`);
    throw error;
  }
}

/**
 * Classify game phase based on ply number
 */
function classifyGamePhase(ply: number): string {
  if (ply <= 20) return 'opening';
  if (ply <= 40) return 'middlegame';
  return 'endgame';
}

/**
 * Async game analysis pipeline (for use with ctx.waitUntil)
 */
export async function analyzeAndStoreGame(
  gameId: string,
  userId: string,
  pgn: string,
  playerColor: 'white' | 'black',
  env: Env,
  prisma: any,
  requestId: string
): Promise<void> {
  try {
    console.log(`[GameAnalysis] Starting async analysis: gameId=${gameId} userId=${userId}`);
    
    // Call Render /analyze-game endpoint
    const analysis = await analyzeGameWithRender(pgn, playerColor, env, requestId);
    
    // Store results in database
    await storeGameAnalysis(gameId, userId, pgn, analysis, prisma);
    
    console.log(`[GameAnalysis] Pipeline complete: gameId=${gameId}`);
    
  } catch (error: any) {
    console.error(`[GameAnalysis] Pipeline error for game ${gameId}: ${error.message}`);
    // Don't throw - this is async background work
  }
}
