// Coaching Mode Component - Enhanced with Production Safety

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { ChessGame } from '../lib/chess';
import { moveTracer } from '../lib/tracing';
import { persistentLogger } from '../utils/persistentLogger';
import { findBestMoveWithLearning, recordGameForLearning, getLearningStats } from '../lib/learningAI';
import { PostGameCoaching } from './PostGameCoaching';
import { PlayerProfile } from './PlayerProfile';
import { CapturedPieces, type CapturedPiecesData } from './CapturedPieces';
import { OpeningsModal } from './openings/OpeningsModal';
import { getCpuWorkerClient } from '../lib/cpu/cpuWorkerClient';
import { getLevelConfig, getTimeBudget, getTotalTimeout } from '../lib/cpu/cpuConfig';
import { mapCpuLevelToDifficulty } from '../lib/difficultyMapping';
import { cpuTelemetry } from '../lib/cpu/cpuTelemetry';
import type { CPUMoveTelemetry } from '../types/cpuTelemetry';
import { debugLog } from '../lib/logging/debugLogger';
import '../styles/CoachingMode.css';
import '../styles/CoachingBoardEnhanced.css';

interface CoachingModeState {
  chess: ChessGame;
  selectedSquare: Square | null;
  legalMoves: Square[];
  gameResult: string | null;
  moveHistory: Array<{
    moveNum: number;
    player: 'White' | 'Black';
    move: string;
    fen: string;
    source?: { type: string; details?: any };
  }>;
  boardVersion: number;
  gameMode: 'two-player' | 'vs-cpu';
  cpuLevel: number; // 1-8 difficulty
  cpuColor: 'w' | 'b';
  isThinking: boolean;
  cpuError: string | null;
  moveErrors: Array<{
    timestamp: number;
    from: Square | null;
    to: Square | null;
    reason: string;
  }>;
  showPlayerProfile: boolean;
  capturedPieces: CapturedPiecesData;
  recentCapture: {
    capturedColor: 'red' | 'black';
    pieceType: string;
    timestamp: number;
  } | null;
}

export const CoachingMode: React.FC = () => {
  const [state, setState] = useState<CoachingModeState>(() => ({
    chess: new ChessGame(),
    selectedSquare: null,
    legalMoves: [],
    gameResult: null,
    moveHistory: [],
    boardVersion: 0,
    gameMode: 'two-player',
    showPlayerProfile: false,
    cpuLevel: 4,
    cpuColor: 'w', // CPU plays RED pieces (white), Player plays BLACK
    isThinking: false,
    cpuError: null,
    capturedPieces: {
      red: [],
      black: [],
    },
    recentCapture: null,
    moveErrors: [],
  }));

  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [showTroubleshootingPanel, setShowTroubleshootingPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showCoachingAnalysis, setShowCoachingAnalysis] = useState(false);
  const [isLearnedPosition, setIsLearnedPosition] = useState(false);
  const [forceMovePending, setForceMovePending] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);
  const [showOpeningsModal, setShowOpeningsModal] = useState(false);
  const [lastWorkerMetadata, setLastWorkerMetadata] = useState<{
    depthReached: number;
    timeMs: number;
    sliceCount: number;
    complete: boolean;
    tacticalSafety?: {
      rejectedMoves: number;
      reasons: string[];
    };
    source: string;
  } | null>(null);
  
  // Worker performance tracking for timeout monitoring
  const [workerStats, setWorkerStats] = useState<{
    totalAttempts: number;
    successCount: number;
    timeoutCount: number;
    fallbackCount: number;
    avgSuccessTime: number;
    avgFallbackTime: number;
    lastTimeout: Date | null;
    recentMoves: Array<{
      timestamp: Date;
      success: boolean;
      timeMs: number;
      depth: number;
      source: string;
      level: number;
    }>;
  }>({
    totalAttempts: 0,
    successCount: 0,
    timeoutCount: 0,
    fallbackCount: 0,
    avgSuccessTime: 0,
    avgFallbackTime: 0,
    lastTimeout: null,
    recentMoves: [],
  });
  
  // Track in-flight CPU move requests to prevent duplicates
  const cpuMoveInFlight = useRef(false);
  const cpuMoveTimeout = useRef<NodeJS.Timeout | null>(null);

  // CPU move logic with tracing, timeouts, and knowledge vault integration
  // Reads fresh state inside setState to avoid stale closure issues
  const makeCPUMove = useCallback(() => {
    // Prevent duplicate CPU move requests
    if (cpuMoveInFlight.current) {
      debugLog.warn('[CPU Move] ⚠️ Request already in flight, skipping duplicate');
      persistentLogger.error('CPU move blocked - already in flight', { inFlight: cpuMoveInFlight.current });
      return;
    }

    debugLog.log('[CPU Move] 🚀 Starting CPU move...');
    cpuMoveInFlight.current = true;
    persistentLogger.info('CPU move triggered', { inFlight: true });
    
    const requestId = moveTracer.generateRequestId();
    const startTime = Date.now();
    
    // Reset force move state for new calculation
    setForceMovePending(false);
    
    // Capture current CPU level for timeout calculation
    let capturedCpuLevel = 4; // Default
    setState(prev => {
      capturedCpuLevel = prev.cpuLevel;
      return { ...prev, isThinking: true, cpuError: null };
    });
    
    // WATCHDOG: Detect if setTimeout never fires (JavaScript event loop issue)
    let timerFired = false;
    const watchdogTimeout = setTimeout(() => {
      if (!timerFired) {
        console.error('[CPU Move] ❌ WATCHDOG ALERT: Timer callback never executed!');
        persistentLogger.error('CPU move watchdog - timer never fired', { 
          elapsed: Date.now() - startTime,
          cpuLevel: capturedCpuLevel,
          message: 'setTimeout callback never executed - possible event loop blockage'
        });
        cpuMoveInFlight.current = false;
        setState(prev => ({
          ...prev,
          isThinking: false,
          cpuError: 'CPU move failed to start (event loop issue). Please refresh the page.'
        }));
      }
    }, 2000); // 2 second watchdog
    
    // Reduced logging during CPU computation to avoid blocking

    // Global timeout - same for ALL levels (difficulty scales via depth/evaluation/tactics)
    const timeoutMs = getTotalTimeout();
    cpuMoveTimeout.current = setTimeout(() => {
      console.error(`[CPU Move] TIMEOUT - CPU did not respond within ${timeoutMs}ms`);
      persistentLogger.error('CPU move timeout', { level: capturedCpuLevel, elapsed: Date.now() - startTime, timeoutMs });
      cpuMoveInFlight.current = false;
      
      setState(prev => {
        const fen = prev.chess.getFEN();
        const pgn = prev.chess.getPGN();
        const moveNum = Math.ceil(prev.moveHistory.length / 2) + 1;
        
        moveTracer.logTimeout(requestId, fen, pgn, moveNum, timeoutMs);
        
        return {
          ...prev,
          isThinking: false,
          cpuError: `CPU took too long to respond (>${timeoutMs/1000}s at level ${prev.cpuLevel}). Click "Retry" or start a new game.`,
        };
      });
    }, timeoutMs);

    // Simulate realistic thinking time - reduced for better UX
    const thinkingTime = 300 + Math.random() * 400; // 0.3-0.7 seconds
    const perfStart = performance.now();
    
    debugLog.log(`[CPU Move] Scheduling setTimeout callback in ${Math.round(thinkingTime)}ms...`);
    persistentLogger.info('CPU move - setTimeout scheduled', { 
      delayMs: Math.round(thinkingTime),
      cpuLevel: capturedCpuLevel 
    });
    
    setTimeout(async () => {
      timerFired = true;
      clearTimeout(watchdogTimeout);
      
      debugLog.log('[CPU Move] ✅ setTimeout callback EXECUTING');
      persistentLogger.info('CPU move - callback executing', { 
        elapsed: Math.round(performance.now() - perfStart) 
      });
      
      try {
        const afterDelay = performance.now();
        debugLog.log('[CPU Move] Timer fired after', Math.round(afterDelay - perfStart), 'ms, getting state...');
        
        persistentLogger.info('CPU move - entering setState', { elapsed: Math.round(afterDelay - perfStart) });
        
        // Capture state in a promise to ensure it's set
        let stateSnapshot: CoachingModeState;
        try {
          const captureState = new Promise<CoachingModeState>((resolve, reject) => {
            try {
              setState(prev => {
                resolve({ ...prev });
                return prev;
              });
            } catch (err) {
              reject(err);
            }
          });

          stateSnapshot = await captureState;
        } catch (stateError) {
          console.error('[CPU Move] ❌ Failed to capture state:', stateError);
          persistentLogger.error('CPU move - state capture failed', { 
            error: stateError instanceof Error ? stateError.message : String(stateError),
            elapsed: Date.now() - startTime
          });
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          setState(prev => ({
            ...prev,
            isThinking: false,
            cpuError: 'Failed to capture game state. Please try again.'
          }));
          return;
        }
      const { chess, cpuColor, gameMode, gameResult, moveHistory, cpuLevel } = stateSnapshot;

      debugLog.log('[CPU Move] State captured:', { gameMode, cpuColor, turn: chess.getTurn(), gameResult });
      persistentLogger.info('CPU move - state captured', { 
        gameMode, 
        cpuColor, 
        turn: chess.getTurn(), 
        gameResult,
        moveCount: moveHistory.length 
      });

      // Double-check conditions
      if (gameMode !== 'vs-cpu' || chess.getTurn() !== cpuColor || gameResult) {
        clearTimeout(cpuMoveTimeout.current!);
        cpuMoveInFlight.current = false;
        debugLog.log('[CPU Move] Skipping - conditions not met');
        setState(prev => ({ ...prev, isThinking: false }));
        return;
      }

      const fen = chess.getFEN();
      const pgn = chess.getPGN();
      const plyCount = moveHistory.length;
      const moveNum = Math.ceil(plyCount / 2) + 1;

      const aiStart = performance.now();
      debugLog.log('[CPU Move] Starting move selection at', Math.round(aiStart - perfStart), 'ms from start...');
      moveTracer.logCPURequest(requestId, fen, pgn, moveNum);
      
      persistentLogger.info('CPU move - starting AI calculation', { 
        fen, 
        moveNum, 
        cpuLevel,
        legalMovesCount: 0 // Will update below
      });

      // Get all legal moves
      const allMoves: { from: Square; to: Square }[] = [];
      for (let rank = 1; rank <= 8; rank++) {
        for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
          const square = `${file}${rank}` as Square;
          const piece = chess.getPiece(square);
          if (piece && piece.charAt(0) === cpuColor) {
            const moves = chess.getLegalMoves(square);
            moves.forEach((to: Square) => allMoves.push({ from: square, to }));
          }
        }
      }

      if (allMoves.length === 0) {
        clearTimeout(cpuMoveTimeout.current!);
        cpuMoveInFlight.current = false;
        moveTracer.logError(requestId, 'No legal moves available', fen, pgn, moveNum);
        console.error('[CPU Move] No legal moves!');
        persistentLogger.error('No legal moves available for CPU', { fen, moveNum });
        setState(prev => ({ ...prev, isThinking: false, gameResult: 'Game Over' }));
        return;
      }

      debugLog.log('[CPU Move] Found', allMoves.length, 'legal moves');
      // Reduced logging during AI calculation to prevent event loop blocking
      // persistentLogger.info('CPU move - found legal moves', { count: allMoves.length });

      // ENHANCED: Analyze position criticality to determine depth adjustments
      const { analyzePositionCriticality } = await import('../lib/positionCriticality');
      
      const criticality = analyzePositionCriticality(chess);
      debugLog.log(`[CPU Move] Position criticality: ${criticality.score}/100 (${criticality.isCritical ? 'CRITICAL' : 'normal'})`, criticality.reasons);
      
      // Use Minimax with Alpha-Beta Pruning for intelligent move selection
      // For levels 7-8, use learning-enhanced AI
      let selectedMove: { from: Square; to: Square } | null = null;
      let moveSource = 'ai-search';
      let actualSearchDepth = 0;
      
      // Reduced logging during AI calculation
      // persistentLogger.info('CPU move - starting AI search', { cpuLevel, moveCount: moveHistory.length });
      
      try {
        // Get level configuration (depth targets, features, etc.)
        const levelConfig = getLevelConfig(cpuLevel);
        const timeBudget = getTimeBudget(); // Same for all levels
        
        const moveCount = moveHistory.length;
        
        // Use level config depth targets
        let searchDepth = levelConfig.targetDepth;
        
        // Adjust for game phase (slight tweaks, but config is primary)
        if (moveCount < 10) {
          // Opening: use target depth
          searchDepth = levelConfig.targetDepth;
        } else if (moveCount > 35) {
          // Endgame: may reduce slightly if very late
          searchDepth = Math.max(levelConfig.minDepth, levelConfig.targetDepth - 1);
        }
        
        // Apply criticality bonus (position-specific)
        searchDepth += criticality.recommendedDepthBonus;
        
        // Enforce hard cap from level config
        searchDepth = Math.min(searchDepth, levelConfig.hardCap);
        
        // Use global time budget (same for all levels)
        const allocatedTime = timeBudget;
        
        debugLog.log(`[CPU Move] Level ${cpuLevel}: depth ${searchDepth} (min: ${levelConfig.minDepth}, target: ${levelConfig.targetDepth}, cap: ${levelConfig.hardCap}), time ${allocatedTime}ms`);
        debugLog.log(`[CPU Move] Config: beam=${levelConfig.beamWidth}, quiescence=${levelConfig.useQuiescence}, aspiration=${levelConfig.useAspiration}, tactical=${levelConfig.tacticalScan}`);
        
        // CONSTRAINT A: Always attempt Prisma Worker API for levels that support it
        // Worker will be tried first; fallback to local computation only on actual failure
        const useWorker = cpuLevel >= 3 && cpuLevel <= 8; // Levels 3-8 use worker
        debugLog.log(`[CPU Move] 🔧 CODE VERSION: 2025-12-30-v3-learning-layer | Level ${cpuLevel} | useWorker: ${useWorker}`);
        const currentMoveHistory = moveHistory.map((m: any) => m.move || m);
        
        // NOTE: Local CPU learning has been deprecated in favor of server-side Learning Layer V3
        // Learning now happens via POST /api/learning/ingest-game and influences coaching, not moves
        
        if (useWorker) {
          debugLog.log('[CPU Move] Using API for server-side computation');
          
          // Infinite retry for levels 7-8 (use Force Move button to trigger fallback)
          // Limited retry (3 attempts) for levels 3-6
          const maxRetries = (cpuLevel >= 7 && cpuLevel <= 8) ? Infinity : 3;
          let retryCount = 0;
          let lastError: Error | null = null;
          let workerSuccess = false;
          let apiStartTime = Date.now(); // Declare outside loop for error handling
          let statusCode: number | undefined = undefined; // Track HTTP status for telemetry
          
          while (retryCount <= maxRetries && !workerSuccess && !forceMovePending) {
            try {
              if (retryCount > 0) {
                const retryLabel = maxRetries === Infinity ? `#${retryCount}` : `${retryCount}/${maxRetries}`;
                debugLog.log(`[CPU Move] 🔄 Retry attempt ${retryLabel} for Level ${cpuLevel}`);
              }
              
              // Call the /api/chess-move API endpoint
              apiStartTime = Date.now();
              debugLog.log(`[CPU Move] 🌐 Calling Worker API: Level ${cpuLevel}, Depth ${searchDepth}, Time ${allocatedTime}ms${retryCount > 0 ? ` (Retry ${retryCount})` : ''}`);
              
              // Create AbortController for fetch timeout (30 seconds max per attempt)
              const controller = new AbortController();
              const fetchTimeout = setTimeout(() => {
                debugLog.warn('[CPU Move] ⚠️ Fetch timeout after 30s, aborting...');
                controller.abort();
              }, 30000);
              
              let apiResponse;
              let apiElapsedMs;
              
              try {
                apiResponse = await fetch('/api/chess-move', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    fen: chess.getFEN(),
                    pgn: chess.getPGN(),
                    difficulty: mapCpuLevelToDifficulty(cpuLevel),
                    gameId: `game_${Date.now()}`,
                    depth: searchDepth, // Send actual depth target
                    timeMs: allocatedTime, // Send actual time budget
                    cpuLevel: cpuLevel, // Send level for diagnostics
                  }),
                  signal: controller.signal
                });
                
                clearTimeout(fetchTimeout);
                
                apiElapsedMs = Date.now() - apiStartTime;
                debugLog.log(`[CPU Move] 📡 API Response: Status ${apiResponse.status}, Time ${apiElapsedMs}ms${retryCount > 0 ? ` (Retry ${retryCount})` : ''}`);
                
                if (!apiResponse.ok) {
                  const errorText = await apiResponse.text();
                  console.error(`[CPU Move] ❌ API Error Response (${apiResponse.status}):`, errorText);
                  const error = new Error(`API returned ${apiResponse.status}: ${apiResponse.statusText}`);
                  (error as any).statusCode = apiResponse.status; // Attach for telemetry
                  throw error;
                }
              } catch (fetchError) {
                clearTimeout(fetchTimeout);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                  debugLog.warn('[CPU Move] ⚠️ Fetch aborted due to timeout');
                  throw new Error('API request timeout after 30s');
                }
                throw fetchError;
              }
              
              const apiData = await apiResponse.json();
              
              debugLog.log('[CPU Move] 🔍 Raw API Response:', JSON.stringify(apiData, null, 2));
              debugLog.log('[CPU Move] 🔍 Current FEN:', chess.getFEN());
              
              if (!apiData.success) {
                throw new Error(apiData.error || 'API returned unsuccessful response');
              }
              
              // Convert API response to worker result format
              // Worker API returns SAN notation (e.g., "a3"), need to convert to from/to squares
              let parsedMove = null;
              if (apiData.move) {
              debugLog.log('[CPU Move] 🔍 Parsing SAN move:', apiData.move);
              try {
                // Create a temporary chess instance to parse the SAN move
                const tempChess = new Chess(chess.getFEN());
                const moves = tempChess.moves({ verbose: true });
                debugLog.log('[CPU Move] 🔍 Available moves count:', moves.length);
                debugLog.log('[CPU Move] 🔍 First 10 SAN moves:', moves.slice(0, 10).map(m => m.san));
                
                const matchedMove = moves.find(m => m.san === apiData.move || m.san === apiData.move + '+' || m.san === apiData.move + '#');
                
                if (matchedMove) {
                  parsedMove = {
                    from: matchedMove.from,
                    to: matchedMove.to
                  };
                  debugLog.log('[CPU Move] ✅ Successfully parsed:', apiData.move, '→', parsedMove);
                } else {
                  console.error('[CPU Move] ❌ Failed to parse SAN move:', apiData.move);
                  console.error('[CPU Move] Available moves:', moves.map(m => m.san));
                  // Throw error to trigger fallback with better message
                  throw new Error(`Could not parse SAN move "${apiData.move}" - not in legal moves list`);
                }
              } catch (err) {
                console.error('[CPU Move] ❌ Error parsing SAN move:', err);
                throw err; // Re-throw to trigger API error handling
              }
            } else {
              console.error('[CPU Move] ❌ No move in API response');
              throw new Error('API returned no move');
            }
            
            const workerResult = {
              move: parsedMove,
              metadata: {
                depthReached: apiData.diagnostics?.depth || apiData.debug?.depthReached || searchDepth,
                source: apiData.mode === 'worker' ? 'worker' : 'fallback main_thread',
                timeMs: apiElapsedMs,
                sliceCount: 1,
                complete: true,
                tacticalSafety: apiData.debug?.tacticalSafety,
              }
            };
            
            // � TELEMETRY: Log successful Worker API call
            const telemetry: CPUMoveTelemetry = cpuTelemetry.createWorkerSuccess({
              moveNumber: moveHistory.length + 1,
              cpuLevel,
              requestId,
              moveFrom: parsedMove.from,
              moveTo: parsedMove.to,
              depthReached: workerResult.metadata.depthReached,
              workerTimeMs: apiElapsedMs,
              totalTimeMs: Date.now() - perfStart,
            });
            cpuTelemetry.logMove(telemetry);
            debugLog.log('[CPU Telemetry] ✅ Worker success logged:', {
              moveNumber: telemetry.moveNumber,
              apiAttempted: telemetry.apiAttempted,
              apiSucceeded: telemetry.apiSucceeded,
              fallbackUsed: telemetry.fallbackUsedThisMove,
              consecutiveFallbacks: cpuTelemetry.getStats().consecutiveFallbacks,
            });
            
            // �🔍 DIAGNOSTIC: Log full API response structure
            debugLog.log('[DIAGNOSTIC] API Response:', {
              hasMove: !!apiData.move,
              move: apiData.move,
              hasWorkerCallLog: !!apiData.workerCallLog,
              workerCallLog: apiData.workerCallLog,
              mode: apiData.mode,
              engine: apiData.engine,
              hasDiagnostics: !!apiData.diagnostics,
              diagnostics: apiData.diagnostics
            });
            
            // Store worker call log for admin portal
            if (typeof window !== 'undefined' && (window as any).gameStore) {
              debugLog.log('[DIAGNOSTIC] gameStore is available, attempting to log worker call');
              
              try {
                const store = (window as any).gameStore;
                
                // Log gameStore state before logging
                const currentWorkerCalls = store.getState().debugInfo.workerCalls || [];
                debugLog.log('[DIAGNOSTIC] Current worker calls count:', currentWorkerCalls.length);
                
                if (apiData.workerCallLog) {
                  // Worker was called - log the actual call
                  const logData = {
                    endpoint: apiData.workerCallLog.endpoint,
                    method: apiData.workerCallLog.method,
                    success: apiData.workerCallLog.success,
                    latencyMs: apiData.workerCallLog.latencyMs,
                    error: apiData.workerCallLog.error,
                    request: apiData.workerCallLog.request,
                    response: apiData.workerCallLog.response,
                  };
                  
                  debugLog.log('[DIAGNOSTIC] Calling logWorkerCall() with:', logData);
                  store.getState().logWorkerCall(logData);
                  
                  // Verify it was stored
                  const updatedWorkerCalls = store.getState().debugInfo.workerCalls || [];
                  debugLog.log('[DIAGNOSTIC] After logging, worker calls count:', updatedWorkerCalls.length);
                  debugLog.log('[CPU Move] ✅ Worker call logged:', apiData.workerCallLog);
                } else {
                  // Fallback was used - log it as a failed worker call
                  const fallbackLog = {
                    endpoint: '/api/chess-move',
                    method: 'POST',
                    success: false,
                    latencyMs: apiElapsedMs,
                    error: 'Worker not available - used local fallback',
                    request: { fen: chess.getFEN(), difficulty: cpuLevel, gameId: `game_${Date.now()}` },
                    response: { move: apiData.move, mode: apiData.mode || 'local-fallback' },
                  };
                  
                  debugLog.log('[DIAGNOSTIC] No workerCallLog in response, logging fallback:', fallbackLog);
                  store.getState().logWorkerCall(fallbackLog);
                  
                  // Verify it was stored
                  const updatedWorkerCalls = store.getState().debugInfo.workerCalls || [];
                  debugLog.log('[DIAGNOSTIC] After logging fallback, worker calls count:', updatedWorkerCalls.length);
                  debugLog.log('[CPU Move] ⚠️ Fallback logged (no worker call)');
                }
              } catch (err) {
                console.error('[CPU Move] ❌ Failed to log worker call:', err);
                console.error('[DIAGNOSTIC] Error details:', {
                  message: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined
                });
              }
            } else {
              console.error('[DIAGNOSTIC] ❌ gameStore not available on window');
              console.error('[DIAGNOSTIC] window type:', typeof window);
              console.error('[DIAGNOSTIC] window.gameStore:', (window as any)?.gameStore);
            }
            
            selectedMove = workerResult.move as { from: Square; to: Square };
            actualSearchDepth = workerResult.metadata.depthReached;
            moveSource = workerResult.metadata.source;
            
            const workerElapsed = workerResult.metadata.timeMs;
            
            // Store worker metadata for debug panel
            setLastWorkerMetadata(workerResult.metadata);
            
            // Update game store with engine feature data (if available)
            if (typeof window !== 'undefined' && (window as any).gameStore) {
              try {
                const store = (window as any).gameStore;
                store.getState().updateWorkerMetadata(workerResult.metadata);
                store.getState().updateEngineFeatures({
                  quiescence: {
                    enabled: levelConfig.useQuiescence,
                    maxDepth: levelConfig.quiescenceMaxDepth,
                    errors: [], // Will be populated by error logging
                  },
                  beamSearch: {
                    enabled: levelConfig.beamWidth > 0,
                    width: levelConfig.beamWidth,
                    movesEvaluated: levelConfig.beamWidth, // Top N moves evaluated
                    movesSkipped: Math.max(0, 50 - levelConfig.beamWidth), // Estimated
                  },
                  aspiration: {
                    enabled: levelConfig.useAspiration,
                    window: levelConfig.aspirationWindow,
                    failedHigh: 0, // Will be detected from logs
                    failedLow: 0, // Will be detected from logs
                    reSearches: 0, // Will be detected from logs
                  },
                });
              } catch (err) {
                debugLog.warn('[CPU Move] Could not update game store debug info:', err);
              }
            }
            
            if (selectedMove) {
              debugLog.log(`[CPU Move] API result: depth ${workerResult.metadata.depthReached}, time ${Math.round(workerElapsed)}ms, source: ${workerResult.metadata.source}`);
              
              // Log time budget diagnostics (if available)
              if (apiData.diagnostics) {
                const diag = apiData.diagnostics;
                debugLog.log(`[CPU Move] ⏱️ Time Budget: requested=${diag.requestedTimeMs || 'N/A'}ms, capped=${diag.cappedTimeMs || 'N/A'}ms, used=${diag.searchTimeMs || diag.stockfishMs || 'N/A'}ms, utilization=${diag.budgetUtilization || 'N/A'}, abort=${diag.abortReason || 'N/A'}`);
                debugLog.log(`[CPU Move] 🐛 Stockfish Data:`, {
                  cpuLevel: diag.cpuLevel,
                  depth: diag.depth,
                  nodes: diag.nodes,
                  evaluation: diag.evaluation,
                  pv: diag.pv,
                  mate: diag.mate,
                  uciMove: diag.uciMove,
                  sanMove: diag.move,
                  nps: diag.nps
                });
              }
            
              // Track success stats
              const wasWorkerSuccess = workerResult.metadata.source === 'worker';
              setWorkerStats(prev => {
                const newMove = {
                  timestamp: new Date(),
                  success: wasWorkerSuccess,
                  timeMs: workerElapsed,
                  depth: workerResult.metadata.depthReached,
                  source: workerResult.metadata.source as 'worker' | 'fallback_main_thread' | 'search',
                  level: cpuLevel,
                };
                
                const successMoves = wasWorkerSuccess ? [...prev.recentMoves, newMove].filter(m => m.success) : prev.recentMoves.filter(m => m.success);
                const fallbackMoves = !wasWorkerSuccess ? [...prev.recentMoves, newMove].filter(m => !m.success) : prev.recentMoves.filter(m => !m.success);
                
                return {
                  totalAttempts: prev.totalAttempts + 1,
                  successCount: wasWorkerSuccess ? prev.successCount + 1 : prev.successCount,
                  fallbackCount: wasWorkerSuccess ? prev.fallbackCount : prev.fallbackCount + 1,
                  timeoutCount: prev.timeoutCount,
                  lastTimeout: prev.lastTimeout,
                  avgSuccessTime: successMoves.length > 0 ? successMoves.reduce((sum, m) => sum + m.timeMs, 0) / successMoves.length : prev.avgSuccessTime,
                  avgFallbackTime: fallbackMoves.length > 0 ? fallbackMoves.reduce((sum, m) => sum + m.timeMs, 0) / fallbackMoves.length : prev.avgFallbackTime,
                  recentMoves: [newMove, ...prev.recentMoves].slice(0, 10),
                };
              });
            
              if (workerResult.metadata.tacticalSafety) {
                debugLog.log(`[CPU Move] Tactical safety: rejected ${workerResult.metadata.tacticalSafety.rejectedMoves} moves`);
              }
              
              persistentLogger.info('CPU move - API search completed', {
                from: selectedMove.from,
                to: selectedMove.to,
                source: moveSource,
                searchDepth: actualSearchDepth,
                searchTimeMs: Math.round(workerElapsed),
                timeLimitMs: allocatedTime,
                sliceCount: workerResult.metadata.sliceCount,
                complete: workerResult.metadata.complete,
                tacticalSafety: workerResult.metadata.tacticalSafety
              });
              
              // Mark success to exit retry loop
              workerSuccess = true;
            }
            
          } catch (error) {
            lastError = error as Error;
            retryCount++;
            
            const isTimeout = error instanceof Error && (error.message.includes('timeout') || error.message.includes('timed out'));
            statusCode = (error as any).statusCode; // Extract HTTP status if attached
            const errorDetails = {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              type: error instanceof Error ? error.constructor.name : typeof error,
              statusCode,
              fullError: error
            };
            
            // For infinite retry (levels 7-8), show retry count without max
            const retryLabel = maxRetries === Infinity ? `#${retryCount}` : `${retryCount}/${maxRetries + 1}`;
            console.error(`[CPU Move] ❌ API error (attempt ${retryLabel}):`, errorDetails);
            
            // Check if force move was requested
            if (forceMovePending) {
              debugLog.warn('[CPU Move] ⚠️ Force move requested - stopping retries and using fallback');
              persistentLogger.error('API computation cancelled by user (force move)', { error: errorDetails, retries: retryCount - 1 });
              break; // Exit loop to use fallback
            }
            
            // Check if we should retry (infinite for 7-8, limited for others)
            if (retryCount <= maxRetries) {
              const retryMsg = maxRetries === Infinity 
                ? `[CPU Move] 🔄 Waiting before retry #${retryCount} (use Force Move button to skip to fallback)` 
                : `[CPU Move] 🔄 Retrying... (${retryCount}/${maxRetries} retries used)`;
              debugLog.log(retryMsg);
              
              // For infinite retries (levels 7-8), add delay before next attempt
              if (maxRetries === Infinity) {
                const retryDelayMs = 2000; // 2 second delay between retries
                debugLog.log(`[CPU Move] ⏱️ Waiting ${retryDelayMs}ms before next attempt (or click Force Move)`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                
                // Check if force move was clicked during the delay
                if (forceMovePending) {
                  debugLog.warn('[CPU Move] ⚠️ Force move clicked during wait - exiting retry loop');
                  break;
                }
              }
              
              continue; // Continue while loop for next retry
            }
            
            // Retries exhausted (only happens for non-7/8 levels)
            debugLog.warn(`[CPU Move] ⚠️ All retries exhausted (${maxRetries}), falling back to main thread`);
            debugLog.warn('[CPU Move] ⚠️ Fallback will be used for THIS MOVE ONLY - Worker will be retried next turn');
            persistentLogger.error('API computation failed after retries', { error: errorDetails, retries: retryCount - 1 });
            
            // Track timeout/failure stats
            setWorkerStats(prev => ({
              ...prev,
              totalAttempts: prev.totalAttempts + 1,
              timeoutCount: isTimeout ? prev.timeoutCount + 1 : prev.timeoutCount,
              fallbackCount: prev.fallbackCount + 1,
              lastTimeout: isTimeout ? new Date() : prev.lastTimeout,
            }));
            
            // Only log non-transient errors to game store debug (avoid noise from expected 503s)
            const isTransientError = errorDetails.message.includes('503') || 
                                    errorDetails.message.includes('timeout') ||
                                    errorDetails.message.includes('CPU limit');
            
            if (!isTransientError && typeof window !== 'undefined' && (window as any).gameStore) {
              try {
                const store = (window as any).gameStore;
                store.getState().logFeatureError('worker', 
                  errorDetails.message,
                  { cpuLevel, fen: chess.getFEN(), levelConfig, errorDetails }
                );
              } catch (err) {
                debugLog.warn('[CPU Move] Could not log worker error to store:', err);
              }
            }
            
            // For levels 7-8, ONLY use fallback if force move was requested
            if (cpuLevel >= 7 && cpuLevel <= 8 && !forceMovePending) {
              throw new Error('Worker retries incomplete - force move not requested (this should not happen)');
            }
            
            // 🚫 FALLBACK DISABLED FOR DEBUGGING - Let it fail to fix root cause
            console.error(`[CPU Move] 🚫 FALLBACK DISABLED - Worker failed after retries, throwing error to surface issue`);
            throw new Error(`Worker API failed after ${retryCount} retries: ${lastError?.message || 'Unknown error'}`);
            
            /* ORIGINAL FALLBACK CODE - TEMPORARILY DISABLED
            // Fallback to learning AI (SINGLE MOVE ONLY when forced for levels 7-8, or after retries exhausted for other levels)
            debugLog.log(`[CPU Move] 🔀 Using minimax fallback${forceMovePending ? ' (forced by user)' : ' (retries exhausted)'}`);
            const fallbackStartTime = Date.now();
            const workerFailureTime = fallbackStartTime - apiStartTime; // Time spent on failed Worker attempts
            const result = findBestMoveWithLearning(chess, searchDepth, cpuLevel, currentMoveHistory);
            selectedMove = result.move as { from: Square; to: Square };
            actualSearchDepth = result.searchDepth || searchDepth;
            moveSource = result.source;
            
            const fallbackElapsedMs = Date.now() - fallbackStartTime;
            
            // 📊 TELEMETRY: Log Worker failure with fallback
            if (selectedMove) {
              try {
                const telemetry: CPUMoveTelemetry = cpuTelemetry.createWorkerFailureWithFallback({
                  moveNumber: moveHistory.length + 1,
                  cpuLevel,
                  requestId,
                  moveFrom: selectedMove.from,
                  moveTo: selectedMove.to,
                  depthReached: actualSearchDepth,
                  error: error instanceof Error ? error : new Error(String(error)),
                  statusCode: statusCode, // Extract from fetch response
                  workerTimeMs: workerFailureTime,
                  fallbackTimeMs: fallbackElapsedMs,
                  totalTimeMs: Date.now() - perfStart,
                });
                cpuTelemetry.logMove(telemetry);
                debugLog.log('[CPU Telemetry] ⚠️ Fallback used (single move):', {
                  moveNumber: telemetry.moveNumber,
                  apiAttempted: telemetry.apiAttempted,
                  apiSucceeded: telemetry.apiSucceeded,
                  fallbackUsed: telemetry.fallbackUsedThisMove,
                  errorType: telemetry.apiErrorCode,
                  consecutiveFallbacks: cpuTelemetry.getStats().consecutiveFallbacks,
                });
              } catch (telemetryError) {
                console.error('[CPU Telemetry] ❌ Failed to log fallback:', telemetryError);
                // Don't throw - allow game to continue
              }
            }
            */
            
            /* FALLBACK PERFORMANCE TRACKING - DISABLED
            // Track fallback performance
            const fallbackTime = Date.now() - startTime;
            setWorkerStats(prev => {
              const newMove = {
                timestamp: new Date(),
                success: false,
                timeMs: fallbackTime,
                depth: searchDepth,
                source: 'fallback_main_thread',
                level: cpuLevel,
              };
              const recentMoves = [...prev.recentMoves, newMove].slice(-50);
              const fallbackMoves = recentMoves.filter(m => !m.success);
              const avgFallbackTime = fallbackMoves.length > 0
                ? fallbackMoves.reduce((sum, m) => sum + m.timeMs, 0) / fallbackMoves.length
                : prev.avgFallbackTime;
              
              return {
                ...prev,
                avgFallbackTime,
                recentMoves,
              };
            });
            */
          } // End catch block
          } // End while loop (retry attempts)
          
          // Show learned position indicator if applicable
          if (moveSource && moveSource.includes('learned')) {
            setIsLearnedPosition(true);
            setTimeout(() => setIsLearnedPosition(false), 3000);
          }
        } else {
          // Use learning AI on main thread for levels 1-2, 7-8 (Worker disabled)
          debugLog.log('[CPU Move] Using local computation (Worker not attempted for this level)');
          const localStartTime = Date.now();
          const result = findBestMoveWithLearning(chess, searchDepth, cpuLevel, currentMoveHistory);
          selectedMove = result.move as { from: Square; to: Square };
          actualSearchDepth = result.searchDepth || searchDepth;
          moveSource = result.source;
          
          if (selectedMove) {
            // 📊 TELEMETRY: Log local computation (no Worker attempt)
            const telemetry: CPUMoveTelemetry = cpuTelemetry.createLocalComputation({
              moveNumber: moveHistory.length + 1,
              cpuLevel,
              requestId,
              moveFrom: selectedMove.from,
              moveTo: selectedMove.to,
              depthReached: actualSearchDepth,
              totalTimeMs: Date.now() - localStartTime,
            });
            cpuTelemetry.logMove(telemetry);
            debugLog.log('[CPU Telemetry] 🏠 Local computation logged:', {
              moveNumber: telemetry.moveNumber,
              apiAttempted: telemetry.apiAttempted,
              source: telemetry.source,
              consecutiveFallbacks: cpuTelemetry.getStats().consecutiveFallbacks,
            });
            
            persistentLogger.info('CPU move - main thread search completed', { 
              from: selectedMove.from, 
              to: selectedMove.to, 
              source: moveSource,
              searchDepth: actualSearchDepth
            });
            
            if (moveSource.includes('learned')) {
              setIsLearnedPosition(true);
              setTimeout(() => setIsLearnedPosition(false), 3000);
            }
          }
        }
          
        if (!selectedMove) {
          throw new Error('No move found by AI');
        }
      } catch (error) {
        console.error('[CPU Move] Minimax failed, using fallback:', error);
        persistentLogger.warn('Minimax AI failed, using fallback', { error: String(error), level: cpuLevel });
        
        // Fallback: use simple heuristics
        const scoredMoves = allMoves.map(move => {
          let score = 0;
          if (['e4', 'e5', 'd4', 'd5'].includes(move.to)) score += 30;
          if (move.from[1] === '1' || move.from[1] === '8') score += 20;
          score += Math.random() * 10;
          return { ...move, score };
        });
        scoredMoves.sort((a, b) => b.score - a.score);
        selectedMove = scoredMoves[0];
      }
      
      if (!selectedMove) {
        throw new Error('No move found even in fallback');
      }
      
      const aiEnd = performance.now();
      debugLog.log('[CPU Move] Selected:', selectedMove.from, '→', selectedMove.to, 'time:', Math.round(aiEnd - perfStart), 'ms');

      // Now apply the move in setState
      setState(prevState => {
        if (!selectedMove) {
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          return { ...prevState, isThinking: false, cpuError: 'No move selected' };
        }

        // CRITICAL: Check if board state has changed since move was calculated
        const currentFEN = prevState.chess.getFEN();
        const calculatedFEN = fen; // FEN from stateSnapshot when move was calculated
        
        if (currentFEN !== calculatedFEN) {
          // Board state changed - move is no longer valid for current position
          debugLog.warn('[CPU Move] ⚠️ Board state changed during calculation. Canceling move.');
          debugLog.log('[CPU Move] Expected FEN:', calculatedFEN);
          debugLog.log('[CPU Move] Current FEN:', currentFEN);
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          persistentLogger.warn('CPU move canceled - board state changed', { 
            expectedFEN: calculatedFEN,
            currentFEN,
            move: `${selectedMove.from}→${selectedMove.to}`
          });
          return { ...prevState, isThinking: false };
        }

        // CRITICAL FIX: Clone chess instance first (immutable pattern)
        const newChess = prevState.chess.clone();
        
        // Check if CPU needs to promote (always promote to queen)
        const promotion = newChess.isPromotionMove(selectedMove.from, selectedMove.to) ? 'q' : undefined;
        
        // Check if this move captures a piece
        const targetPiece = newChess.getPiece(selectedMove.to);
        
        const move = newChess.makeMove(selectedMove.from, selectedMove.to, promotion);

        if (!move) {
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          const fen = prevState.chess.getFEN();
          const pgn = prevState.chess.getPGN();
          const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
          moveTracer.logError(requestId, `Invalid move: ${selectedMove.from}→${selectedMove.to}`, fen, pgn, moveNum);
          console.error('[CPU Move] Invalid move selected!');
          debugLog.log('[CPU Move] Available legal moves:', prevState.chess.moves({ verbose: true }).map((m: any) => `${m.from}→${m.to}`));
          persistentLogger.error('CPU selected invalid move', { from: selectedMove.from, to: selectedMove.to, fen, moveNum });
          return { ...prevState, isThinking: false, cpuError: 'CPU selected invalid move. Please retry.' };
        }

        // Calculate elapsed time
        const elapsed = Date.now() - startTime;
        const finalFen = newChess.getFEN();
        const finalPgn = newChess.getPGN();
        const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
        moveTracer.logCPUResponse(requestId, `${selectedMove.from}→${selectedMove.to}`, finalFen, finalPgn, moveNum, elapsed);

        // Track captured pieces
        let updatedCapturedPieces = prevState.capturedPieces;
        let newRecentCapture = null;
        if (targetPiece) {
          // Determine the COLOR of the piece that was captured
          const capturedPieceColor: 'red' | 'black' = targetPiece.startsWith('w') ? 'red' : 'black';
          updatedCapturedPieces = {
            ...prevState.capturedPieces,
            [capturedPieceColor]: [...prevState.capturedPieces[capturedPieceColor], targetPiece],
          };
          newRecentCapture = {
            capturedColor: capturedPieceColor as 'red' | 'black',
            pieceType: targetPiece,
            timestamp: Date.now(),
          };
          debugLog.log(`[Capture] ${capturedPieceColor.toUpperCase()} piece captured: ${targetPiece}`);
        }

        // Update state
        const newMoveHistory = [...prevState.moveHistory, {
          moveNum,
          player: (prevState.cpuColor === 'w' ? 'White' : 'Black') as 'White' | 'Black',
          move: move.san || (promotion ? `${selectedMove.from}-${selectedMove.to}=Q` : `${selectedMove.from}-${selectedMove.to}`),
          fen: finalFen,
          source: { type: moveSource, details: cpuLevel >= 7 ? { learning: true } : undefined },
          captured: move.captured, // Store captured piece type
        }];

        setLastMove({ from: selectedMove.from, to: selectedMove.to });

        const result = newChess.getGameResult();
        
        // Record game outcome for learning (levels 7-8 only)
        if (result && prevState.cpuLevel >= 7) {
          const moveHistorySAN = newMoveHistory.map(m => m.move);
          const cpuColor = prevState.cpuColor === 'w' ? 'white' : 'black';
          
          // Determine outcome from CPU's perspective
          let outcome: 'win' | 'loss' | 'draw';
          if (result.includes('Draw') || result.includes('Stalemate')) {
            outcome = 'draw';
          } else if (result.includes('Checkmate')) {
            const whiteWon = result.includes('White');
            const cpuIsWhite = prevState.cpuColor === 'w';
            outcome = (whiteWon === cpuIsWhite) ? 'win' : 'loss';
          } else {
            outcome = 'draw';
          }
          
          setTimeout(() => {
            recordGameForLearning(outcome, cpuColor, prevState.cpuLevel, moveHistorySAN, finalFen);
            debugLog.log('[LearningAI] Recorded game outcome:', outcome);
          }, 0);
        }

        // Clear timeout and in-flight flag
        clearTimeout(cpuMoveTimeout.current!);
        cpuMoveInFlight.current = false;
        
        // Reset force move flag for next turn
        if (forceMovePending) {
          debugLog.log('[CPU Move] 🔄 Resetting forceMovePending flag after move completion');
          setForceMovePending(false);
        }

        debugLog.log('[CPU Move] ✅ Move completed successfully, turn:', result ? 'game over' : newChess.getTurn());
        debugLog.log('[CPU Move] cpuMoveInFlight reset to:', cpuMoveInFlight.current);
        
        // Log completion after state update to avoid blocking
        setTimeout(() => {
          persistentLogger.info('CPU move completed', { 
            from: selectedMove.from, 
            to: selectedMove.to, 
            elapsed, 
            moveNum,
            inFlightReset: true
          });
        }, 0);

        // Clear the animation highlight after 2 seconds
        if (newRecentCapture) {
          setTimeout(() => {
            setState(prev => ({ ...prev, recentCapture: null }));
          }, 2000);
        }

        return {
          ...prevState,
          chess: newChess, // NEW chess instance - React will detect the change!
          moveHistory: newMoveHistory,
          gameResult: result,
          boardVersion: prevState.boardVersion + 1,
          isThinking: false,
          cpuError: null,
          capturedPieces: updatedCapturedPieces,
          recentCapture: newRecentCapture,
        };
      });
      
      } catch (error) {
        // Catch any errors in the entire CPU move logic
        console.error('[CPU Move] CRITICAL ERROR:', error);
        persistentLogger.error('CPU move critical error', { 
          error: error instanceof Error ? error.message : String(error), 
          stack: error instanceof Error ? error.stack : undefined,
          elapsed: Date.now() - startTime
        });
        
        clearTimeout(cpuMoveTimeout.current!);
        cpuMoveInFlight.current = false;
        
        // Reset force move flag on error too
        if (forceMovePending) {
          debugLog.log('[CPU Move] 🔄 Resetting forceMovePending flag after error');
          setForceMovePending(false);
        }
        
        setState(prev => ({
          ...prev,
          isThinking: false,
          cpuError: `CPU encountered an error: ${error instanceof Error ? error.message : String(error)}. Please try again.`
        }));
      }
    }, thinkingTime);
  }, [setState, moveTracer, persistentLogger, findBestMoveWithLearning, recordGameForLearning, setIsLearnedPosition, setLastMove]);

  const addDebugLog = useCallback((msg: string) => {
    debugLog.log(msg);
    // Defer debug log updates to avoid blocking game logic
    requestAnimationFrame(() => {
      setDebugLogs(prev => [...prev.slice(-99), `${new Date().toLocaleTimeString()}: ${msg}`]);
    });
  }, []);

  const handleSquareClick = useCallback((square: Square) => {
    const requestId = moveTracer.generateRequestId();
    
    setState(prevState => {
      const { chess, selectedSquare } = prevState;
      const piece = chess.getPiece(square);
      const currentTurn = chess.getTurn();
      
      const logMsg = `[Click] ${square} piece=${piece} turn=${currentTurn} cpuColor=${prevState.cpuColor}`;
      debugLog.log(logMsg);
      // Don't call setState inside setState - log after return
      setTimeout(() => addDebugLog(logMsg), 0);
      
      // UI ERROR TRACKING: If piece is selected, verify it still exists
      if (selectedSquare) {
        const selectedPiece = chess.getPiece(selectedSquare);
        if (!selectedPiece) {
          const uiError = {
            timestamp: Date.now(),
            from: selectedSquare,
            to: square,
            reason: `UI ERROR: Selected square ${selectedSquare} no longer has a piece. Visual state diverged from game state.`,
            fen: chess.getFEN()
          };
          console.error(`❌ [UI Error]`, uiError);
          persistentLogger.error('UI state mismatch', uiError);
          return {
            ...prevState,
            selectedSquare: null,
            legalMoves: [],
            moveErrors: [...prevState.moveErrors, uiError]
          };
        }
      }
      
      // In CPU mode, only allow moves for human player
      if (prevState.gameMode === 'vs-cpu' && currentTurn === prevState.cpuColor) {
        const blockMsg = '[Click] BLOCKED: CPU\'s turn';
        debugLog.log(blockMsg);
        addDebugLog(blockMsg);
        return prevState;
      }

      // Don't allow moves if game has ended
      if (prevState.gameResult) {
        return prevState;
      }

      // If clicking on the selected piece again, deselect
      if (selectedSquare === square) {
        return {
          ...prevState,
          selectedSquare: null,
          legalMoves: []
        };
      }

      // If no piece selected and clicking on current player's piece, select it
      if (!selectedSquare && piece) {
        const pieceColor = piece.charAt(0);
        const isCurrentPlayerPiece = (currentTurn === 'w' && pieceColor === 'w') || (currentTurn === 'b' && pieceColor === 'b');
        
        if (isCurrentPlayerPiece) {
          const moves = chess.getLegalMoves(square);
          return {
            ...prevState,
            selectedSquare: square,
            legalMoves: moves
          };
        }
      }

      // If piece IS selected and clicking on ANOTHER piece you own, switch selection
      if (selectedSquare && piece) {
        const pieceColor = piece.charAt(0);
        const isCurrentPlayerPiece = (currentTurn === 'w' && pieceColor === 'w') || (currentTurn === 'b' && pieceColor === 'b');
        
        if (isCurrentPlayerPiece) {
          const moves = chess.getLegalMoves(square);
          const switchMsg = `[Click] Switching selection: ${selectedSquare} → ${square}`;
          debugLog.log(switchMsg);
          addDebugLog(switchMsg);
          return {
            ...prevState,
            selectedSquare: square,
            legalMoves: moves
          };
        }
      }

      // If piece selected, try to move
      if (selectedSquare) {
        const attemptMsg = `[Click] Attempting move: ${selectedSquare} → ${square}`;
        debugLog.log(attemptMsg);
        addDebugLog(attemptMsg);
        
        // UI ERROR TRACKING: Final validation before move attempt
        const pieceAtSource = chess.getPiece(selectedSquare);
        if (!pieceAtSource) {
          const uiError = {
            timestamp: Date.now(),
            from: selectedSquare,
            to: square,
            reason: `UI ERROR: Attempted move from ${selectedSquare} but no piece found. Clicked: ${square}`,
            fen: chess.getFEN()
          };
          console.error(`❌ [UI Error]`, uiError);
          persistentLogger.error('UI move mismatch - no piece at source', uiError);
          return {
            ...prevState,
            selectedSquare: null,
            legalMoves: [],
            moveErrors: [...prevState.moveErrors, uiError]
          };
        }
        
        // Check if this is a pawn promotion move
        if (chess.isPromotionMove(selectedSquare, square)) {
          // Show promotion modal
          setPromotionMove({ from: selectedSquare, to: square });
          setShowPromotionModal(true);
          return prevState; // Don't make the move yet, wait for promotion choice
        }
        
        // CRITICAL FIX: Clone chess instance first (immutable pattern)
        const newChess = chess.clone();
        
        // Check if this move captures a piece
        const targetPiece = newChess.getPiece(square);
        
        const move = newChess.makeMove(selectedSquare, square);
        
        if (move) {
          // Move successful
          const fen = newChess.getFEN();
          const pgn = newChess.getPGN();
          const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
          
          const successMsg = `[Click] ✅ SUCCESS! ${selectedSquare}→${square} moveNum=${moveNum} newTurn=${newChess.getTurn()} historyLen=${prevState.moveHistory.length}→${prevState.moveHistory.length + 1}`;
          debugLog.log(successMsg);
          addDebugLog(successMsg);
          
          // Track captured pieces
          let updatedCapturedPieces = prevState.capturedPieces;
          let newRecentCapture = null;
          if (targetPiece) {
            // Determine the COLOR of the piece that was captured
            const capturedPieceColor: 'red' | 'black' = targetPiece.startsWith('w') ? 'red' : 'black';
            updatedCapturedPieces = {
              ...prevState.capturedPieces,
              [capturedPieceColor]: [...prevState.capturedPieces[capturedPieceColor], targetPiece],
            };
            newRecentCapture = {
              capturedColor: capturedPieceColor as 'red' | 'black',
              pieceType: targetPiece,
              timestamp: Date.now(),
            };
            debugLog.log(`[Capture] ${capturedPieceColor.toUpperCase()} piece captured: ${targetPiece}`);
          }
          
          // Log player move (deferred to avoid blocking)
          moveTracer.logPlayerMove(requestId, selectedSquare, square, fen, pgn, moveNum);
          setTimeout(() => {
            persistentLogger.info('Player move', { from: selectedSquare, to: square, moveNum });
          }, 0);
          
          const newMoveHistory = [...prevState.moveHistory, {
            moveNum,
            player: (currentTurn === 'w' ? 'White' : 'Black') as 'White' | 'Black',
            move: move.san || `${selectedSquare}-${square}`,
            fen,
            captured: move.captured, // Store captured piece type
          }];

          setLastMove({ from: selectedSquare, to: square });

          const result = newChess.getGameResult();
          if (result) {
            persistentLogger.info('Game ended', { result, totalMoves: newMoveHistory.length });
            
            // Record game outcome for learning (levels 7-8 only)
            if (prevState.gameMode === 'vs-cpu' && prevState.cpuLevel >= 7) {
              const moveHistorySAN = newMoveHistory.map(m => m.move);
              const cpuColor = prevState.cpuColor === 'w' ? 'white' : 'black';
              
              // Determine outcome from CPU's perspective
              let outcome: 'win' | 'loss' | 'draw';
              if (result.includes('Draw') || result.includes('Stalemate')) {
                outcome = 'draw';
              } else if (result.includes('Checkmate')) {
                const whiteWon = result.includes('White');
                const cpuIsWhite = prevState.cpuColor === 'w';
                outcome = (whiteWon === cpuIsWhite) ? 'win' : 'loss';
              } else {
                outcome = 'draw';
              }
              
              setTimeout(() => {
                recordGameForLearning(outcome, cpuColor, prevState.cpuLevel, moveHistorySAN, fen);
                debugLog.log('[LearningAI] Recorded game outcome:', outcome);
              }, 0);
            }
          }
          
          const newBoardVersion = prevState.boardVersion + 1;
          
          debugLog.log('[Click] Returning new state, boardVersion:', newBoardVersion, 'moveHistory length:', newMoveHistory.length);
          debugLog.log('[Click] State details:', {
            gameMode: prevState.gameMode,
            result,
            newTurn: newChess.getTurn(),
            cpuColor: prevState.cpuColor,
            isVsCpu: prevState.gameMode === 'vs-cpu',
            noResult: !result,
            isCpuTurn: newChess.getTurn() === prevState.cpuColor
          });
          
          // Trigger CPU move if it's vs-cpu mode and now it's CPU's turn
          const shouldTriggerCPU = prevState.gameMode === 'vs-cpu' && !result && newChess.getTurn() === prevState.cpuColor;
          debugLog.log('[Click] Should trigger CPU?', shouldTriggerCPU);
          
          if (shouldTriggerCPU) {
            debugLog.log('[Click] ✅ Player move complete, triggering CPU move in 100ms...');
            const moveNum = Math.ceil(newMoveHistory.length / 2) + 1;
            const inFlightStatus = cpuMoveInFlight.current;
            setTimeout(() => {
              persistentLogger.info('Player move - CPU trigger scheduled', { 
                moveNum,
                inFlightBefore: inFlightStatus 
              });
            }, 0);
            // Use setTimeout to ensure state update completes first
            setTimeout(() => {
              debugLog.log('[Click] ⏰ Timer fired, calling makeCPUMove now, cpuMoveInFlight:', cpuMoveInFlight.current);
              persistentLogger.info('CPU trigger timer fired', { inFlight: cpuMoveInFlight.current });
              makeCPUMove();
            }, 100);
          } else {
            debugLog.log('[Click] ❌ NOT triggering CPU move');
          }
          
          // Return completely new state object with NEW chess instance - PRESERVE ALL STATE
          return {
            ...prevState, // Preserve all state fields
            chess: newChess, // NEW chess instance - React will detect the change!
            selectedSquare: null,
            legalMoves: [],
            gameResult: result,
            moveHistory: newMoveHistory,
            boardVersion: newBoardVersion,
            isThinking: false,
            cpuError: null,
            capturedPieces: updatedCapturedPieces,
            recentCapture: newRecentCapture,
          };
        } else {
          debugLog.log('[Click] ❌ Invalid move attempt');
        }
      }

      return prevState;
    });
    
    // Clear recent capture animation after delay (outside setState)
    setTimeout(() => {
      setState(prev => ({ ...prev, recentCapture: null }));
    }, 2000);
  }, [addDebugLog, makeCPUMove]);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionMove) return;
    
    const requestId = moveTracer.generateRequestId();
    
    setState(prevState => {
      const { chess } = prevState;
      const { from, to } = promotionMove;
      
      // Clone chess instance and make the promotion move
      const newChess = chess.clone();
      const move = newChess.makeMove(from, to, piece);
      
      if (move) {
        const fen = newChess.getFEN();
        const pgn = newChess.getPGN();
        const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
        
        const successMsg = `[Promotion] ✅ ${from}→${to}=${piece.toUpperCase()} moveNum=${moveNum}`;
        debugLog.log(successMsg);
        addDebugLog(successMsg);
        
        moveTracer.logPlayerMove(requestId, from, to, fen, pgn, moveNum);
        setTimeout(() => {
          persistentLogger.info('Promotion move', { from, to, promotion: piece, moveNum });
        }, 0);
        
        const newMoveHistory = [...prevState.moveHistory, {
          moveNum,
          player: (chess.getTurn() === 'w' ? 'White' : 'Black') as 'White' | 'Black',
          move: move.san || `${from}-${to}=${piece.toUpperCase()}`,
          fen,
          captured: move.captured // Store captured piece type
        }];

        setLastMove({ from, to });

        const result = newChess.getGameResult();
        if (result) {
          persistentLogger.info('Game ended', { result, totalMoves: newMoveHistory.length });
        }

        return {
          ...prevState,
          chess: newChess,
          selectedSquare: null,
          legalMoves: [],
          gameResult: result,
          moveHistory: newMoveHistory,
          boardVersion: prevState.boardVersion + 1,
        };
      }
      
      return prevState;
    });
    
    // Close promotion modal
    setShowPromotionModal(false);
    setPromotionMove(null);
  }, [promotionMove, addDebugLog]);

  const newGame = () => {
    // Clear any pending timeouts
    if (cpuMoveTimeout.current) {
      clearTimeout(cpuMoveTimeout.current);
    }
    cpuMoveInFlight.current = false;
    
    setState(prevState => {
      const newState = {
        chess: new ChessGame(),
        selectedSquare: null,
        legalMoves: [],
        gameResult: null,
        moveHistory: [],
        boardVersion: prevState.boardVersion + 1,
        gameMode: prevState.gameMode,
        cpuLevel: prevState.cpuLevel,
        cpuColor: prevState.cpuColor,
        isThinking: false,
        cpuError: null,
        moveErrors: [],
        showPlayerProfile: false,
        capturedPieces: {
          red: [],
          black: [],
        },
        recentCapture: null,
      };
      
      debugLog.log('[New Game] Starting with cpuLevel:', prevState.cpuLevel, 'cpuColor:', prevState.cpuColor);
      
      // Start new logging session immediately with correct state
      setTimeout(() => {
        const gameMode = newState.gameMode === 'vs-cpu' ? `vs-cpu-level-${newState.cpuLevel}` : 'two-player';
        persistentLogger.startNewSession(gameMode, newState.gameMode === 'vs-cpu' ? newState.cpuLevel : undefined);
        persistentLogger.info('New game started', { gameMode, cpuLevel: newState.cpuLevel, cpuColor: newState.cpuColor });
      }, 0);
      
      return newState;
    });
    setLastMove(null);
    setIsLearnedPosition(false);
    setShowPromotionModal(false);
    setPromotionMove(null);
    
    debugLog.log('[New Game] Started fresh game');
  };
  
  // Single consolidated CPU move trigger
  useEffect(() => {
    debugLog.log('[CPU Trigger] useEffect fired', {
      gameMode: state.gameMode,
      cpuTurn: state.chess.getTurn(),
      cpuColor: state.cpuColor,
      gameResult: state.gameResult,
      isThinking: state.isThinking,
      inFlight: cpuMoveInFlight.current,
      boardVersion: state.boardVersion
    });

    // Only trigger if it's CPU's turn in CPU mode
    if (state.gameMode !== 'vs-cpu') {
      debugLog.log('[CPU Trigger] Not CPU mode');
      return;
    }
    if (state.chess.getTurn() !== state.cpuColor) {
      debugLog.log('[CPU Trigger] Not CPU turn');
      return;
    }
    if (state.gameResult) {
      debugLog.log('[CPU Trigger] Game ended');
      return;
    }
    if (state.isThinking) {
      debugLog.log('[CPU Trigger] Already thinking');
      return;
    }
    if (cpuMoveInFlight.current) {
      debugLog.log('[CPU Trigger] Move in flight');
      return;
    }

    debugLog.log('[CPU Trigger] ✅ All conditions met, scheduling CPU move...');
    const timer = setTimeout(() => makeCPUMove(), 300);
    
    return () => {
      debugLog.log('[CPU Trigger] Cleanup timer');
      clearTimeout(timer);
    };
  }, [state.boardVersion, state.gameMode, state.cpuColor, state.gameResult, state.isThinking, makeCPUMove]);

  // Initialize persistent logging on component mount
  useEffect(() => {
    setTimeout(() => {
      const gameMode = state.gameMode === 'vs-cpu' ? `vs-cpu-level-${state.cpuLevel}` : 'two-player';
      persistentLogger.startNewSession(gameMode, state.gameMode === 'vs-cpu' ? state.cpuLevel : undefined);
      persistentLogger.info('CoachingMode initialized', { gameMode, cpuLevel: state.cpuLevel, cpuColor: state.cpuColor });
    }, 0);
  }, []); // Only run on mount

  // DEBUG: Log when moveHistory actually changes in state
  useEffect(() => {
    debugLog.log('[State Changed] moveHistory length:', state.moveHistory.length, 'boardVersion:', state.boardVersion);
    debugLog.log('[State Changed] Latest moves:', state.moveHistory.slice(-3));
  }, [state.moveHistory.length, state.boardVersion]);

  const renderSquare = (square: Square) => {
    const piece = state.chess.getPiece(square);
    const isSelected = state.selectedSquare === square;
    const isLegalMove = state.legalMoves.includes(square);
    const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
    
    const isDarkSquare = (square.charCodeAt(0) - 97 + parseInt(square[1])) % 2 === 1;
    
    return (
      <div
        key={square}
        className={`square ${isDarkSquare ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isLegalMove ? 'legal-move' : ''} ${isLastMove ? 'last-move' : ''}`}
        onClick={() => handleSquareClick(square)}
        data-square={square}
      >
        {piece && <div className={`piece ${piece}`}>{getPieceSymbol(piece)}</div>}
        {isLegalMove && <div className="move-indicator"></div>}
      </div>
    );
  };

  const renderBoard = () => {
    const board = [];
    // Flip board when player is black (CPU is white) - player always at bottom
    const isPlayerBlack = state.gameMode === 'vs-cpu' && state.cpuColor === 'w';
    
    if (isPlayerBlack) {
      // Render from rank 1→8 and files h→a (flipped for black player)
      for (let rank = 1; rank <= 8; rank++) {
        for (let file = 7; file >= 0; file--) {
          const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
          board.push(renderSquare(square));
        }
      }
    } else {
      // Standard view: rank 8→1 (white at bottom)
      for (let rank = 8; rank >= 1; rank--) {
        for (let file = 0; file < 8; file++) {
          const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
          board.push(renderSquare(square));
        }
      }
    }
    return board;
  };

  const getPieceSymbol = (piece: string): string => {
    const symbols: { [key: string]: string } = {
      'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
      'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
    };
    return symbols[piece] || '';
  };

  const handleModeChange = (newMode: 'two-player' | 'vs-cpu') => {
    setState(prev => ({
      ...prev,
      gameMode: newMode,
      gameResult: null,
      isThinking: false
    }));
    
    if (newMode === 'vs-cpu') {
      newGame();
    }
  };

  const getCurrentTurnDisplay = () => {
    const currentTurn = state.chess.getTurn();
    if (state.gameMode === 'vs-cpu') {
      if (currentTurn === state.cpuColor) {
        return `Current Turn: ${currentTurn === 'w' ? 'White' : 'Black'}| Mode: vs CPU Level ${state.cpuLevel} | 🤖 CPU (${state.cpuColor === 'w' ? 'White' : 'Black'}) vs 👤 You (${state.cpuColor === 'w' ? 'Black' : 'White'})`;
      } else {
        return `Current Turn: ${currentTurn === 'w' ? 'White' : 'Black'}| Mode: vs CPU Level ${state.cpuLevel} | 👤 You (${state.cpuColor === 'w' ? 'Black' : 'White'}) vs 🤖 CPU (${state.cpuColor === 'w' ? 'White' : 'Black'})`;
      }
    } else {
      return `Current Turn: ${currentTurn === 'w' ? 'White' : 'Black'} | Mode: Two Player`;
    }
  };

  return (
    <div className="coaching-mode">
      <div className="coaching-header">
        <h1>👑 Coaching Mode</h1>
        
        <div className="mode-controls">
          <button 
            onClick={() => handleModeChange('two-player')}
            className={`mode-btn ${state.gameMode === 'two-player' ? 'active' : ''}`}
            disabled={state.isThinking}
          >
            👥 2 Player
          </button>
          <button 
            onClick={() => handleModeChange('vs-cpu')}
            className={`mode-btn ${state.gameMode === 'vs-cpu' ? 'active' : ''}`}
            disabled={state.isThinking}
          >
            👑 vs CPU
          </button>
          
          {state.gameMode === 'vs-cpu' && (
            <select 
              value={state.cpuLevel}
              onChange={(e) => {
                const newLevel = parseInt(e.target.value);
                debugLog.log('[Difficulty Change] Setting cpuLevel to:', newLevel);
                setState(prev => {
                  debugLog.log('[Difficulty Change] Previous cpuLevel:', prev.cpuLevel, '→ New:', newLevel);
                  return { ...prev, cpuLevel: newLevel };
                });
              }}
              className="difficulty-select"
              disabled={state.isThinking}
              aria-label="CPU Difficulty Level"
            >
              <option value={1}>Level 1 - Beginner</option>
              <option value={2}>Level 2 - Easy</option>
              <option value={3}>Level 3 - Novice</option>
              <option value={4}>Level 4 - Intermediate</option>
              <option value={5}>Level 5 - Advanced</option>
              <option value={6}>Level 6 - Expert</option>
              <option value={7}>Level 7 - Master</option>
              <option value={8}>Level 8 - Grandmaster</option>
            </select>
          )}
          
          {state.gameMode === 'vs-cpu' && (
            <div className="color-indicator">
              👤 You play {state.cpuColor === 'w' ? 'Black' : 'White'} • 🤖 CPU plays {state.cpuColor === 'w' ? 'White' : 'Black'}
            </div>
          )}
        </div>

        <div className="game-status">
          {getCurrentTurnDisplay()}
        </div>

        <div className="game-controls">
          <button 
            onClick={newGame}
            className="control-btn new-game"
            disabled={state.isThinking}
          >
            🔄 New Game
          </button>
          <button 
            onClick={() => setShowOpeningsModal(true)}
            className="control-btn"
            disabled={state.isThinking}
          >
            📚 Openings
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, showPlayerProfile: true }))}
            className="control-btn"
            disabled={state.isThinking}
          >
            📊 My Profile
          </button>
          {state.gameMode === 'vs-cpu' && !state.gameResult && state.moveHistory.length >= 2 && (
            <button 
              onClick={() => {
                const concedeResult = state.cpuColor === 'w' 
                  ? 'You conceded - White wins' 
                  : 'You conceded - Black wins';
                setState(prev => ({
                  ...prev,
                  gameResult: concedeResult,
                  isThinking: false
                }));
                debugLog.log('[Concede] Game conceded:', concedeResult);
                persistentLogger.info('Game conceded by player', { 
                  moveCount: state.moveHistory.length,
                  result: concedeResult 
                });
              }}
              className="control-btn concede-btn"
              disabled={state.isThinking}
              style={{
                background: '#e53935',
                color: 'white',
                fontWeight: '600',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#c62828'}
              onMouseOut={(e) => e.currentTarget.style.background = '#e53935'}
              title="Concede this game and allow Wall-E to learn from it"
            >
              🏳️ Concede
            </button>
          )}
          {state.gameMode === 'vs-cpu' && (
            <button 
              onClick={() => {
                debugLog.log('[CPU Move] 🛑 Force move requested by user');
                setForceMovePending(true);
              }}
              className="control-btn"
              disabled={!state.isThinking}
              style={{
                background: state.isThinking ? '#f57c00' : '#9e9e9e',
                color: 'white',
                fontWeight: '600',
              }}
              onMouseOver={(e) => {
                if (state.isThinking) e.currentTarget.style.background = '#e65100';
              }}
              onMouseOut={(e) => {
                if (state.isThinking) e.currentTarget.style.background = '#f57c00';
              }}
              title={state.isThinking ? 'Force CPU to use local fallback immediately' : 'Available during CPU thinking'}
            >
              ⚡ Force Move
            </button>
          )}
        </div>
        
        {state.gameMode === 'vs-cpu' && (
          <div className="cpu-difficulty">
            <label>CPU Difficulty: </label>
            <select 
              value={state.cpuLevel}
              onChange={(e) => {
                const newLevel = parseInt(e.target.value);
                debugLog.log('[Difficulty Change] Setting cpuLevel to:', newLevel);
                setState(prev => {
                  debugLog.log('[Difficulty Change] Previous cpuLevel:', prev.cpuLevel, '→ New:', newLevel);
                  return { ...prev, cpuLevel: newLevel };
                });
              }}
              disabled={state.isThinking}
              aria-label="CPU Difficulty Setting"
            >
              <option value={1}>1 - Beginner</option>
              <option value={2}>2 - Easy</option>
              <option value={3}>3 - Novice</option>
              <option value={4}>4 - Casual</option>
              <option value={5}>5 - Intermediate</option>
              <option value={6}>6 - Advanced</option>
              <option value={7}>7 - Expert</option>
              <option value={8}>8 - Master</option>
            </select>
          </div>
        )}
      </div>

      <div className="practice-content">
        <div className="coaching-board-container">
          <div className={`chess-board-practice ${state.gameMode === 'vs-cpu' && state.chess.getTurn() === state.cpuColor ? 'cpu-turn' : ''}`} key={state.boardVersion}>
            {renderBoard()}
          </div>
        </div>
        
        {/* Captured Pieces Display - RIGHT SIDE */}
        <CapturedPieces 
          capturedPieces={state.capturedPieces}
          recentCapture={state.recentCapture}
        />
      </div>

      {/* CPU Error Banner */}
      {state.cpuError && (
        <div className="cpu-error-banner" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#ff5252',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: '400px',
          zIndex: 1000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong>CPU Error</strong>
              <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{state.cpuError}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              onClick={() => {
                setState(prev => ({ ...prev, cpuError: null }));
                makeCPUMove();
              }}
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#ff5252',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🔄 Retry
            </button>
            <button 
              onClick={newGame}
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#ff5252',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🆕 New Game
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, cpuError: null }))}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Learned Position Indicator */}
      {isLearnedPosition && (
        <div className="learned-position-banner" style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          maxWidth: '350px',
          zIndex: 1000,
          animation: 'slideInLeft 0.4s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🧠</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '16px' }}>Learned Position!</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                CPU is using knowledge from previous games
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Thinking Indicator */}
      {state.isThinking && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 999,
        }}>
          <div className="spinner" style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}></div>
          <span>CPU is thinking...</span>
        </div>
      )}

      {/* Debug Section */}
      <div className="debug-section">
        <h3>🔬 Debug: Test post-game analysis modal:</h3>
        <button 
          onClick={() => setShowTroubleshootingPanel(true)}
          className="test-btn"
        >
          Show Analytics Panel
        </button>
        
        {/* Show last move source */}
        {state.moveHistory.length > 0 && state.moveHistory[state.moveHistory.length - 1].source && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Last CPU Move Source:</strong>
            <pre style={{ fontSize: '12px', margin: '5px 0 0' }}>
              {JSON.stringify(state.moveHistory[state.moveHistory.length - 1].source, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Enhanced Troubleshooting Panel */}
      {showTroubleshootingPanel && (
        <div className="debug-panel-overlay">
          <div className="debug-panel-enhanced">
            <div className="debug-panel-header">
              <h2>🔧 Advanced Debug Panel</h2>
              <div className="debug-header-actions">
                <button
                  onClick={() => {
                    // Collect comprehensive diagnostic data
                    const diagnosticData = {
                      timestamp: new Date().toISOString(),
                      gameState: {
                        mode: state.gameMode,
                        cpuLevel: state.cpuLevel,
                        cpuColor: state.cpuColor,
                        moveCount: state.moveHistory.length,
                        isThinking: state.isThinking,
                        currentFEN: state.chess.getFEN(),
                      },
                      performance: {
                        lastWorkerMetadata: lastWorkerMetadata,
                        engineFeatures: typeof window !== 'undefined' && (window as any).gameStore 
                          ? (window as any).gameStore.getState().debugInfo?.engineFeatures 
                          : {},
                        featureErrors: typeof window !== 'undefined' && (window as any).gameStore 
                          ? (window as any).gameStore.getState().debugInfo?.featureErrors 
                          : {},
                        workerStats: {
                          totalAttempts: workerStats.totalAttempts,
                          successCount: workerStats.successCount,
                          timeoutCount: workerStats.timeoutCount,
                          fallbackCount: workerStats.fallbackCount,
                          successRate: workerStats.totalAttempts > 0 
                            ? (workerStats.successCount / workerStats.totalAttempts * 100).toFixed(1) + '%'
                            : 'N/A',
                          avgSuccessTime: Math.round(workerStats.avgSuccessTime) + 'ms',
                          avgFallbackTime: Math.round(workerStats.avgFallbackTime) + 'ms',
                          lastTimeout: workerStats.lastTimeout,
                          recentMoves: workerStats.recentMoves.slice(-10),
                        },
                      },
                      recentMoves: state.moveHistory.slice(-10),
                      localStorage: {
                        debug: localStorage.getItem('debug'),
                        trainingDataCount: localStorage.getItem('trainingData') ? JSON.parse(localStorage.getItem('trainingData') || '[]').length : 0,
                      },
                      bundle: {
                        scripts: Array.from(document.scripts).map(s => s.src).filter(src => src.includes('index-') || src.includes('cpuWorker-')),
                      }
                    };

                    // Copy to clipboard
                    const diagnosticText = JSON.stringify(diagnosticData, null, 2);
                    navigator.clipboard.writeText(diagnosticText).then(() => {
                      debugLog.log('🔧 FULL DIAGNOSTIC DATA:', diagnosticData);
                      alert('✅ Diagnostic data copied to clipboard!\n\n' + 
                        'Data includes:\n' +
                        '• Current game state\n' +
                        '• Worker performance metrics\n' +
                        '• Feature activation status\n' +
                        '• Recent move history\n' +
                        '• Bundle versions loaded\n\n' +
                        'Paste this data to diagnose CPU performance issues.\n\n' +
                        'Also check the console for detailed logs.');
                      
                      // Enable debug mode for next session
                      localStorage.setItem('debug', 'true');
                    }).catch(() => {
                      alert('Data logged to console. Check Developer Tools → Console tab.');
                      debugLog.log('🔧 FULL DIAGNOSTIC DATA:', diagnosticData);
                      localStorage.setItem('debug', 'true');
                    });
                  }}
                  title="Export comprehensive diagnostic data and enable debug mode"
                  style={{ 
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    fontWeight: 'bold',
                    marginRight: '10px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🐛 Export Diagnostics
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('debug', 'true');
                    alert('Debug mode enabled! Page will refresh.\n\nAfter refresh, make a CPU move and check console for:\n• Worker configuration\n• Feature parameters\n• Timing data');
                    window.location.reload();
                  }}
                  title="Enable debug mode and refresh to show worker logs"
                  style={{ 
                    backgroundColor: '#2196F3',
                    color: 'white',
                    fontWeight: 'bold',
                    marginRight: '10px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Debug & Refresh
                </button>
                <button
                  className="debug-close-btn"
                  onClick={() => setShowTroubleshootingPanel(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="debug-panel-content">
              {/* CPU Status Section */}
              {state.gameMode === 'vs-cpu' && (
                <section className="debug-section">
                  <h4>🤖 CPU Status</h4>
                  <div className="debug-grid">
                    <span className="debug-label">CPU Color:</span>
                    <span className="debug-value">{state.cpuColor === 'w' ? '⚪ White' : '⚫ Black'}</span>
                    
                    <span className="debug-label">Difficulty:</span>
                    <span className="debug-value">Level {state.cpuLevel}</span>
                    
                    <span className="debug-label">Thinking:</span>
                    <span className={`debug-value ${state.isThinking ? 'status-active' : 'status-idle'}`}>
                      {state.isThinking ? '⏳ Yes (Processing...)' : '✓ No (Idle)'}
                    </span>
                    
                    <span className="debug-label">In Flight:</span>
                    <span className={`debug-value ${cpuMoveInFlight.current ? 'status-warning' : 'status-success'}`}>
                      {cpuMoveInFlight.current ? '🔒 Locked' : '🔓 Ready'}
                    </span>
                    
                    <span className="debug-label">Last Error:</span>
                    <span className={`debug-value ${state.cpuError ? 'status-error' : 'status-success'}`}>
                      {state.cpuError ? '❌ Error' : '✓ None'}
                    </span>
                  </div>
                  
                  {state.cpuError && (
                    <div className="debug-error-box">
                      <strong>⚠️ Error Details:</strong>
                      <p>{state.cpuError}</p>
                    </div>
                  )}
                  
                  <div className="debug-actions">
                    <button
                      className="debug-btn debug-btn-primary"
                      onClick={() => {
                        if (state.gameMode === 'vs-cpu' && 
                            state.chess.getTurn() === state.cpuColor && 
                            !state.isThinking &&
                            !cpuMoveInFlight.current) {
                          debugLog.log('[Force CPU Move] Manually triggering CPU move');
                          makeCPUMove();
                        } else {
                          alert('Cannot force CPU move:\n' + 
                                (!state.gameMode ? '- Not in CPU mode\n' : '') +
                                (state.chess.getTurn() !== state.cpuColor ? '- Not CPU\'s turn\n' : '') +
                                (state.isThinking ? '- CPU already thinking\n' : '') +
                                (cpuMoveInFlight.current ? '- Move already in flight\n' : ''));
                        }
                      }}
                      disabled={state.isThinking || state.chess.getTurn() !== state.cpuColor || cpuMoveInFlight.current}
                    >
                      🚀 Force CPU Move
                    </button>
                    
                    <button
                      className="debug-btn debug-btn-warning"
                      onClick={() => {
                        if (cpuMoveTimeout.current) {
                          clearTimeout(cpuMoveTimeout.current);
                        }
                        cpuMoveInFlight.current = false;
                        setState(prev => ({ ...prev, isThinking: false, cpuError: null }));
                        alert('CPU state reset!');
                      }}
                    >
                      🔄 Reset CPU State
                    </button>
                  </div>
                </section>
              )}

              {/* Learning Statistics (for levels 7-8) */}
              {state.gameMode === 'vs-cpu' && state.cpuLevel >= 7 && (
                <section className="debug-section" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)' }}>
                  <h4>🧠 Learning Statistics (Level {state.cpuLevel})</h4>
                  <div className="debug-grid">
                    {(() => {
                      const stats = getLearningStats();
                      return (
                        <>
                          <span className="debug-label">Total Games:</span>
                          <span className="debug-value">{stats.totalGames}</span>
                          
                          <span className="debug-label">Wins:</span>
                          <span className="debug-value status-success">{stats.wins}</span>
                          
                          <span className="debug-label">Losses:</span>
                          <span className="debug-value status-error">{stats.losses}</span>
                          
                          <span className="debug-label">Draws:</span>
                          <span className="debug-value">{stats.draws}</span>
                          
                          <span className="debug-label">Overall Win Rate:</span>
                          <span className="debug-value">{stats.winRate}%</span>
                          
                          <span className="debug-label">Level 7 Win Rate:</span>
                          <span className="debug-value">{stats.level7WinRate}%</span>
                          
                          <span className="debug-label">Level 8 Win Rate:</span>
                          <span className="debug-value">{stats.level8WinRate}%</span>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
                    💡 The CPU learns from each game and improves over time
                  </div>
                </section>
              )}
              
              {/* Worker Performance Statistics */}
              <section className="debug-section">
                <h4>⚙️ Worker Performance Monitor</h4>
                <div className="debug-grid">
                  <span className="debug-label">Total Attempts:</span>
                  <span className="debug-value">{workerStats.totalAttempts}</span>
                  
                  <span className="debug-label">Success Rate:</span>
                  <span className={`debug-value ${
                    workerStats.totalAttempts === 0 ? 'status-idle' :
                    (workerStats.successCount / workerStats.totalAttempts) >= 0.95 ? 'status-success' :
                    (workerStats.successCount / workerStats.totalAttempts) >= 0.7 ? 'status-warning' :
                    'status-error'
                  }`}>
                    {workerStats.totalAttempts > 0 
                      ? `${((workerStats.successCount / workerStats.totalAttempts) * 100).toFixed(1)}%`
                      : 'N/A'}
                    {workerStats.totalAttempts > 0 && ` (${workerStats.successCount}/${workerStats.totalAttempts})`}
                  </span>
                  
                  <span className="debug-label">Worker Timeouts:</span>
                  <span className={`debug-value ${
                    workerStats.timeoutCount === 0 ? 'status-success' :
                    workerStats.timeoutCount < 3 ? 'status-warning' :
                    'status-error'
                  }`}>
                    {workerStats.timeoutCount === 0 ? '✓ None' : `⚠️ ${workerStats.timeoutCount} timeouts`}
                  </span>
                  
                  <span className="debug-label">Fallback Usage:</span>
                  <span className={`debug-value ${
                    workerStats.fallbackCount === 0 ? 'status-success' :
                    workerStats.fallbackCount < 3 ? 'status-warning' :
                    'status-error'
                  }`}>
                    {workerStats.fallbackCount === 0 ? '✓ Not needed' : `${workerStats.fallbackCount} times`}
                  </span>
                  
                  <span className="debug-label">Avg Success Time:</span>
                  <span className={`debug-value ${
                    workerStats.avgSuccessTime === 0 ? 'status-idle' :
                    workerStats.avgSuccessTime < 2000 ? 'status-success' :
                    workerStats.avgSuccessTime < 2500 ? 'status-warning' :
                    'status-error'
                  }`}>
                    {workerStats.successCount > 0 ? `${Math.round(workerStats.avgSuccessTime)}ms` : 'N/A'}
                  </span>
                  
                  <span className="debug-label">Avg Fallback Time:</span>
                  <span className="debug-value">
                    {workerStats.fallbackCount > 0 ? `${Math.round(workerStats.avgFallbackTime)}ms` : 'N/A'}
                  </span>
                  
                  <span className="debug-label">Last Timeout:</span>
                  <span className={`debug-value ${workerStats.lastTimeout ? 'status-warning' : 'status-success'}`}>
                    {workerStats.lastTimeout 
                      ? new Date(workerStats.lastTimeout).toLocaleTimeString()
                      : '✓ Never'}
                  </span>
                </div>
                
                {/* Performance warnings */}
                {workerStats.totalAttempts > 3 && (
                  <div style={{ marginTop: '12px' }}>
                    {workerStats.timeoutCount > 0 && (
                      <div style={{
                        padding: '8px 12px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}>
                        <strong>⚠️ Timeout Alert:</strong> Worker has timed out {workerStats.timeoutCount} times.
                        {workerStats.timeoutCount >= 3 && (
                          <span> This indicates minDepth is too high for the 2500ms timeout. Consider reducing difficulty level.</span>
                        )}
                      </div>
                    )}
                    
                    {workerStats.successCount > 0 && workerStats.avgSuccessTime > 2300 && (
                      <div style={{
                        padding: '8px 12px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}>
                        <strong>⚠️ Performance Warning:</strong> Average worker time ({Math.round(workerStats.avgSuccessTime)}ms) is close to timeout threshold (2500ms). Risk of future timeouts.
                      </div>
                    )}
                    
                    {(workerStats.successCount / workerStats.totalAttempts) < 0.7 && (
                      <div style={{
                        padding: '8px 12px',
                        background: '#f8d7da',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <strong>🚨 Critical:</strong> Worker success rate is below 70%. This indicates a systematic issue. Check console for errors.
                      </div>
                    )}
                  </div>
                )}
              </section>
              
              {/* Recent Move Performance */}
              {workerStats.recentMoves.length > 0 && (
                <section className="debug-section">
                  <h4>📊 Recent Move Performance (Last {Math.min(10, workerStats.recentMoves.length)})</h4>
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                        <tr>
                          <th style={{ padding: '4px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Time</th>
                          <th style={{ padding: '4px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Lvl</th>
                          <th style={{ padding: '4px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Status</th>
                          <th style={{ padding: '4px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Time (ms)</th>
                          <th style={{ padding: '4px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Depth</th>
                          <th style={{ padding: '4px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerStats.recentMoves.slice(-10).reverse().map((move, idx) => (
                          <tr key={idx} style={{ 
                            background: move.success ? '#d4edda' : '#f8d7da',
                            borderBottom: '1px solid #dee2e6'
                          }}>
                            <td style={{ padding: '4px' }}>
                              {new Date(move.timestamp).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              {move.level}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              {move.success ? '✓' : '✗'}
                            </td>
                            <td style={{ 
                              padding: '4px', 
                              textAlign: 'right',
                              color: move.timeMs > 2500 ? '#dc3545' : move.timeMs > 2000 ? '#ffc107' : '#28a745'
                            }}>
                              {Math.round(move.timeMs)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              {move.depth}
                            </td>
                            <td style={{ padding: '4px', fontSize: '11px' }}>
                              {move.source.replace('_', ' ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              
              {/* Worker Telemetry Section - Last Move Details */}
              {lastWorkerMetadata && (
                <section className="debug-section">
                  <h4>🔍 Last Move Details</h4>
                  <div className="debug-grid">
                    <span className="debug-label">Source:</span>
                    <span className="debug-value">{lastWorkerMetadata.source}</span>
                    
                    <span className="debug-label">Depth Reached:</span>
                    <span className="debug-value">{lastWorkerMetadata.depthReached}</span>
                    
                    <span className="debug-label">Time (ms):</span>
                    <span className="debug-value">{Math.round(lastWorkerMetadata.timeMs)}ms</span>
                    
                    <span className="debug-label">Slices:</span>
                    <span className="debug-value">{lastWorkerMetadata.sliceCount}</span>
                    
                    <span className="debug-label">Complete:</span>
                    <span className={`debug-value ${lastWorkerMetadata.complete ? 'status-success' : 'status-warning'}`}>
                      {lastWorkerMetadata.complete ? '✓ Yes' : '⏱️ Partial'}
                    </span>
                  </div>
                  
                  {lastWorkerMetadata.tacticalSafety && (
                    <div className="debug-tactical-box">
                      <strong>🎯 Tactical Safety:</strong>
                      <p>Rejected {lastWorkerMetadata.tacticalSafety.rejectedMoves} unsafe moves</p>
                      {lastWorkerMetadata.tacticalSafety.reasons.length > 0 && (
                        <ul>
                          {lastWorkerMetadata.tacticalSafety.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Game State Section */}
              <section className="debug-section">
                <h4>🎮 Game State</h4>
                <div className="debug-grid">
                  <span className="debug-label">Mode:</span>
                  <span className="debug-value">
                    {state.gameMode === 'vs-cpu' ? '🤖 vs CPU' : '👥 Two Player'}
                  </span>
                  
                  <span className="debug-label">Current Turn:</span>
                  <span className={`debug-value ${state.chess.getTurn() === 'w' ? 'turn-white' : 'turn-black'}`}>
                    {state.chess.getTurn() === 'w' ? '⚪ White' : '⚫ Black'}
                  </span>
                  
                  <span className="debug-label">Total Moves:</span>
                  <span className="debug-value">{state.moveHistory.length}</span>
                  
                  <span className="debug-label">Board Version:</span>
                  <span className="debug-value">#{state.boardVersion}</span>
                  
                  <span className="debug-label">Game Status:</span>
                  <span className={`debug-value ${state.gameResult ? 'status-warning' : 'status-success'}`}>
                    {state.gameResult || '▶️ Active'}
                  </span>
                </div>
              </section>

              {/* Move History with Success/Errors */}
              <section className="debug-section">
                <h4>📜 Move History ({state.moveHistory.length} moves)</h4>
                <div className="debug-move-history">
                  {state.moveHistory.length === 0 ? (
                    <p className="debug-empty">No moves recorded yet</p>
                  ) : (
                    <div className="debug-move-list">
                      {state.moveHistory.map((move, idx) => (
                        <div key={idx} className="debug-move-item success">
                          <span className="move-number">#{move.moveNum}</span>
                          <span className="move-player">
                            {move.player === 'White' ? '⚪' : '⚫'} {move.player}
                          </span>
                          <span className="move-notation">{move.move}</span>
                          {move.source && (
                            <span className="move-source" title={JSON.stringify(move.source)}>
                              {move.source.type === 'vault_opening' ? '📚' : 
                               move.source.type === 'vault_heuristic' ? '🧠' : '🎲'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Move Errors Section */}
              {state.moveErrors.length > 0 && (
                <section className="debug-section">
                  <h4>❌ Move Errors ({state.moveErrors.length})</h4>
                  <div className="debug-error-list">
                    {state.moveErrors.slice(-10).reverse().map((error, idx) => (
                      <div key={idx} className="debug-error-item">
                        <span className="error-time">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="error-move">
                          {error.from && error.to ? `${error.from}→${error.to}` : 'N/A'}
                        </span>
                        <span className="error-reason">{error.reason}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Position Details */}
              <section className="debug-section">
                <h4>📍 Position Details</h4>
                <div className="debug-mono-box">
                  <div className="mono-label">FEN:</div>
                  <div className="mono-value">{state.chess.getFEN()}</div>
                  <div className="mono-label">PGN:</div>
                  <div className="mono-value">{state.chess.getPGN() || '(no moves)'}</div>
                </div>
              </section>

              {/* Debug Actions */}
              <section className="debug-section">
                <h4>🛠️ Debug Actions</h4>
                <div className="debug-button-grid">
                  <button
                    className="debug-btn debug-btn-info"
                    onClick={() => {
                      const debugData = {
                        gameMode: state.gameMode,
                        cpuColor: state.cpuColor,
                        cpuLevel: state.cpuLevel,
                        currentTurn: state.chess.getTurn(),
                        isThinking: state.isThinking,
                        cpuInFlight: cpuMoveInFlight.current,
                        moveCount: state.moveHistory.length,
                        boardVersion: state.boardVersion,
                        gameResult: state.gameResult,
                        cpuError: state.cpuError,
                        lastError: state.moveErrors[state.moveErrors.length - 1] || null,
                        fen: state.chess.getFEN(),
                        pgn: state.chess.getPGN(),
                        moveHistory: state.moveHistory.map(m => `${m.moveNum}. ${m.player}: ${m.move}`),
                        allErrors: state.moveErrors
                      };
                      
                      const debugText = JSON.stringify(debugData, null, 2);
                      
                      navigator.clipboard.writeText(debugText).then(() => {
                        alert('✅ Complete debug data copied to clipboard!\n\nPaste it in your message.');
                      }).catch(() => {
                        console.error('Failed to copy. Here is the data:', debugText);
                        alert('❌ Copy failed. Check console for data.');
                      });
                    }}
                  >
                    📋 Copy Debug Data
                  </button>
                  
                  <button
                    className="debug-btn debug-btn-success"
                    onClick={() => {
                      navigator.clipboard.writeText(state.chess.getPGN());
                      alert('PGN copied to clipboard!');
                    }}
                  >
                    📝 Copy PGN
                  </button>
                  
                  <button
                    className="debug-btn debug-btn-success"
                    onClick={() => {
                      navigator.clipboard.writeText(state.chess.getFEN());
                      alert('FEN copied to clipboard!');
                    }}
                  >
                    🎯 Copy FEN
                  </button>
                  
                  <button
                    className="debug-btn debug-btn-warning"
                    onClick={() => {
                      const debugInfo = {
                        gameMode: state.gameMode,
                        cpuColor: state.cpuColor,
                        cpuLevel: state.cpuLevel,
                        isThinking: state.isThinking,
                        moveCount: state.moveHistory.length,
                        errors: state.moveErrors.length,
                        fen: state.chess.getFEN(),
                        pgn: state.chess.getPGN(),
                      };
                      navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                      alert('Debug info copied to clipboard!');
                    }}
                  >
                    📦 Export Debug JSON
                  </button>
                  
                  <button
                    className="debug-btn debug-btn-danger"
                    onClick={() => {
                      if (confirm('Clear all error history?')) {
                        setState(prev => ({ ...prev, moveErrors: [] }));
                      }
                    }}
                  >
                    🗑️ Clear Errors
                  </button>
                </div>
              </section>

              {/* LIVE CONSOLE LOG VIEWER */}
              <section className="troubleshooting-section">
                <h3 className="section-title">📜 LIVE EVENT LOG (Last 20)</h3>
                <div style={{ 
                  background: '#000', 
                  color: '#0f0', 
                  fontFamily: 'monospace', 
                  fontSize: '11px', 
                  padding: '12px', 
                  borderRadius: '6px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #333'
                }}>
                  {debugLogs.length === 0 ? (
                    <div style={{ color: '#666' }}>No events yet. Click pieces to see logs...</div>
                  ) : (
                    debugLogs.map((log, i) => (
                      <div key={i} style={{ 
                        marginBottom: '4px',
                        color: log.includes('SUCCESS') ? '#0f0' : log.includes('BLOCKED') ? '#f00' : '#0ff'
                      }}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    className="debug-btn debug-btn-success"
                    onClick={() => {
                      navigator.clipboard.writeText(debugLogs.join('\n'));
                      alert('✅ Event logs copied!');
                    }}
                  >
                    📋 Copy Logs
                  </button>
                  <button
                    className="debug-btn debug-btn-danger"
                    onClick={() => setDebugLogs([])}
                  >
                    🗑️ Clear Logs
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {state.gameResult && !showCoachingAnalysis && (
        <div className="game-over-modal">
          <div className="modal-content">
            <h2>🎉 Game Over!</h2>
            <p>{state.gameResult}</p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button 
                onClick={newGame} 
                className="play-again-btn"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🔄 Play Again
              </button>
              <button 
                onClick={() => setShowCoachingAnalysis(true)}
                className="analysis-btn"
                style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🎓 View Coaching Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoachingAnalysis && (
        <PostGameCoaching
          moveHistory={state.moveHistory.map(m => ({ move: m.move, fen: m.fen }))}
          playerColor={state.gameMode === 'vs-cpu' ? (state.cpuColor === 'w' ? 'b' : 'w') : 'w'}
          gameResult={state.gameResult || 'Game Over'}
          onClose={() => {
            setShowCoachingAnalysis(false);
            newGame();
          }}
        />
      )}

      {/* Player Profile Modal */}
      {state.showPlayerProfile && (
        <PlayerProfile
          onClose={() => setState(prev => ({ ...prev, showPlayerProfile: false }))}
        />
      )}

      {/* Openings Modal */}
      {showOpeningsModal && (
        <OpeningsModal
          open={showOpeningsModal}
          onClose={() => setShowOpeningsModal(false)}
        />
      )}

      {/* Pawn Promotion Modal */}
      {showPromotionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
          }}>
            <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '24px' }}>
              🎉 Promote Your Pawn!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '30px', fontSize: '16px' }}>
              Choose which piece your pawn becomes:
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={() => handlePromotionChoice('q')}
                style={{
                  background: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '20px',
                  fontSize: '48px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Queen (Recommended)"
              >
                {state.chess.getTurn() === 'w' ? '♕' : '♛'}
              </button>
              <button
                onClick={() => handlePromotionChoice('r')}
                style={{
                  background: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '20px',
                  fontSize: '48px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Rook"
              >
                {state.chess.getTurn() === 'w' ? '♖' : '♜'}
              </button>
              <button
                onClick={() => handlePromotionChoice('b')}
                style={{
                  background: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '20px',
                  fontSize: '48px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Bishop"
              >
                {state.chess.getTurn() === 'w' ? '♗' : '♝'}
              </button>
              <button
                onClick={() => handlePromotionChoice('n')}
                style={{
                  background: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '20px',
                  fontSize: '48px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Knight"
              >
                {state.chess.getTurn() === 'w' ? '♘' : '♞'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};