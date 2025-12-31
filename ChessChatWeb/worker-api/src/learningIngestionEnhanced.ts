/**
 * Enhanced Learning Ingestion V3.1
 * 
 * Improvements:
 * - Smart position sampling instead of fixed N-ply
 * - Stockfish result caching
 * - Adaptive analysis tiers
 * - Detailed instrumentation
 * - Guardrails for DB writes and Stockfish calls
 */

import type { PrismaClient } from '@prisma/client/edge';
import type { MistakeEvent } from './learningCore';
import type { Env } from './featureFlags';
import {
  updateMastery,
  calculateDueDate,
  loadConceptTaxonomy,
  hashString
} from './learningCore';
import { selectPositions, type SamplingResult } from './smartSampling';
import { selectAnalysisTier, calculateDynamicPositionLimit, type TierSelectionInput } from './analysisTiers';
import { getCachedAnalysis, setCachedAnalysis } from './stockfishCache';
import { analyzePositionWithStockfish } from './stockfish';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedIngestionResult {
  conceptsUpdated: string[];
  summary: {
    [conceptId: string]: {
      mastery: number;
      delta: number;
      mistakeCount: number;
    };
  };
  nextDueConcepts: string[];
  instrumentation: IngestionInstrumentation;
}

export interface IngestionInstrumentation {
  candidatesSelected: number;
  stockfishCallsMade: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  tierSelected: string;
  maxDepth: number;
  positionsAnalyzed: number;
  durationMs: number;
  eventResult: 'success' | 'partial' | 'timeout' | 'error';
  errorMessage?: string;
}

export interface EnhancedIngestionConfig {
  smartSamplingEnabled: boolean;
  cacheEnabled: boolean;
  maxPositionsPerGame: number;
  maxDbWrites: number;
  maxStockfishCalls: number;
  stockfishDepth: number;
  timeoutMs: number;
  stockfishLatencyMs?: number;
}

// ============================================================================
// ENHANCED GAME INGESTION
// ============================================================================

/**
 * Ingest game with smart sampling, caching, and adaptive analysis
 */
export async function ingestGameEnhanced(
  prisma: any,
  env: Env,
  userId: string,
  gameId: string,
  pgn: string,
  config: EnhancedIngestionConfig
): Promise<EnhancedIngestionResult> {
  const startTime = Date.now();
  const instrumentation: IngestionInstrumentation = {
    candidatesSelected: 0,
    stockfishCallsMade: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    tierSelected: 'A',
    maxDepth: config.stockfishDepth,
    positionsAnalyzed: 0,
    durationMs: 0,
    eventResult: 'success'
  };
  
  try {
    // STEP 1: Smart position sampling
    const samplingResult: SamplingResult = selectPositions(
      pgn,
      config.maxPositionsPerGame,
      config.smartSamplingEnabled
    );
    
    instrumentation.candidatesSelected = samplingResult.candidates.length;
    
    if (samplingResult.candidates.length === 0) {
      instrumentation.eventResult = 'partial';
      instrumentation.errorMessage = 'No positions selected for analysis';
      instrumentation.durationMs = Date.now() - startTime;
      
      // Log event but return empty result
      await logIngestionEvent(prisma, userId, gameId, instrumentation, config);
      
      return {
        conceptsUpdated: [],
        summary: {},
        nextDueConcepts: [],
        instrumentation
      };
    }
    
    // STEP 2: Select analysis tier
    const remainingBudgetMs = config.timeoutMs - (Date.now() - startTime);
    const tierInput: TierSelectionInput = {
      totalMoves: samplingResult.totalMoves,
      stockfishLatencyMs: config.stockfishLatencyMs,
      remainingBudgetMs,
      userPriority: 'normal',
      smartSamplingEnabled: config.smartSamplingEnabled
    };
    
    const tierSelection = selectAnalysisTier(tierInput);
    instrumentation.tierSelected = tierSelection.tier.name;
    instrumentation.maxDepth = tierSelection.tier.depth;
    
    // Adjust position count if tier recommends fewer
    const positionsToAnalyze = Math.min(
      samplingResult.candidates.length,
      tierSelection.adjustedPositions,
      config.maxStockfishCalls
    );
    
    const selectedCandidates = samplingResult.candidates.slice(0, positionsToAnalyze);
    
    // STEP 3: Analyze positions with caching
    const mistakes: MistakeEvent[] = [];
    let stockfishCalls = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    
    for (const candidate of selectedCandidates) {
      // Check timeout
      if (Date.now() - startTime > config.timeoutMs * 0.9) {
        instrumentation.eventResult = 'partial';
        instrumentation.errorMessage = 'Timeout during analysis';
        break;
      }
      
      // Check cache first
      let analysis = null;
      
      if (config.cacheEnabled) {
        analysis = await getCachedAnalysis(
          prisma,
          candidate.fen,
          tierSelection.tier.depth,
          undefined
        );
        
        if (analysis) {
          cacheHits++;
        } else {
          cacheMisses++;
        }
      }
      
      // If not cached, call Stockfish
      if (!analysis) {
        // Check call limit
        if (stockfishCalls >= config.maxStockfishCalls) {
          instrumentation.eventResult = 'partial';
          instrumentation.errorMessage = 'Reached Stockfish call limit';
          break;
        }
        
        try {
          const stockfishResult = await analyzePositionWithStockfish(
            env,
            candidate.fen,
            tierSelection.tier.depth
          );
          
          analysis = {
            evalCp: stockfishResult.evalCp,
            mate: stockfishResult.mate,
            bestMove: stockfishResult.bestMove,
            pv: stockfishResult.pv,
            nodes: stockfishResult.nodes ? BigInt(stockfishResult.nodes) : null,
            fromCache: false
          };
          
          stockfishCalls++;
          
          // Cache the result
          if (config.cacheEnabled) {
            await setCachedAnalysis(
              prisma,
              candidate.fen,
              tierSelection.tier.depth,
              undefined,
              analysis,
              168 // 7 days TTL
            );
          }
        } catch (error) {
          console.error('[Ingestion] Stockfish error:', error);
          instrumentation.eventResult = 'partial';
          instrumentation.errorMessage = `Stockfish error: ${error}`;
          continue;
        }
      }
      
      // Detect mistakes from analysis
      // (This is simplified - in production you'd compare with previous position eval)
      const evalDelta = Math.abs(analysis.evalCp || 0);
      
      if (evalDelta > 50) { // Simplified mistake detection
        const severity = evalDelta > 300 ? 'blunder' : evalDelta > 150 ? 'mistake' : 'inaccuracy';
        
        // Extract concepts from position (simplified)
        const concepts = extractConceptsFromPosition(candidate.reason);
        
        mistakes.push({
          moveNumber: candidate.moveNumber,
          side: candidate.moveNumber % 2 === 1 ? 'white' : 'black',
          moveUCI: candidate.moveUCI,
          moveSAN: candidate.moveSAN,
          fen: candidate.fen,
          evalBefore: 0, // Would need previous position
          evalAfter: analysis.evalCp || 0,
          delta: evalDelta,
          severity,
          concepts,
          phase: candidate.phase,
          moveType: candidate.reason.join(',')
        });
      }
      
      instrumentation.positionsAnalyzed++;
    }
    
    // Update instrumentation
    instrumentation.stockfishCallsMade = stockfishCalls;
    instrumentation.cacheHits = cacheHits;
    instrumentation.cacheMisses = cacheMisses;
    instrumentation.cacheHitRate = (cacheHits + cacheMisses) > 0
      ? cacheHits / (cacheHits + cacheMisses)
      : 0;
    
    // STEP 4: Update concept states (with DB write limit)
    const conceptCounts = aggregateMistakesByContent(mistakes);
    const summary: any = {};
    let dbWrites = 0;
    
    for (const [conceptId, counts] of Object.entries(conceptCounts)) {
      // Check DB write limit
      if (dbWrites >= config.maxDbWrites) {
        instrumentation.eventResult = 'partial';
        instrumentation.errorMessage = 'Reached DB write limit';
        break;
      }
      
      try {
        const result = await updateConceptState(
          prisma,
          userId,
          gameId,
          conceptId,
          counts
        );
        
        summary[conceptId] = result;
        dbWrites += 2; // Read + write
      } catch (error) {
        console.error(`[Ingestion] Error updating concept ${conceptId}:`, error);
        instrumentation.eventResult = 'partial';
      }
    }
    
    // Get next due concepts
    const dueStates = await prisma.userConceptState.findMany({
      where: {
        userId,
        spacedRepDueAt: { lte: new Date() }
      },
      select: { conceptId: true },
      take: 5,
      orderBy: { spacedRepDueAt: 'asc' }
    });
    
    instrumentation.durationMs = Date.now() - startTime;
    
    // Log ingestion event
    await logIngestionEvent(prisma, userId, gameId, instrumentation, config);
    
    return {
      conceptsUpdated: Object.keys(conceptCounts),
      summary,
      nextDueConcepts: dueStates.map((s: any) => s.conceptId),
      instrumentation
    };
    
  } catch (error) {
    instrumentation.eventResult = 'error';
    instrumentation.errorMessage = String(error);
    instrumentation.durationMs = Date.now() - startTime;
    
    // Log error event
    await logIngestionEvent(prisma, userId, gameId, instrumentation, config);
    
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Aggregate mistakes by concept
 */
function aggregateMistakesByContent(mistakes: MistakeEvent[]): {
  [conceptId: string]: { mistakes: number; total: number };
} {
  const counts: { [conceptId: string]: { mistakes: number; total: number } } = {};
  
  for (const mistake of mistakes) {
    for (const conceptId of mistake.concepts) {
      if (!counts[conceptId]) {
        counts[conceptId] = { mistakes: 1, total: 1 };
      } else {
        counts[conceptId].mistakes += 1;
        counts[conceptId].total += 1;
      }
    }
  }
  
  return counts;
}

/**
 * Extract chess concepts from position reasons
 */
function extractConceptsFromPosition(reasons: string[]): string[] {
  const conceptMap: { [key: string]: string } = {
    'capture': 'material-balance',
    'check': 'king-safety',
    'checkmate': 'king-safety',
    'promotion': 'endgame-technique',
    'castling': 'king-safety',
    'material-swing': 'material-balance',
    'king-exposed': 'king-safety',
    'endgame-critical': 'endgame-technique',
    'opening': 'opening-principles'
  };
  
  const concepts = new Set<string>();
  
  for (const reason of reasons) {
    const concept = conceptMap[reason];
    if (concept) {
      concepts.add(concept);
    }
  }
  
  // Always include piece-activity as fallback
  if (concepts.size === 0) {
    concepts.add('piece-activity');
  }
  
  return Array.from(concepts);
}

/**
 * Update individual concept state
 */
async function updateConceptState(
  prisma: any,
  userId: string,
  gameId: string,
  conceptId: string,
  counts: { mistakes: number; total: number }
): Promise<{ mastery: number; delta: number; mistakeCount: number }> {
  const state = await prisma.userConceptState.findUnique({
    where: {
      userId_conceptId: {
        userId,
        conceptId
      }
    }
  });
  
  if (!state) {
    // Create new state
    const initialMastery = 0.5;
    
    await prisma.userConceptState.create({
      data: {
        userId,
        conceptId,
        mastery: initialMastery,
        confidence: 0.05,
        mistakeRateEMA: counts.mistakes,
        successRateEMA: 0,
        spacedRepDueAt: calculateDueDate(initialMastery),
        lastSeenAt: new Date(),
        evidenceRefs: JSON.stringify([{
          gameId,
          mistakes: counts.mistakes,
          timestamp: new Date().toISOString()
        }])
      }
    });
    
    return {
      mastery: initialMastery,
      delta: 0,
      mistakeCount: counts.mistakes
    };
  } else {
    // Update existing state
    const outcome = counts.mistakes > 0 ? 'mistake' : 'success';
    const { mastery, confidence } = updateMastery(
      state.mastery,
      state.confidence,
      outcome
    );
    
    const alpha = 0.2;
    const newMistakeEMA = state.mistakeRateEMA * (1 - alpha) + counts.mistakes * alpha;
    
    const evidence = JSON.parse(state.evidenceRefs || '[]');
    evidence.push({
      gameId,
      mistakes: counts.mistakes,
      timestamp: new Date().toISOString()
    });
    const newEvidence = evidence.slice(-10);
    
    await prisma.userConceptState.update({
      where: { id: state.id },
      data: {
        mastery,
        confidence,
        mistakeRateEMA: newMistakeEMA,
        spacedRepDueAt: calculateDueDate(mastery, new Date()),
        lastSeenAt: new Date(),
        evidenceRefs: JSON.stringify(newEvidence),
        updatedAt: new Date()
      }
    });
    
    return {
      mastery,
      delta: mastery - state.mastery,
      mistakeCount: counts.mistakes
    };
  }
}

/**
 * Log ingestion event for instrumentation
 */
async function logIngestionEvent(
  prisma: any,
  userId: string,
  gameId: string,
  instrumentation: IngestionInstrumentation,
  config: EnhancedIngestionConfig
): Promise<void> {
  try {
    await prisma.ingestionEvent.create({
      data: {
        userId,
        gameId,
        durationMs: instrumentation.durationMs,
        candidatesSelected: instrumentation.candidatesSelected,
        stockfishCallsMade: instrumentation.stockfishCallsMade,
        cacheHitRate: instrumentation.cacheHitRate,
        tierSelected: instrumentation.tierSelected,
        maxDepth: instrumentation.maxDepth,
        conceptsUpdated: Object.keys(instrumentation).length,
        positionsAnalyzed: instrumentation.positionsAnalyzed,
        eventResult: instrumentation.eventResult,
        errorMessage: instrumentation.errorMessage || null,
        smartSamplingEnabled: config.smartSamplingEnabled,
        cacheEnabled: config.cacheEnabled
      }
    });
  } catch (error) {
    console.error('[Ingestion] Failed to log event:', error);
  }
}

/**
 * Stub for Stockfish position analysis (to be implemented)
 */
async function analyzePositionWithStockfish(
  env: Env,
  fen: string,
  depth: number
): Promise<{
  evalCp: number | null;
  mate: number | null;
  bestMove: string | null;
  pv: string | null;
  nodes: number | null;
}> {
  // This would call your existing Stockfish service
  // Placeholder implementation
  return {
    evalCp: 0,
    mate: null,
    bestMove: 'e2e4',
    pv: 'e2e4 e7e5',
    nodes: 10000
  };
}
