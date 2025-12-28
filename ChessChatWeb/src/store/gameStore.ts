// Zustand store for game state management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChessGame } from '../lib/chess';
import { api } from '../lib/api';
import {
  AIModelRegistry,
  type AIModel,
  type ChatMessage,
  GameState,
} from '../lib/models';
import { cpuMoveGuard } from '../lib/cpuMoveGuard';
import { turnValidator } from '../lib/turnIntegrityValidator';
import { gameLogger, cpuLogger } from '../lib/logger';

// Chess conversation message interface
export interface ChessConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  moveContext?: string;
}
import type { Square } from 'chess.js';

// Debug info for troubleshooting
export interface DebugInfo {
  lastApiCall: {
    fen: string;
    pgn: string;
    modelId: string;
    timestamp: number;
  } | null;
  lastApiResponse: {
    move: string | null;
    error: string | null;
    latencyMs: number;
    timestamp: number;
  } | null;
  moveHistory: Array<{
    moveNum: number;
    player: 'human' | 'ai';
    move: string;
    fen: string;
    timestamp: number;
  }>;
  // Worker call tracking (Pages → Worker service binding calls)
  workerCalls: Array<{
    timestamp: number;
    endpoint: string;
    method: string;
    success: boolean;
    latencyMs: number;
    error?: string;
    request?: {
      fen?: string;
      difficulty?: number;
      pgn?: string;
    };
    response?: {
      move?: string;
      depthReached?: number;
      evaluation?: number;
    };
  }>;
  // Advanced engine features debugging
  lastWorkerMetadata: {
    depthReached: number;
    timeMs: number;
    sliceCount: number;
    complete: boolean;
    source: string;
    tacticalSafety?: {
      rejectedMoves: number;
      reasons: string[];
    };
    evaluation?: number;
  } | null;
  engineFeatures: {
    quiescence: {
      enabled: boolean;
      maxDepth: number;
      errors: Array<{
        timestamp: number;
        error: string;
        depth: number;
      }>;
    };
    beamSearch: {
      enabled: boolean;
      width: number;
      movesEvaluated: number;
      movesSkipped: number;
    };
    aspiration: {
      enabled: boolean;
      window: number;
      failedHigh: number;
      failedLow: number;
      reSearches: number;
    };
  };
  featureErrors: Array<{
    timestamp: number;
    feature: 'quiescence' | 'beam' | 'aspiration' | 'worker' | 'general';
    error: string;
    context: any;
  }>;
}

// Self-healing info
export interface HealthInfo {
  lastHealthCheck: number;
  isHealthy: boolean;
  issues: string[];
  recoveryAttempts: number;
  lastRecoveryTime: number | null;
}

interface GameStore {
  // Chess game instance
  chess: ChessGame;
  boardVersion: number; // Increments on each move to force re-render

  // Game state
  gameState: GameState;
  isPlayerTurn: boolean;
  isThinking: boolean;
  errorMessage: string | null;
  gameResult: string | null;
  gamePhase: 'opening' | 'middlegame' | 'endgame' | null;

  // Selected model
  selectedModel: AIModel;

  // Chat messages
  chatMessages: ChatMessage[];

  // Chess conversation with AI
  gameId: string | null;
  chessConversation: ChessConversationMessage[];
  lastAIResponse: string | null;

  // Debug info
  debugInfo: DebugInfo;
  showDebugPanel: boolean;

  // Self-healing info
  healthInfo: HealthInfo;

  // Actions
  makePlayerMove: (from: Square, to: Square, promotion?: string) => Promise<void>;
  makeAIMove: () => Promise<void>;
  retryAIMove: () => Promise<void>;
  resign: () => void;
  newGame: () => void;
  selectModel: (model: AIModel) => void;
  goToPostGame: () => void;
  returnToGame: () => void;
  addChatMessage: (content: string, isUser: boolean) => void;
  clearChat: () => void;
  setError: (message: string | null) => void;
  toggleDebugPanel: () => void;
  copyDebugInfo: () => void;
  performHealthCheck: () => void;
  attemptRecovery: () => Promise<boolean>;
  enableAutoHealing: () => void;
  
  // Engine feature debugging
  updateWorkerMetadata: (metadata: any) => void;
  logFeatureError: (feature: 'quiescence' | 'beam' | 'aspiration' | 'worker' | 'general', error: string, context?: any) => void;
  updateEngineFeatures: (features: Partial<DebugInfo['engineFeatures']>) => void;
  logWorkerCall: (call: {
    endpoint: string;
    method: string;
    success: boolean;
    latencyMs: number;
    error?: string;
    request?: any;
    response?: any;
  }) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      chess: new ChessGame(),
      boardVersion: 0,
      gameState: GameState.Playing,
      isPlayerTurn: true,
      isThinking: false,
      errorMessage: null,
      gameResult: null,
      gamePhase: null,
      selectedModel: AIModelRegistry.defaultModel,
      chatMessages: [],
      gameId: null,
      chessConversation: [],
      lastAIResponse: null,
      debugInfo: {
        lastApiCall: null,
        lastApiResponse: null,
        moveHistory: [],
        workerCalls: [],
        lastWorkerMetadata: null,
        engineFeatures: {
          quiescence: {
            enabled: false,
            maxDepth: 0,
            errors: [],
          },
          beamSearch: {
            enabled: false,
            width: 0,
            movesEvaluated: 0,
            movesSkipped: 0,
          },
          aspiration: {
            enabled: false,
            window: 0,
            failedHigh: 0,
            failedLow: 0,
            reSearches: 0,
          },
        },
        featureErrors: [],
      },
      showDebugPanel: false,
      healthInfo: {
        lastHealthCheck: 0,
        isHealthy: true,
        issues: [],
        recoveryAttempts: 0,
        lastRecoveryTime: null,
      },

      // Make player move
      makePlayerMove: async (from, to, promotion) => {
        const state = get();

        // Validate turn integrity
        const turnCheck = turnValidator.validateMove('human', state.chess.getTurn());
        if (!turnCheck.valid) {
          gameLogger.error('Turn validation failed', turnCheck.reason);
          set({ errorMessage: turnCheck.reason || 'Invalid move timing' });
          setTimeout(() => set({ errorMessage: null }), 3000);
          return;
        }

        // Validate game state
        if (!state.isPlayerTurn || state.gameState !== GameState.Playing || state.isThinking) {
          return;
        }

        // Clone first, then make move on the clone (immutable pattern)
        const newChess = state.chess.clone();
        const move = newChess.makeMove(from, to, promotion);
        
        if (!move) {
          set({ errorMessage: 'That move isn\'t allowed. Try a different piece!' });
          setTimeout(() => set({ errorMessage: null }), 3000);
          return;
        }

        const uciMove = `${from}${to}${promotion || ''}`;
        gameLogger.info(`Player move: ${uciMove}`);

        // Update turn validator
        turnValidator.recordMove('human', newChess.getTurn(), 'white');

        // Get actual move number from FEN (more reliable than PGN parsing)
        const fenParts = newChess.getFEN().split(' ');
        const fullMoveNumber = parseInt(fenParts[5]) || 1;
        const actualMoveNumber = newChess.getTurn() === 'w' ? (fullMoveNumber * 2) - 1 : fullMoveNumber * 2;
        
        // Log player move to debug history
        const moveEntry = {
          moveNum: actualMoveNumber,
          player: 'human' as const,
          move: uciMove,
          fen: newChess.getFEN(),
          timestamp: Date.now(),
        };
        console.log(`[Player Move] #${moveEntry.moveNum}: ${uciMove}, FEN: ${newChess.getFEN()}`);

        // Check if game ended
        if (newChess.isGameOver()) {
          const result = newChess.getGameResult();
          set((s) => ({
            chess: newChess,
            errorMessage: null,
            isPlayerTurn: false,
            gameResult: result,
            gameState: GameState.PostGame,
            boardVersion: s.boardVersion + 1,
            debugInfo: {
              ...s.debugInfo,
              moveHistory: [...s.debugInfo.moveHistory, moveEntry],
            },
          }));
          return;
        }

        // Detect game phase
        const moveCount = Math.floor(newChess.getMoveHistory().length / 2);
        const fen = newChess.getFEN();
        const pieceCount = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
        let gamePhase: 'opening' | 'middlegame' | 'endgame' = 'middlegame';
        if (moveCount < 15) gamePhase = 'opening';
        else if (pieceCount <= 10) gamePhase = 'endgame';

        // Update state with NEW chess instance, then trigger AI move
        set((s) => ({ 
          chess: newChess,
          errorMessage: null, 
          isPlayerTurn: false,
          gamePhase,
          boardVersion: s.boardVersion + 1,
          debugInfo: {
            ...s.debugInfo,
            moveHistory: [...s.debugInfo.moveHistory, moveEntry],
          },
        }));

        // Make AI move (will get the NEW chess instance from state)
        await get().makeAIMove();
      },

      // Make AI move (with retry logic and CPU guard)
      makeAIMove: async () => {
        const MAX_RETRIES = 2; // Allow 2 retries for invalid moves
        let retries = 0;
        let lastError: Error | null = null;

        // Validate turn integrity before starting
        const state = get();
        const turnCheck = turnValidator.validateMove('cpu', state.chess.getTurn());
        if (!turnCheck.valid) {
          cpuLogger.error('CPU turn validation failed', turnCheck.reason);
          set({
            errorMessage: turnCheck.reason || 'CPU cannot move now',
            isThinking: false,
            isPlayerTurn: true,
          });
          return;
        }

        set({ isThinking: true, errorMessage: null });

        // Use CPU move guard for timeout protection
        const result = await cpuMoveGuard.executeCPUMove(
          async (signal) => {
            while (retries <= MAX_RETRIES) {
              // Check if aborted
              if (signal.aborted) {
                throw new Error('CPU move was aborted');
              }

              try {
                const state = get();
                const fen = state.chess.getFEN();
                const pgn = state.chess.getPGN();
                const modelId = state.selectedModel.modelIdentifier;
                const startTime = Date.now();

                cpuLogger.debug(`CPU move attempt ${retries + 1}/${MAX_RETRIES + 1}`, { fen, modelId });

                // Track API call in debug info
                set((s) => ({
                  debugInfo: {
                    ...s.debugInfo,
                    lastApiCall: { fen, pgn, modelId, timestamp: startTime },
                  },
                }));

                // Get the last user move for conversation context
                const lastUserMove = state.debugInfo.moveHistory.length > 0 ? 
                  state.debugInfo.moveHistory[state.debugInfo.moveHistory.length - 1] : null;

                // Get AI move from API with conversation
                const response = await api.chessMove(
                  fen, 
                  pgn, 
                  modelId,
                  state.gameId || undefined,
                  lastUserMove?.move,
                  state.chessConversation
                );
                const latencyMs = Date.now() - startTime;
                
                cpuLogger.info(`CPU move received: ${response.move} (${latencyMs}ms)`);
                
                // 🔍 DIAGNOSTIC: Log response structure
                console.log('[DIAGNOSTIC] GameStore API Response:', {
                  hasMove: !!response.move,
                  hasWorkerCallLog: !!response.workerCallLog,
                  workerCallLog: response.workerCallLog,
                  mode: response.mode,
                  engine: response.engine
                });

                // Log worker call if present in response
                if (response.workerCallLog) {
                  console.log('[DIAGNOSTIC] GameStore calling logWorkerCall with:', response.workerCallLog);
                  const beforeCount = get().debugInfo.workerCalls?.length || 0;
                  
                  get().logWorkerCall(response.workerCallLog);
                  
                  const afterCount = get().debugInfo.workerCalls?.length || 0;
                  console.log('[DIAGNOSTIC] GameStore worker calls count: before=', beforeCount, 'after=', afterCount);
                  console.log('[GameStore] ✅ Worker call logged');
                } else {
                  console.warn('[DIAGNOSTIC] ⚠️ No workerCallLog in response');
                }

                // Track API response in debug info
                set((s) => ({
                  debugInfo: {
                    ...s.debugInfo,
                    lastApiResponse: { move: response.move, error: null, latencyMs, timestamp: Date.now() },
                  },
                }));

                // Clone and apply move
                const currentState = get();
                const newChess = currentState.chess.clone();
                const move = newChess.makeMoveUCI(response.move);

                if (!move) {
                  throw new Error(`Invalid CPU move: ${response.move}`);
                }
                
                cpuLogger.debug(`CPU move applied successfully: ${response.move}`);

                // Update turn validator
                turnValidator.recordMove('cpu', newChess.getTurn(), 'white');

                // Get actual move number from FEN
                const fenParts = newChess.getFEN().split(' ');
                const fullMoveNumber = parseInt(fenParts[5]) || 1;
                const actualMoveNumber = newChess.getTurn() === 'w' ? (fullMoveNumber * 2) - 1 : fullMoveNumber * 2;
                
                // Log CPU move to debug history
                const moveEntry = {
                  moveNum: actualMoveNumber,
                  player: 'ai' as const,
                  move: response.move,
                  fen: newChess.getFEN(),
                  timestamp: Date.now(),
                };

                // Check if game ended
                const gameOver = newChess.isGameOver();
                const result = gameOver ? newChess.getGameResult() : null;

                // Health check after move
                const health = newChess.isHealthy();
                if (!health.healthy) {
                  cpuLogger.warn('Health check failed after CPU move', health.issues);
                }

                // Update state
                set((s) => ({
                  chess: newChess,
                  isThinking: false,
                  isPlayerTurn: true,
                  errorMessage: null,
                  gameResult: result,
                  gameState: gameOver ? GameState.PostGame : GameState.Playing,
                  gameId: response.gameId || s.gameId,
                  chessConversation: response.chatHistory || s.chessConversation,
                  lastAIResponse: response.conversationalResponse || s.lastAIResponse,
                  boardVersion: s.boardVersion + 1,
                  debugInfo: {
                    ...s.debugInfo,
                    moveHistory: [...s.debugInfo.moveHistory, moveEntry],
                  },
                  healthInfo: {
                    ...s.healthInfo,
                    lastHealthCheck: Date.now(),
                    isHealthy: health.healthy,
                    issues: health.issues,
                  },
                }));

                return; // Success - exit retry loop
              } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                cpuLogger.error(`CPU move error (attempt ${retries + 1})`, lastError);
                
                const latencyMs = state.debugInfo.lastApiCall ? Date.now() - state.debugInfo.lastApiCall.timestamp : 0;
                
                // Log failed API call as worker call (even if it didn't reach the worker)
                get().logWorkerCall({
                  endpoint: '/api/chess-move',
                  method: 'POST',
                  success: false,
                  latencyMs,
                  error: lastError?.message || 'API call failed',
                  request: {
                    fen: state.chess.getFEN().substring(0, 50),
                    model: state.selectedModel.modelIdentifier,
                    gameId: state.gameId || 'unknown'
                  },
                  response: undefined
                });
                
                // Track error in debug info
                set((s) => ({
                  debugInfo: {
                    ...s.debugInfo,
                    lastApiResponse: { 
                      move: null, 
                      error: lastError?.message || 'Unknown error', 
                      latencyMs,
                      timestamp: Date.now() 
                    },
                  },
                }));

                retries++;

                if (retries > MAX_RETRIES) {
                  throw lastError; // Final failure
                }

                // Brief wait before retry
                const delay = lastError.message.includes('invalid move') ? 800 : 500;
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          },
          { positionComplexity: 'complex' }
        );

        // Handle final result
        if (!result.success) {
          cpuLogger.error('CPU move failed after all retries', result.error);
          
          // User-friendly error messages
          let errorMsg = 'Wall-E had trouble making a move. Please try again.';
          
          if (result.error.includes('timeout')) {
            errorMsg = 'Wall-E took too long to think. Try again?';
          } else if (result.error.includes('aborted') || result.error.includes('cancelled')) {
            errorMsg = 'Move was cancelled. Ready to continue?';
          } else if (result.error.includes('invalid move')) {
            errorMsg = 'Wall-E suggested an illegal move. Please retry.';
          }

          set({
            isThinking: false,
            isPlayerTurn: true,
            errorMessage: errorMsg,
          });
        }
      },

      // Retry AI move (user-triggered)
      retryAIMove: async () => {
        const state = get();
        // Only allow retry if it's supposed to be AI's turn and game is still playing
        if (state.gameState !== GameState.Playing || state.isThinking) {
          return;
        }
        
        // Clear any existing error and trigger AI move
        set({ errorMessage: null, isPlayerTurn: false });
        await get().makeAIMove();
      },

      // Resign game
      resign: () => {
        const state = get();
        if (state.gameState !== GameState.Playing) return;

        set({
          gameResult: 'White resigned - Black wins',
          gameState: GameState.PostGame,
        });
      },

      // Start new game
      newGame: () => {
        gameLogger.info('Starting new game');
        cpuMoveGuard.cancel(); // Cancel any in-progress CPU moves
        
        // Initialize turn validator for new game
        turnValidator.initialize('w', 'white');
        
        set({
          chess: new ChessGame(),
          boardVersion: 0,
          gameState: GameState.Playing,
          isPlayerTurn: true,
          isThinking: false,
          errorMessage: null,
          gameResult: null,
          gamePhase: 'opening',
          chatMessages: [],
          gameId: null,
          chessConversation: [],
          lastAIResponse: null,
          debugInfo: {
            lastApiCall: null,
            lastApiResponse: null,
            moveHistory: [],
            lastWorkerMetadata: null,
            engineFeatures: {
              quiescence: {
                enabled: false,
                maxDepth: 0,
                errors: [],
              },
              beamSearch: {
                enabled: false,
                width: 0,
                movesEvaluated: 0,
                movesSkipped: 0,
              },
              aspiration: {
                enabled: false,
                window: 0,
                failedHigh: 0,
                failedLow: 0,
                reSearches: 0,
              },
            },
            featureErrors: [],
          },
          healthInfo: {
            lastHealthCheck: Date.now(),
            isHealthy: true,
            issues: [],
            recoveryAttempts: 0,
            lastRecoveryTime: null,
          },
        });
      },

      // Select AI model
      selectModel: (model) => {
        set({ selectedModel: model });
      },

      // Go to post-game chat
      goToPostGame: () => {
        set({ gameState: GameState.PostGame });
      },

      // Return to game
      returnToGame: () => {
        set({ gameState: GameState.Playing });
      },

      // Add chat message
      addChatMessage: (content, isUser) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          content,
          isUser,
          timestamp: new Date(),
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        }));
      },

      // Clear chat
      clearChat: () => {
        set({ chatMessages: [] });
      },

      // Set error message
      setError: (message) => {
        set({ errorMessage: message });
      },

      // Toggle debug panel visibility
      toggleDebugPanel: () => {
        set((state) => ({ showDebugPanel: !state.showDebugPanel }));
      },

      // Copy debug info to clipboard
      copyDebugInfo: () => {
        const state = get();
        const debugData = {
          timestamp: new Date().toISOString(),
          currentFEN: state.chess.getFEN(),
          currentPGN: state.chess.getPGN(),
          selectedModel: state.selectedModel.modelIdentifier,
          gameState: state.gameState,
          isPlayerTurn: state.isPlayerTurn,
          isThinking: state.isThinking,
          errorMessage: state.errorMessage,
          boardVersion: state.boardVersion,
          debugInfo: state.debugInfo,
          healthInfo: state.healthInfo,
        };
        const text = JSON.stringify(debugData, null, 2);
        navigator.clipboard.writeText(text).then(() => {
          console.log('[Debug] Info copied to clipboard');
        }).catch((err) => {
          console.error('[Debug] Failed to copy:', err);
        });
      },

      // Perform health check
      performHealthCheck: () => {
        const state = get();
        const health = state.chess.isHealthy();
        
        set((s) => ({
          healthInfo: {
            ...s.healthInfo,
            lastHealthCheck: Date.now(),
            isHealthy: health.healthy,
            issues: health.issues,
          },
        }));
        
        if (!health.healthy) {
          console.warn('[Health Check] Issues detected:', health.issues);
        }
      },

      // Attempt automatic recovery
      attemptRecovery: async () => {
        const state = get();
        console.log('[Recovery] Attempting to recover corrupted game state');
        
        // Update recovery attempt count
        set((s) => ({
          healthInfo: {
            ...s.healthInfo,
            recoveryAttempts: s.healthInfo.recoveryAttempts + 1,
          },
        }));
        
        try {
          const newChess = new ChessGame();
          const recovered = newChess.recover(state.debugInfo.moveHistory);
          
          if (recovered) {
            // Recovery successful
            set((s) => ({
              chess: newChess,
              boardVersion: s.boardVersion + 1,
              errorMessage: 'Game state recovered automatically',
              healthInfo: {
                ...s.healthInfo,
                isHealthy: true,
                issues: [],
                lastRecoveryTime: Date.now(),
              },
            }));
            
            // Clear recovery message after 3 seconds
            setTimeout(() => {
              set({ errorMessage: null });
            }, 3000);
            
            console.log('[Recovery] Successfully recovered game state');
            return true;
          } else {
            console.error('[Recovery] Failed to recover game state');
            set({ errorMessage: 'Game state recovery failed - please start a new game' });
            return false;
          }
        } catch (error) {
          console.error('[Recovery] Recovery attempt failed:', error);
          set({ errorMessage: 'Recovery error - please start a new game' });
          return false;
        }
      },

      // Enable automatic healing (runs periodic health checks)
      enableAutoHealing: () => {
        console.log('[Auto-Heal] Enabling automatic health monitoring');
        
        // Health check every 30 seconds
        setInterval(() => {
          const currentState = get();
          if (currentState.gameState === GameState.Playing) {
            currentState.performHealthCheck();
            
            if (!currentState.healthInfo.isHealthy && currentState.healthInfo.recoveryAttempts < 3) {
              console.log('[Auto-Heal] Unhealthy state detected, attempting recovery');
              currentState.attemptRecovery();
            }
          }
        }, 30000);
        
        // Corruption detection on every board version change
        let lastBoardVersion = get().boardVersion;
        setInterval(() => {
          const currentState = get();
          if (currentState.boardVersion !== lastBoardVersion) {
            lastBoardVersion = currentState.boardVersion;
            currentState.performHealthCheck();
          }
        }, 1000);
      },

      // Update worker metadata for debugging
      updateWorkerMetadata: (metadata) => {
        set((state) => ({
          debugInfo: {
            ...state.debugInfo,
            lastWorkerMetadata: metadata,
          },
        }));
      },

      // Log feature-specific errors
      logFeatureError: (feature, error, context = {}) => {
        set((state) => {
          const newError = {
            timestamp: Date.now(),
            feature,
            error,
            context,
          };
          
          // Keep last 50 errors
          const featureErrors = [...state.debugInfo.featureErrors, newError].slice(-50);
          
          console.error(`[Engine Feature Error] ${feature}:`, error, context);
          
          return {
            debugInfo: {
              ...state.debugInfo,
              featureErrors,
            },
          };
        });
      },

      // Update engine feature stats
      updateEngineFeatures: (features) => {
        set((state) => ({
          debugInfo: {
            ...state.debugInfo,
            engineFeatures: {
              ...state.debugInfo.engineFeatures,
              ...features,
            },
          },
        }));
      },

      // Log worker service binding calls
      logWorkerCall: (call) => {
        console.log('[DIAGNOSTIC] 🎯 logWorkerCall() CALLED with:', call);
        console.log('[DIAGNOSTIC] Current state before logging:', {
          workerCallsCount: get().debugInfo.workerCalls?.length || 0,
          workerCalls: get().debugInfo.workerCalls
        });
        
        set((state) => {
          const newCall = {
            timestamp: Date.now(),
            endpoint: call.endpoint,
            method: call.method,
            success: call.success,
            latencyMs: call.latencyMs,
            error: call.error,
            request: call.request,
            response: call.response,
          };
          
          console.log('[DIAGNOSTIC] Creating new call object:', newCall);
          
          // Keep last 50 calls
          const previousCalls = state.debugInfo.workerCalls || [];
          const workerCalls = [...previousCalls, newCall].slice(-50);
          
          console.log('[DIAGNOSTIC] Worker calls array:', {
            previousCount: previousCalls.length,
            newCount: workerCalls.length,
            newCall: newCall
          });
          
          console.log(`[Worker Call] ${call.method} ${call.endpoint}:`, {
            success: call.success,
            latency: `${call.latencyMs}ms`,
            error: call.error,
          });
          
          const newState = {
            debugInfo: {
              ...state.debugInfo,
              workerCalls,
            },
          };
          
          console.log('[DIAGNOSTIC] ✅ Returning new state with', workerCalls.length, 'worker calls');
          
          return newState;
        });
      },
    }),
    {
      name: 'chesschat-storage',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        // Don't persist game state - fresh start on reload
      }),
    }
  )
);

// Initialize auto-healing on store creation
if (typeof window !== 'undefined') {
  // Enable auto-healing after a short delay
  setTimeout(() => {
    useGameStore.getState().enableAutoHealing();
  }, 1000);
}
