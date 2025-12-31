/**
 * ARCHIVED: Local Main Thread Chess Move Fallback
 * 
 * Date Archived: December 28, 2025
 * 
 * Why Archived:
 * - Fallback behavior was masking Worker failures, making troubleshooting impossible
 * - CPU strength appeared compromised due to silent fallback to local engine
 * - Worker call logs showed 0 calls because fallback was always being used
 * - Need to force Worker failures to be visible for proper debugging
 * 
 * How to Re-enable:
 * 1. Set environment variable: ALLOW_FALLBACK_MAIN_THREAD=true
 * 2. Import this module in functions/api/chess-move.ts
 * 3. Call executeFallbackMove() when Worker fails (if env flag is true)
 * 4. Deploy with the environment variable set in Cloudflare Dashboard
 * 
 * WARNING: Re-enabling fallback will hide Worker issues again!
 */

import { Chess } from 'chess.js';
import { WalleChessEngine } from '../../shared/walleChessEngine';

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  moveContext?: string;
}

interface GameSession {
  gameId: string;
  chatHistory: ChatMessage[];
  moveCount: number;
  startTime: number;
}

// Convert UCI move to algebraic notation for chat
function convertUciToAlgebraic(uciMove: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    const move = chess.move(uciMove);
    return move ? move.san : uciMove;
  } catch {
    return uciMove;
  }
}

// Validate if a UCI move is legal in the given position
function isLegalMove(fen: string, uciMove: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
    
    const result = chess.move({ from, to, promotion });
    return result !== null;
  } catch {
    return false;
  }
}

// Get list of legal moves in UCI format
function getLegalMoves(fen: string): string[] {
  try {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true }).map(m => {
      const uci = m.from + m.to + (m.promotion || '');
      return uci;
    });
  } catch {
    return [];
  }
}

/**
 * Execute fallback chess move using local Wall-E engine
 * Only call this if ALLOW_FALLBACK_MAIN_THREAD environment variable is true
 */
export async function executeFallbackMove(
  fen: string,
  difficulty: string,
  gameId: string | undefined,
  userMove: string | undefined,
  enableDebug: boolean,
  requestId: string,
  startTime: number,
  kvNamespaces: {
    GAME_SESSIONS?: KVNamespace;
    WORKER_CALL_LOGS?: KVNamespace;
  }
) {
  console.log(`[${requestId}] FALLBACK: Using local Wall-E engine`);

  // Initialize or load game session
  let gameSession: GameSession;
  const sessionKey = gameId || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const existingSession = gameId && kvNamespaces.GAME_SESSIONS ? 
      await kvNamespaces.GAME_SESSIONS.get(gameId) : null;
    gameSession = existingSession ? JSON.parse(existingSession) : {
      gameId: sessionKey,
      chatHistory: [],
      moveCount: 0,
      startTime: Date.now()
    };
  } catch {
    gameSession = {
      gameId: sessionKey,
      chatHistory: [],
      moveCount: 0,
      startTime: Date.now()
    };
  }

  // Get legal moves for validation
  const legalMoves = getLegalMoves(fen);
  console.log(`[${requestId}] Legal moves: ${legalMoves.length} available`);

  if (legalMoves.length === 0) {
    throw new Error('No legal moves available (game may be over)');
  }

  // Initialize chat if this is the first move
  if (gameSession.moveCount === 0) {
    const sideToPlay = fen.includes(' w ') ? 'Black' : 'White';
    const challengeMessage: ChatMessage = {
      id: `msg_${Date.now()}_1`,
      role: 'user',
      content: `Hello! I challenge you to a game of chess. You'll be playing as ${sideToPlay}. Let's have a friendly but competitive match!`,
      timestamp: Date.now(),
      moveContext: 'game_start'
    };
    gameSession.chatHistory.push(challengeMessage);
  }

  // Add user move to conversation if provided
  if (userMove && gameSession.moveCount > 0) {
    const moveNotation = convertUciToAlgebraic(userMove, fen);
    const userMoveMessage: ChatMessage = {
      id: `msg_${Date.now()}_${gameSession.chatHistory.length + 1}`,
      role: 'user',
      content: `I played ${moveNotation}. Your turn!`,
      timestamp: Date.now(),
      moveContext: userMove
    };
    gameSession.chatHistory.push(userMoveMessage);
  }

  // Use Wall-E Chess Engine to select move
  const difficultyLevel = (difficulty as 'beginner' | 'intermediate' | 'advanced' | 'master') || 'intermediate';
  
  let selectedMove: string;
  let commentary: string;
  let engineDebug: any = undefined;
  
  try {
    const result = WalleChessEngine.selectMove(fen, difficultyLevel, true, enableDebug);
    selectedMove = result.move;
    commentary = result.commentary || "Here's my move!";
    engineDebug = result.debug;
  } catch (error) {
    console.error(`[${requestId}] Wall-E engine error:`, error);
    // Fallback to random legal move
    selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    commentary = "Let me think... here's my move!";
  }

  // Verify move is legal (should always be, but double-check)
  if (!isLegalMove(fen, selectedMove)) {
    console.error(`[${requestId}] Wall-E selected illegal move: ${selectedMove}`);
    // Fallback to random legal move
    selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    commentary = "Interesting position! Let me play this.";
  }

  // Add Wall-E's response to chat history
  const moveNotation = convertUciToAlgebraic(selectedMove, fen);
  const fullResponse = `${commentary}\nMOVE: ${selectedMove}`;
  
  const aiMessage: ChatMessage = {
    id: `msg_${Date.now()}_${gameSession.chatHistory.length + 1}`,
    role: 'assistant',
    content: fullResponse,
    timestamp: Date.now(),
    moveContext: selectedMove
  };
  gameSession.chatHistory.push(aiMessage);
  gameSession.moveCount++;

  // Save updated session (if KV is available)
  try {
    if (kvNamespaces.GAME_SESSIONS) {
      await kvNamespaces.GAME_SESSIONS.put(gameSession.gameId, JSON.stringify(gameSession), {
        expirationTtl: 3600 // 1 hour expiration
      });
    }
  } catch (error) {
    console.warn(`[${requestId}] Failed to save session:`, error);
  }

  const latencyMs = Date.now() - startTime;
  console.log(`[${requestId}] FALLBACK Success: move="${selectedMove}" (${moveNotation}), latency=${latencyMs}ms`);

  return {
    success: true,
    move: selectedMove,
    engine: 'wall-e',
    mode: 'local-fallback',
    difficulty: difficultyLevel,
    latencyMs,
    requestId,
    gameId: gameSession.gameId,
    chatHistory: gameSession.chatHistory,
    conversationalResponse: fullResponse,
    diagnostics: {
      depthReached: engineDebug?.depthReached || 0,
      nodes: engineDebug?.nodesEvaluated || 0,
      eval: engineDebug?.evaluation || 0,
      selectedLine: engineDebug?.bestLine || '',
      openingBook: engineDebug?.usedOpeningBook || false,
      reason: 'Local fallback engine'
    },
    workerCallLog: {
      timestamp: Date.now(),
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs: latencyMs,
      error: 'Worker unavailable - used local fallback engine (ALLOW_FALLBACK_MAIN_THREAD=true)',
      request: { fen: fen.substring(0, 50), difficulty: difficultyLevel, gameId: gameSession.gameId },
      response: { 
        move: selectedMove, 
        mode: 'local-fallback', 
        engine: 'wall-e',
        depthReached: engineDebug?.depthReached || 0
      }
    },
    ...(enableDebug && engineDebug && { debug: engineDebug })
  };
}
