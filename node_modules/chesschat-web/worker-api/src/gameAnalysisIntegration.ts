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
 * Store game analysis results and update concept states
 */
export async function storeGameAnalysis(
  gameId: string,
  userId: string,
  pgn: string,
  analysis: AnalyzeGameResponse,
  prisma: any
): Promise<number> {
  console.log(`[GameAnalysis] Storing results: gameId=${gameId} keyMoments=${analysis.keyMoments.length}`);
  
  let conceptsUpdated = 0;
  
  try {
    // Map key moments to concept IDs
    const conceptMap: { [concept: string]: { mistakes: number; totalOccurrences: number } } = {};
    
    for (const moment of analysis.keyMoments) {
      // Extract concepts from the moment's characteristics
      const concepts = extractConceptsFromMoment(moment);
      
      for (const concept of concepts) {
        if (!conceptMap[concept]) {
          conceptMap[concept] = { mistakes: 0, totalOccurrences: 0 };
        }
        conceptMap[concept].totalOccurrences += 1;
        if (moment.classification === 'blunder' || moment.classification === 'mistake') {
          conceptMap[concept].mistakes += 1;
        }
      }
    }
    
    // Update UserConceptState for each concept
    for (const [conceptId, stats] of Object.entries(conceptMap)) {
      try {
        const existing = await prisma.userConceptState.findUnique({
          where: {
            userId_conceptId: {
              userId,
              conceptId,
            }
          }
        });
        
        if (existing) {
          // Update existing concept
          const outcome = stats.mistakes > 0 ? 'mistake' : 'success';
          const masteryDelta = outcome === 'mistake' ? -0.05 : +0.02;
          const newMastery = Math.max(0, Math.min(1.0, existing.mastery + masteryDelta));
          const newConfidence = Math.min(1.0, existing.confidence + 0.01);
          
          // Update EMA for mistake rate
          const alpha = 0.2;
          const newMistakeEMA = existing.mistakeRateEMA * (1 - alpha) + stats.mistakes * alpha;
          const newSuccessEMA = existing.successRateEMA * (1 - alpha) + (stats.totalOccurrences - stats.mistakes) * alpha;
          
          // Calculate new due date (spaced repetition)
          const intervalDays = Math.floor(newMastery * 30); // 0-30 days based on mastery
          const newDueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
          
          // Append evidence
          const evidence = JSON.parse(existing.evidenceRefs || '[]');
          evidence.push({
            gameId,
            mistakes: stats.mistakes,
            total: stats.totalOccurrences,
            timestamp: new Date().toISOString()
          });
          const newEvidence = evidence.slice(-10); // Keep last 10
          
          await prisma.userConceptState.update({
            where: { id: existing.id },
            data: {
              mastery: newMastery,
              confidence: newConfidence,
              mistakeRateEMA: newMistakeEMA,
              successRateEMA: newSuccessEMA,
              spacedRepDueAt: newDueAt,
              lastSeenAt: new Date(),
              evidenceRefs: JSON.stringify(newEvidence),
              updatedAt: new Date(),
            }
          });
          
          conceptsUpdated++;
          
        } else {
          // Create new concept state
          const initialMastery = stats.mistakes > 0 ? 0.4 : 0.6;
          const initialDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          
          await prisma.userConceptState.create({
            data: {
              userId,
              conceptId,
              mastery: initialMastery,
              confidence: 0.1,
              mistakeRateEMA: stats.mistakes,
              successRateEMA: stats.totalOccurrences - stats.mistakes,
              spacedRepDueAt: initialDueDate,
              lastSeenAt: new Date(),
              evidenceRefs: JSON.stringify([{
                gameId,
                mistakes: stats.mistakes,
                total: stats.totalOccurrences,
                timestamp: new Date().toISOString()
              }]),
            }
          });
          
          conceptsUpdated++;
        }
        
        // Log learning event
        await prisma.learningEvent.create({
          data: {
            userId,
            eventType: 'CONCEPT_UPDATED',
            payload: {
              conceptId,
              gameId,
              mistakes: stats.mistakes,
              total: stats.totalOccurrences,
              action: existing ? 'updated' : 'created',
            }
          }
        });
        
      } catch (conceptError: any) {
        console.error(`[GameAnalysis] Error updating concept ${conceptId}:`, conceptError.message);
        // Continue with other concepts
      }
    }
    
    // Create a summary learning event for the game
    await prisma.learningEvent.create({
      data: {
        userId,
        eventType: 'GAME_INGESTED',
        payload: {
          gameId,
          conceptsUpdated,
          keyMoments: analysis.keyMoments.length,
          blunders: analysis.statistics.blunders,
          mistakes: analysis.statistics.mistakes,
          accuracy: analysis.statistics.accuracy,
        }
      }
    });
    
    console.log(`[GameAnalysis] Stored analysis for game ${gameId}, updated ${conceptsUpdated} concepts`);
    return conceptsUpdated;
    
  } catch (error: any) {
    console.error(`[GameAnalysis] Storage error: ${error.message}`);
    
    // Log failure event
    try {
      await prisma.learningEvent.create({
        data: {
          userId,
          eventType: 'GAME_INGESTED',
          payload: {
            gameId,
            error: error.message,
            result: 'failed',
          }
        }
      });
    } catch (e) {
      console.error('[GameAnalysis] Could not log failure event');
    }
    
    throw error;
  }
}

/**
 * Extract concept IDs from a key moment
 * This implements a simple rule-based concept detector
 */
function extractConceptsFromMoment(moment: KeyMoment): string[] {
  const concepts: string[] = [];
  
  // Based on classification
  if (moment.classification === 'blunder') {
    concepts.push('hanging_pieces');
    concepts.push('calculation_depth');
  }
  if (moment.classification === 'mistake') {
    concepts.push('positional_awareness');
  }
  
  // Based on evaluation swing (tactical themes)
  if (Math.abs(moment.evalSwing) > 300) {
    concepts.push('tactical_vision');
    if (moment.evalSwing < 0) {
      concepts.push('hanging_pieces');
    }
  }
  
  // Based on game phase
  const phase = classifyGamePhase(moment.ply);
  if (phase === 'opening') {
    concepts.push('opening_principles');
  } else if (phase === 'middlegame') {
    concepts.push('tactical_awareness');
    concepts.push('piece_coordination');
  } else {
    concepts.push('endgame_technique');
  }
  
  // Deduplicate
  return Array.from(new Set(concepts));
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
 * Returns conceptsUpdated count
 */
export async function analyzeAndStoreGame(
  gameId: string,
  userId: string,
  pgn: string,
  playerColor: 'white' | 'black',
  env: Env,
  prisma: any,
  requestId: string
): Promise<number> {
  try {
    console.log(`[GameAnalysis] Starting async analysis: gameId=${gameId} userId=${userId}`);
    
    // Call Render /analyze-game endpoint
    const analysis = await analyzeGameWithRender(pgn, playerColor, env, requestId);
    
    // Store results and update concepts
    const conceptsUpdated = await storeGameAnalysis(gameId, userId, pgn, analysis, prisma);
    
    console.log(`[GameAnalysis] Pipeline complete: gameId=${gameId}, conceptsUpdated=${conceptsUpdated}`);
    
    return conceptsUpdated;
    
  } catch (error: any) {
    console.error(`[GameAnalysis] Pipeline error for game ${gameId}: ${error.message}`);
    
    // Log failure event
    try {
      await prisma.learningEvent.create({
        data: {
          userId,
          eventType: 'GAME_INGESTED',
          payload: {
            gameId,
            error: error.message,
            result: 'failed',
          }
        }
      });
    } catch (e) {
      console.error('[GameAnalysis] Could not log failure event');
    }
    
    return 0; // Failed, no concepts updated
  }
}
