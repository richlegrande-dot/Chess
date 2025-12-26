// Coaching Mode Component - Enhanced with Production Safety

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Square } from 'chess.js';
import { ChessGame } from '../lib/chess';
import { moveTracer } from '../lib/tracing';
import { persistentLogger } from '../utils/persistentLogger';
import { findBestMoveWithLearning, recordGameForLearning, getLearningStats } from '../lib/learningAI';
import { PostGameCoaching } from './PostGameCoaching';
import { PlayerProfile } from './PlayerProfile';
import { getCpuWorkerClient } from '../lib/cpu/cpuWorkerClient';
import { getLevelConfig, getTimeBudget, getTotalTimeout } from '../lib/cpu/cpuConfig';
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
    moveErrors: [],
  }));

  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [showTroubleshootingPanel, setShowTroubleshootingPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showCoachingAnalysis, setShowCoachingAnalysis] = useState(false);
  const [isLearnedPosition, setIsLearnedPosition] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);
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
      console.warn('[CPU Move] ⚠️ Request already in flight, skipping duplicate');
      persistentLogger.error('CPU move blocked - already in flight', { inFlight: cpuMoveInFlight.current });
      return;
    }

    console.log('[CPU Move] 🚀 Starting CPU move...');
    cpuMoveInFlight.current = true;
    persistentLogger.info('CPU move triggered', { inFlight: true });
    
    const requestId = moveTracer.generateRequestId();
    const startTime = Date.now();
    
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
    
    console.log(`[CPU Move] Scheduling setTimeout callback in ${Math.round(thinkingTime)}ms...`);
    persistentLogger.info('CPU move - setTimeout scheduled', { 
      delayMs: Math.round(thinkingTime),
      cpuLevel: capturedCpuLevel 
    });
    
    setTimeout(async () => {
      timerFired = true;
      clearTimeout(watchdogTimeout);
      
      console.log('[CPU Move] ✅ setTimeout callback EXECUTING');
      persistentLogger.info('CPU move - callback executing', { 
        elapsed: Math.round(performance.now() - perfStart) 
      });
      
      try {
        const afterDelay = performance.now();
        console.log('[CPU Move] Timer fired after', Math.round(afterDelay - perfStart), 'ms, getting state...');
        
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

      console.log('[CPU Move] State captured:', { gameMode, cpuColor, turn: chess.getTurn(), gameResult });
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
        console.log('[CPU Move] Skipping - conditions not met');
        setState(prev => ({ ...prev, isThinking: false }));
        return;
      }

      const fen = chess.getFEN();
      const pgn = chess.getPGN();
      const plyCount = moveHistory.length;
      const moveNum = Math.ceil(plyCount / 2) + 1;

      const aiStart = performance.now();
      console.log('[CPU Move] Starting move selection at', Math.round(aiStart - perfStart), 'ms from start...');
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

      console.log('[CPU Move] Found', allMoves.length, 'legal moves');
      // Reduced logging during AI calculation to prevent event loop blocking
      // persistentLogger.info('CPU move - found legal moves', { count: allMoves.length });

      // ENHANCED: Analyze position criticality to determine depth adjustments
      const { analyzePositionCriticality } = await import('../lib/positionCriticality');
      
      const criticality = analyzePositionCriticality(chess);
      console.log(`[CPU Move] Position criticality: ${criticality.score}/100 (${criticality.isCritical ? 'CRITICAL' : 'normal'})`, criticality.reasons);
      
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
        
        console.log(`[CPU Move] Level ${cpuLevel}: depth ${searchDepth} (min: ${levelConfig.minDepth}, target: ${levelConfig.targetDepth}, cap: ${levelConfig.hardCap}), time ${allocatedTime}ms`);
        console.log(`[CPU Move] Config: beam=${levelConfig.beamWidth}, quiescence=${levelConfig.useQuiescence}, aspiration=${levelConfig.useAspiration}, tactical=${levelConfig.tacticalScan}`);
        
        // ENHANCED: Use Web Worker for off-thread computation (prevents UI blocking)
        const useWorker = cpuLevel >= 3; // Use worker for levels 3+
        const currentMoveHistory = moveHistory.map((m: any) => m.move || m);
        
        // LEARNING INTEGRATION: Get teaching opportunities
        let learningContext;
        try {
          const { getTeachingOpportunities } = await import('../lib/cpu/learningIntegration');
          const opportunities = getTeachingOpportunities(chess, cpuLevel);
          if (opportunities.userSignatures.length > 0) {
            learningContext = {
              userSignatures: opportunities.userSignatures.map(sig => ({
                category: sig.category,
                title: sig.title,
                confidenceScore: sig.confidenceScore,
                masteryScore: sig.masteryScore,
                occurrences: sig.occurrences
              })),
              gamesPlayed: opportunities.userSignatures.length
            };
            console.log(`[Learning] Teaching ${learningContext.userSignatures.length} patterns this move`);
          }
        } catch (error) {
          console.log('[Learning] Not available yet:', error);
        }
        
        if (useWorker) {
          console.log('[CPU Move] Using Web Worker for off-thread computation');
          
          const workerClient = getCpuWorkerClient();
          
          try {
            const workerResult = await workerClient.computeMove({
              fen: chess.getFEN(),
              cpuLevel,
              timeLimitMs: allocatedTime,
              minDepth: levelConfig.minDepth,
              maxDepth: levelConfig.hardCap,
              debug: localStorage.getItem('debug') === 'true',
              openingBook: levelConfig.openingBook,  // Pass opening book flag
              useQuiescence: levelConfig.useQuiescence,
              quiescenceDepth: levelConfig.quiescenceMaxDepth,
              beamWidth: levelConfig.beamWidth,
              useAspiration: levelConfig.useAspiration,
              aspirationWindow: levelConfig.aspirationWindow
            });
            
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
                console.warn('[CPU Move] Could not update game store debug info:', err);
              }
            }
            
            if (selectedMove) {
              console.log(`[CPU Move] Worker result: depth ${workerResult.metadata.depthReached}, time ${Math.round(workerElapsed)}ms, source: ${workerResult.metadata.source}`);
            
              if (workerResult.metadata.tacticalSafety) {
                console.log(`[CPU Move] Tactical safety: rejected ${workerResult.metadata.tacticalSafety.rejectedMoves} moves`);
              }
              
              persistentLogger.info('CPU move - worker search completed', {
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
            }
            
          } catch (error) {
            const isTimeout = error instanceof Error && error.message.includes('timeout');
            const errorDetails = {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              type: error instanceof Error ? error.constructor.name : typeof error,
              fullError: error
            };
            console.error('[CPU Move] Worker error, falling back to main thread:', errorDetails);
            persistentLogger.error('Worker computation failed', { error: errorDetails });
            
            // Track timeout/failure stats
            setWorkerStats(prev => ({
              ...prev,
              totalAttempts: prev.totalAttempts + 1,
              timeoutCount: isTimeout ? prev.timeoutCount + 1 : prev.timeoutCount,
              fallbackCount: prev.fallbackCount + 1,
              lastTimeout: isTimeout ? new Date() : prev.lastTimeout,
            }));
            
            // Log to game store debug info
            if (typeof window !== 'undefined' && (window as any).gameStore) {
              try {
                const store = (window as any).gameStore;
                store.getState().logFeatureError('worker', 
                  errorDetails.message,
                  { cpuLevel, fen: chess.getFEN(), levelConfig, errorDetails }
                );
              } catch (err) {
                console.warn('[CPU Move] Could not log worker error to store:', err);
              }
            }
            
            // Fallback to learning AI
            const result = findBestMoveWithLearning(chess, searchDepth, cpuLevel, currentMoveHistory);
            selectedMove = result.move as { from: Square; to: Square };
            actualSearchDepth = result.searchDepth || searchDepth;
            moveSource = result.source;
            
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
          }
          
          // Show learned position indicator if applicable
          if (moveSource.includes('learned')) {
            setIsLearnedPosition(true);
            setTimeout(() => setIsLearnedPosition(false), 3000);
          }
        } else {
          // Use learning AI on main thread for low levels (1-2)
          const result = findBestMoveWithLearning(chess, searchDepth, cpuLevel, currentMoveHistory);
          selectedMove = result.move as { from: Square; to: Square };
          actualSearchDepth = result.searchDepth || searchDepth;
          moveSource = result.source;
          
          if (selectedMove) {
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
      console.log('[CPU Move] Selected:', selectedMove.from, '→', selectedMove.to, 'time:', Math.round(aiEnd - perfStart), 'ms');

      // Now apply the move in setState
      setState(prevState => {
        if (!selectedMove) {
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          return { ...prevState, isThinking: false, cpuError: 'No move selected' };
        }

        // CRITICAL FIX: Clone chess instance first (immutable pattern)
        const newChess = prevState.chess.clone();
        
        // Check if CPU needs to promote (always promote to queen)
        const promotion = newChess.isPromotionMove(selectedMove.from, selectedMove.to) ? 'q' : undefined;
        const move = newChess.makeMove(selectedMove.from, selectedMove.to, promotion);

        if (!move) {
          clearTimeout(cpuMoveTimeout.current!);
          cpuMoveInFlight.current = false;
          const fen = prevState.chess.getFEN();
          const pgn = prevState.chess.getPGN();
          const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
          moveTracer.logError(requestId, `Invalid move: ${selectedMove.from}→${selectedMove.to}`, fen, pgn, moveNum);
          console.error('[CPU Move] Invalid move selected!');
          persistentLogger.error('CPU selected invalid move', { from: selectedMove.from, to: selectedMove.to, fen, moveNum });
          return { ...prevState, isThinking: false, cpuError: 'CPU selected invalid move. Please retry.' };
        }

        // Calculate elapsed time
        const elapsed = Date.now() - startTime;
        const finalFen = newChess.getFEN();
        const finalPgn = newChess.getPGN();
        const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
        moveTracer.logCPUResponse(requestId, `${selectedMove.from}→${selectedMove.to}`, finalFen, finalPgn, moveNum, elapsed);

        // Update state
        const newMoveHistory = [...prevState.moveHistory, {
          moveNum,
          player: (prevState.cpuColor === 'w' ? 'White' : 'Black') as 'White' | 'Black',
          move: promotion ? `${selectedMove.from}-${selectedMove.to}=Q` : `${selectedMove.from}-${selectedMove.to}`,
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
            console.log('[LearningAI] Recorded game outcome:', outcome);
          }, 0);
        }

        // Clear timeout and in-flight flag
        clearTimeout(cpuMoveTimeout.current!);
        cpuMoveInFlight.current = false;

        console.log('[CPU Move] ✅ Move completed successfully, turn:', result ? 'game over' : newChess.getTurn());
        console.log('[CPU Move] cpuMoveInFlight reset to:', cpuMoveInFlight.current);
        
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

        return {
          ...prevState,
          chess: newChess, // NEW chess instance - React will detect the change!
          moveHistory: newMoveHistory,
          gameResult: result,
          boardVersion: prevState.boardVersion + 1,
          isThinking: false,
          cpuError: null,
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
        
        setState(prev => ({
          ...prev,
          isThinking: false,
          cpuError: `CPU encountered an error: ${error instanceof Error ? error.message : String(error)}. Please try again.`
        }));
      }
    }, thinkingTime);
  }, [setState, moveTracer, persistentLogger, findBestMoveWithLearning, recordGameForLearning, setIsLearnedPosition, setLastMove]);

  const addDebugLog = useCallback((msg: string) => {
    console.log(msg);
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
      console.log(logMsg);
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
        console.log(blockMsg);
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
          console.log(switchMsg);
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
        console.log(attemptMsg);
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
        const move = newChess.makeMove(selectedSquare, square);
        
        if (move) {
          // Move successful
          const fen = newChess.getFEN();
          const pgn = newChess.getPGN();
          const moveNum = Math.ceil(prevState.moveHistory.length / 2) + 1;
          
          const successMsg = `[Click] ✅ SUCCESS! ${selectedSquare}→${square} moveNum=${moveNum} newTurn=${newChess.getTurn()} historyLen=${prevState.moveHistory.length}→${prevState.moveHistory.length + 1}`;
          console.log(successMsg);
          addDebugLog(successMsg);
          
          // Log player move (deferred to avoid blocking)
          moveTracer.logPlayerMove(requestId, selectedSquare, square, fen, pgn, moveNum);
          setTimeout(() => {
            persistentLogger.info('Player move', { from: selectedSquare, to: square, moveNum });
          }, 0);
          
          const newMoveHistory = [...prevState.moveHistory, {
            moveNum,
            player: (currentTurn === 'w' ? 'White' : 'Black') as 'White' | 'Black',
            move: `${selectedSquare}-${square}`,
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
                console.log('[LearningAI] Recorded game outcome:', outcome);
              }, 0);
            }
          }
          
          const newBoardVersion = prevState.boardVersion + 1;
          
          console.log('[Click] Returning new state, boardVersion:', newBoardVersion, 'moveHistory length:', newMoveHistory.length);
          console.log('[Click] State details:', {
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
          console.log('[Click] Should trigger CPU?', shouldTriggerCPU);
          
          if (shouldTriggerCPU) {
            console.log('[Click] ✅ Player move complete, triggering CPU move in 100ms...');
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
              console.log('[Click] ⏰ Timer fired, calling makeCPUMove now, cpuMoveInFlight:', cpuMoveInFlight.current);
              persistentLogger.info('CPU trigger timer fired', { inFlight: cpuMoveInFlight.current });
              makeCPUMove();
            }, 100);
          } else {
            console.log('[Click] ❌ NOT triggering CPU move');
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
          };
        } else {
          console.log('[Click] ❌ Invalid move attempt');
        }
      }

      return prevState;
    });
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
        console.log(successMsg);
        addDebugLog(successMsg);
        
        moveTracer.logPlayerMove(requestId, from, to, fen, pgn, moveNum);
        setTimeout(() => {
          persistentLogger.info('Promotion move', { from, to, promotion: piece, moveNum });
        }, 0);
        
        const newMoveHistory = [...prevState.moveHistory, {
          moveNum,
          player: (chess.getTurn() === 'w' ? 'White' : 'Black') as 'White' | 'Black',
          move: `${from}-${to}=${piece.toUpperCase()}`,
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
      };
      
      console.log('[New Game] Starting with cpuLevel:', prevState.cpuLevel, 'cpuColor:', prevState.cpuColor);
      
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
    
    console.log('[New Game] Started fresh game');
  };
  
  // Single consolidated CPU move trigger
  useEffect(() => {
    console.log('[CPU Trigger] useEffect fired', {
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
      console.log('[CPU Trigger] Not CPU mode');
      return;
    }
    if (state.chess.getTurn() !== state.cpuColor) {
      console.log('[CPU Trigger] Not CPU turn');
      return;
    }
    if (state.gameResult) {
      console.log('[CPU Trigger] Game ended');
      return;
    }
    if (state.isThinking) {
      console.log('[CPU Trigger] Already thinking');
      return;
    }
    if (cpuMoveInFlight.current) {
      console.log('[CPU Trigger] Move in flight');
      return;
    }

    console.log('[CPU Trigger] ✅ All conditions met, scheduling CPU move...');
    const timer = setTimeout(() => makeCPUMove(), 300);
    
    return () => {
      console.log('[CPU Trigger] Cleanup timer');
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
    console.log('[State Changed] moveHistory length:', state.moveHistory.length, 'boardVersion:', state.boardVersion);
    console.log('[State Changed] Latest moves:', state.moveHistory.slice(-3));
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
                console.log('[Difficulty Change] Setting cpuLevel to:', newLevel);
                setState(prev => {
                  console.log('[Difficulty Change] Previous cpuLevel:', prev.cpuLevel, '→ New:', newLevel);
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
            onClick={() => alert('Openings feature coming soon!')}
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
        </div>
        
        {state.gameMode === 'vs-cpu' && (
          <div className="cpu-difficulty">
            <label>CPU Difficulty: </label>
            <select 
              value={state.cpuLevel}
              onChange={(e) => {
                const newLevel = parseInt(e.target.value);
                console.log('[Difficulty Change] Setting cpuLevel to:', newLevel);
                setState(prev => {
                  console.log('[Difficulty Change] Previous cpuLevel:', prev.cpuLevel, '→ New:', newLevel);
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
                        engineFeatures: debugInfo.engineFeatures,
                        featureErrors: debugInfo.featureErrors,
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
                      console.log('🔧 FULL DIAGNOSTIC DATA:', diagnosticData);
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
                      console.log('🔧 FULL DIAGNOSTIC DATA:', diagnosticData);
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
                          console.log('[Force CPU Move] Manually triggering CPU move');
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