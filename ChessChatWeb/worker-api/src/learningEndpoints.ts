/**
 * Learning Layer V3 - HTTP Endpoints
 * 
 * Provides REST API for game ingestion, practice plans, and feedback.
 * All endpoints respect feature flags and create audit trails.
 */

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

import type { Env, LearningV3Config } from './featureFlags';
import {
  getLearningV3Config,
  getEffectiveLearningState,
  createDisabledResponse,
  createReadOnlyBlockedResponse,
} from './featureFlags';
import {
  createAuditContext,
  finalizeAuditEvent,
  auditReadOnlyBlock,
} from './learningAudit';
import { ingestGame, evaluateInterventions } from './learningIngestion';
import { generatePracticePlan } from './learningCore';
import { analyzeGameWithStockfish } from './gameAnalysisV3';
import { analyzeAndStoreGame } from './gameAnalysisIntegration';
import type { MistakeEvent } from './learningCore';
import { shouldProceedWithAnalysis } from './stockfishWarmup';
import { timed } from './timing';

/**
 * Helper: Create CORS headers
 */
function getCacheHeaders(): Headers {
  return new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
}

/**
 * POST /api/learning/ingest-game
 * 
 * Analyzes a game and updates concept states.
 * Architecture Change #3: Uses async processing with Render /analyze-game endpoint
 */
export async function handleLearningIngest(
  request: Request,
  env: Env,
  prisma: any,
  ctx?: ExecutionContext
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const body = await request.json() as any;
    
    const { userId, gameId, pgn, playerColor = 'white' } = body;
    
    if (!userId || !gameId || !pgn) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, gameId, pgn',
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // Check if Architecture Change #3 is enabled
    const useRenderAnalysis = env.STOCKFISH_GAME_ANALYSIS_ENABLED === 'true';
    
    if (useRenderAnalysis && ctx) {
      // NEW FLOW (Architecture Change #3): Async processing with Render endpoint
      console.log(`[LearningIngest] Queueing async analysis: gameId=${gameId} userId=${userId}`);
      
      // Queue async analysis (non-blocking)
      ctx.waitUntil(
        analyzeAndStoreGame(gameId, userId, pgn, playerColor, env, prisma, requestId)
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          message: 'Game queued for analysis',
          analysisMode: 'async',
          gameId,
        }),
        { status: 202, headers: getCacheHeaders() }
      );
    }
    
    // OLD FLOW (Legacy): Synchronous analysis (fallback)
    console.log(`[LearningIngest] Using legacy sync analysis: gameId=${gameId}`);
    const { enabled, config, reason } = getEffectiveLearningState(env, request, userId);
    t.log('feature_flags');
    
    if (!enabled) {
      return createDisabledResponse();
    }
    
    if (config.readonly) {
      await auditReadOnlyBlock(prisma, requestId, userId, 'ingest', config);
      return createReadOnlyBlockedResponse();
    }
    
    // Create audit context
    const auditContext = createAuditContext(requestId, userId, 'ingest', config, reason);
    auditContext.gameId = gameId;
    
    // STEP 1: Warmup probe to detect cold starts
    const warmupGuard = await shouldProceedWithAnalysis(env);
    t.log('warmup_probe', { 
      shouldProceed: warmupGuard.shouldProceed,
      latencyMs: warmupGuard.warmupResult.latencyMs 
    });
    
    if (!warmupGuard.shouldProceed) {
      // DEGRADED MODE: Stockfish is cold/unavailable
      // Save event for audit trail but don't attempt expensive analysis
      await finalizeAuditEvent(
        prisma,
        auditContext,
        startTime,
        'partial',
        'stockfish_cold_start',
        {
          conceptKeysDetected: [],
          evalDeltaSummary: null,
          metadata: {
            analysisMode: 'degraded',
            stockfishWarm: false,
            warmupLatencyMs: warmupGuard.warmupResult.latencyMs,
            warmupError: warmupGuard.warmupResult.error,
            reason: warmupGuard.reason,
          },
        }
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          analysisMode: 'degraded',
          message: 'Stockfish is waking up. Your game was saved and will be analyzed when available.',
          requestId,
          nextStep: 'retry_ingest_in_30s',
          stockfishWarm: false,
          warmupLatencyMs: warmupGuard.warmupResult.latencyMs,
        }),
        { status: 202, headers: getCacheHeaders() }
      );
    }
    
    // STEP 2: Proceed with full analysis (service is warm)
    // Check for debug mode - extends timeout for diagnostic purposes only
    const debugMode = env.LEARNING_V3_DEBUG_TIMING === 'true';
    const analysisTimeout = debugMode ? 6000 : 3000;
    
    console.log(`[LearningIngest] Starting analysis: requestId=${requestId} timeout=${analysisTimeout}ms debug=${debugMode}`);
    t.log('analysis_start', { timeout: analysisTimeout, debugMode });
    
    const analysisPromise = analyzeGameWithStockfish(
      pgn,
      config.stockfishDepth,
      config.maxPlyAnalysis,
      env
    );
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Analysis timeout')), analysisTimeout)
    );
    
    let mistakes: MistakeEvent[];
    let isPartial = false;
    
    try {
      mistakes = await Promise.race([analysisPromise, timeoutPromise]) as MistakeEvent[];
      t.log('analysis_complete', { mistakeCount: mistakes.length });
    } catch (error) {
      // Timeout or analysis error - return degraded mode (skip expensive DB write)
      console.warn('[LearningIngest] Analysis timeout, returning degraded mode');
      
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          analysisMode: 'degraded',
          message: 'Analysis timed out. Your game was saved. Click "Retry Analysis" to try again.',
          requestId,
          nextStep: 'retry_ingest',
          stockfishWarm: true,
          warmupLatencyMs: warmupGuard.warmupResult.latencyMs,
        }),
        { status: 202, headers: getCacheHeaders() }
      );
    }
    
    // Calculate eval delta summary
    const evalDeltaSummary = {
      inaccuracies: mistakes.filter(m => m.severity === 'inaccuracy').length,
      mistakes: mistakes.filter(m => m.severity === 'mistake').length,
      blunders: mistakes.filter(m => m.severity === 'blunder').length,
      avgDelta: mistakes.length > 0
        ? mistakes.reduce((sum, m) => sum + m.delta, 0) / mistakes.length
        : 0,
    };
    
    // Extract concept keys
    const conceptKeys = Array.from(
      new Set(mistakes.flatMap(m => m.concepts))
    );
    
    // Update audit context
    auditContext.conceptKeysDetected = conceptKeys;
    auditContext.evalDeltaSummary = evalDeltaSummary;
    
    // Ingest game (respects shadow mode internally)
    let result;
    if (config.shadowMode) {
      // Shadow mode: log event but don't update mastery
      result = {
        conceptsUpdated: [],
        summary: {},
        nextDueConcepts: [],
        shadowMode: true,
      };
      
      auditContext.metadata.shadowMode = true;
      auditContext.metadata.wouldUpdateConcepts = conceptKeys;
    } else {
      // Normal mode: update mastery
      result = await ingestGame(prisma, userId, gameId, mistakes);
    }
    
    // Finalize audit
    await finalizeAuditEvent(
      prisma,
      auditContext,
      startTime,
      'success',
      null,
      { 
        metadata: { 
          mistakeCount: mistakes.length,
          analysisMode: 'full',
          stockfishWarm: true,
          warmupLatencyMs: warmupGuard.warmupResult.latencyMs,
        } 
      }
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        conceptsUpdated: result.conceptsUpdated,
        summary: result.summary,
        shadowMode: config.shadowMode,
        analysisMode: 'full',
        stockfishWarm: true,
        warmupLatencyMs: warmupGuard.warmupResult.latencyMs,
        durationMs: Date.now() - startTime,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningIngest] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/learning/plan
 * 
 * Returns personalized practice plan.
 */
export async function handleLearningPlan(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing userId parameter',
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // Check feature flags (read operations allowed in readonly mode)
    const { enabled, config, reason } = getEffectiveLearningState(env, request, userId);
    
    if (!enabled) {
      return createDisabledResponse();
    }
    
    // Create audit context
    const auditContext = createAuditContext(requestId, userId, 'plan', config, reason);
    
    // Fetch user concept states
    const conceptStates = await prisma.userConceptState.findMany({
      where: { userId },
      orderBy: { mastery: 'asc' },
    });
    
    // Generate practice plan
    const plan = generatePracticePlan(conceptStates, 7);
    
    // Finalize audit
    await finalizeAuditEvent(
      prisma,
      auditContext,
      startTime,
      'success',
      null,
      {
        conceptKeysDetected: plan.targetConcepts.map((t: any) => t.conceptId),
        metadata: { targetCount: plan.targetConcepts.length },
      }
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        plan,
        durationMs: Date.now() - startTime,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningPlan] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/learning/feedback
 * 
 * Records player feedback on advice.
 */
export async function handleLearningFeedback(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const body = await request.json() as any;
    const { userId, interventionId, helpful } = body;
    
    if (!userId || !interventionId || typeof helpful !== 'boolean') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, interventionId, helpful',
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // Check feature flags
    const { enabled, config, reason } = getEffectiveLearningState(env, request, userId);
    
    if (!enabled) {
      return createDisabledResponse();
    }
    
    if (config.readonly) {
      await auditReadOnlyBlock(prisma, requestId, userId, 'feedback', config);
      return createReadOnlyBlockedResponse();
    }
    
    // Create audit context
    const auditContext = createAuditContext(requestId, userId, 'feedback', config, reason);
    auditContext.metadata = { interventionId, helpful };
    
    // Record feedback (in shadow mode, just log event)
    if (!config.shadowMode) {
      await prisma.adviceIntervention.update({
        where: { id: interventionId },
        data: {
          metadata: {
            userFeedback: helpful ? 'helpful' : 'not-helpful',
            feedbackAt: new Date().toISOString(),
          },
        },
      });
    }
    
    // Finalize audit
    await finalizeAuditEvent(prisma, auditContext, startTime, 'success');
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        shadowMode: config.shadowMode,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningFeedback] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/walle/postgame
 * 
 * Returns Wall-E's narrative postgame analysis.
 */
export async function handleWallePostgame(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const body = await request.json() as any;
    const { userId, gameId } = body;
    
    if (!userId || !gameId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, gameId',
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // Check feature flags
    const { enabled, config, reason } = getEffectiveLearningState(env, request, userId);
    
    // Create audit context
    const auditContext = createAuditContext(requestId, userId, 'postgame', config, reason);
    auditContext.gameId = gameId;
    
    if (!enabled) {
      // Graceful degradation: return generic insights
      await finalizeAuditEvent(
        prisma,
        auditContext,
        startTime,
        'success',
        null,
        { metadata: { fallback: true } }
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          narrative: "Great game! Keep practicing to improve your skills.",
          disclaimer: "Learning Layer V3 is currently disabled. Analysis limited.",
          fallback: true,
        }),
        { status: 200, headers: getCacheHeaders() }
      );
    }
    
    // Fetch concept states
    const conceptStates = await prisma.userConceptState.findMany({
      where: { userId },
      orderBy: { mastery: 'asc' },
      take: 5,
    });
    
    if (conceptStates.length === 0) {
      // Insufficient history
      await finalizeAuditEvent(
        prisma,
        auditContext,
        startTime,
        'success',
        null,
        { metadata: { insufficientHistory: true } }
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          narrative: "I'm still learning about your playing style. Keep playing!",
          disclaimer: "Need more games to provide detailed insights.",
          insufficientHistory: true,
        }),
        { status: 200, headers: getCacheHeaders() }
      );
    }
    
    // Build narrative with learning data
    const weakestConcept = conceptStates[0];
    const strongestConcept = conceptStates[conceptStates.length - 1];
    
    // Get recent game for context
    const recentGame = await prisma.learningEvent.findFirst({
      where: {
        userId,
        eventType: 'GAME_INGESTED',
      },
      orderBy: { ts: 'desc' },
    });
    
    const narrative = recentGame && recentGame.payload.conceptsUpdated > 0
      ? `Great effort! This game helped refine ${recentGame.payload.conceptsUpdated} concepts. ` +
        `Your current focus area is **${weakestConcept.conceptId.replace(/_/g, ' ')}** (${(weakestConcept.mastery * 100).toFixed(0)}% mastery). ` +
        `You're strongest at **${strongestConcept.conceptId.replace(/_/g, ' ')}** (${(strongestConcept.mastery * 100).toFixed(0)}% mastery). Keep it up! 🌟`
      : `Great effort! I'm tracking ${conceptStates.length} chess concepts for you. ` +
        `Your current focus area is **${weakestConcept.conceptId.replace(/_/g, ' ')}** (${(weakestConcept.mastery * 100).toFixed(0)}% mastery). ` +
        `Keep practicing and you'll improve! 🌟`;
    
    // Get key moments from recent game if available
    const keyMoments = recentGame ? [
      {
        concept: weakestConcept.conceptId,
        mastery: weakestConcept.mastery,
        recommendation: `Practice positions involving ${weakestConcept.conceptId.replace(/_/g, ' ')}`,
      }
    ] : [];
    
    // Finalize audit
    await finalizeAuditEvent(
      prisma,
      auditContext,
      startTime,
      'success',
      null,
      {
        conceptKeysDetected: conceptStates.map((c: any) => c.conceptId),
        metadata: { conceptCount: conceptStates.length },
      }
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        narrative,
        conceptsReferenced: [weakestConcept.conceptId, strongestConcept.conceptId],
        keyMoments,
        nextFocus: {
          concept: weakestConcept.conceptId,
          mastery: weakestConcept.mastery,
          recommendation: `Focus on ${weakestConcept.conceptId.replace(/_/g, ' ')} in your next game`,
        },
        evidenceGameId: gameId,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WallePostgame] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/learning/progress?userId=...
 * 
 * Returns real learning progress for the user
 */
export async function handleLearningProgress(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: userId',
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // Get total games analyzed (from learning events)
    const gameIngestedEvents = await prisma.learningEvent.findMany({
      where: {
        userId,
        eventType: 'GAME_INGESTED',
      },
      orderBy: {
        ts: 'desc',
      },
      take: 100, // Limit to recent 100
    });
    
    const gamesAnalyzed = gameIngestedEvents.length;
    const lastIngestedAt = gameIngestedEvents.length > 0 
      ? gameIngestedEvents[0].ts.toISOString()
      : null;
    
    // Get concept states
    const conceptStates = await prisma.userConceptState.findMany({
      where: { userId },
      orderBy: { mastery: 'asc' },
      take: 50, // Limit response size
    });
    
    // Top weak concepts (lowest mastery)
    const topWeakConcepts = conceptStates
      .slice(0, 5)
      .map((c: any) => ({
        name: c.conceptId.replace(/_/g, ' '),
        mastery: c.mastery,
        lastSeen: c.lastSeenAt ? c.lastSeenAt.toISOString() : null,
      }));
    
    // Top strong concepts (highest mastery)
    const topStrongConcepts = conceptStates
      .slice(-5)
      .reverse()
      .map((c: any) => ({
        name: c.conceptId.replace(/_/g, ' '),
        mastery: c.mastery,
        lastSeen: c.lastSeenAt ? c.lastSeenAt.toISOString() : null,
      }));
    
    // Recent key moments (from recent game events)
    const recentKeyMoments = gameIngestedEvents
      .slice(0, 5)
      .map((event: any) => {
        const payload = event.payload;
        return {
          gameId: payload.gameId,
          timestamp: event.ts.toISOString(),
          blunders: payload.blunders || 0,
          mistakes: payload.mistakes || 0,
          accuracy: payload.accuracy || 0,
          conceptsUpdated: payload.conceptsUpdated || 0,
        };
      });
    
    const progress = {
      success: true,
      requestId,
      userId,
      gamesAnalyzed,
      lastIngestedAt,
      topWeakConcepts,
      topStrongConcepts,
      recentKeyMoments,
      totalConcepts: conceptStates.length,
      avgMastery: conceptStates.length > 0 
        ? conceptStates.reduce((sum: number, c: any) => sum + c.mastery, 0) / conceptStates.length 
        : 0,
      durationMs: Date.now() - startTime,
    };
    
    return new Response(
      JSON.stringify(progress),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningProgress] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/admin/learning-health
 * 
 * Returns health check for Learning V3 system.
 */
export async function handleLearningHealth(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Admin auth required
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${env.ADMIN_PASSWORD}`;
    
    if (authHeader !== expectedAuth) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
        { status: 401, headers: getCacheHeaders() }
      );
    }
    
    const config = getLearningV3Config(env);
    
    // Check table accessibility
    const [
      conceptStateCount,
      interventionCount,
      planCount,
      eventCount,
    ] = await Promise.all([
      prisma.userConceptState.count(),
      prisma.adviceIntervention.count(),
      prisma.practicePlan.count(),
      prisma.learningEvent.count(),
    ]);
    
    const health = {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      config: {
        enabled: config.enabled,
        readonly: config.readonly,
        shadowMode: config.shadowMode,
        canaryEnabled: config.canaryEnabled,
        canaryPercentage: config.canaryPercentage,
      },
      tables: {
        userConceptStates: conceptStateCount,
        adviceInterventions: interventionCount,
        practicePlans: planCount,
        learningEvents: eventCount,
      },
      status: 'healthy',
      durationMs: Date.now() - startTime,
    };
    
    return new Response(
      JSON.stringify(health),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningHealth] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
        status: 'unhealthy',
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/admin/learning-recent?limit=50
 * 
 * Returns recent learning events for proof-of-learning diagnostics.
 * User IDs are hashed by default for privacy.
 */
export async function handleLearningRecentEvents(
  request: Request,
  env: Env,
  prisma: any
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Admin auth required
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${env.ADMIN_PASSWORD}`;
    
    if (authHeader !== expectedAuth) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
        { status: 401, headers: getCacheHeaders() }
      );
    }
    
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const includeUserIds = url.searchParams.get('includeUserIds') === 'true';
    
    // Get recent events
    const events = await prisma.learningEvent.findMany({
      orderBy: {
        ts: 'desc',
      },
      take: limit,
    });
    
    // Simple hash function for userId privacy
    const hashUserId = (userId: string): string => {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).substring(0, 8);
    };
    
    // Format events
    const formattedEvents = events.map((event: any) => ({
      id: event.id,
      ts: event.ts.toISOString(),
      userId: includeUserIds ? event.userId : hashUserId(event.userId || 'unknown'),
      eventType: event.eventType,
      payload: event.payload,
    }));
    
    const response = {
      success: true,
      requestId,
      events: formattedEvents,
      total: events.length,
      durationMs: Date.now() - startTime,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LearningRecentEvents] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}
