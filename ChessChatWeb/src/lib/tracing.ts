/**
 * CPU Move Pipeline Tracing System
 * Provides detailed logging with unique request IDs for debugging CPU move issues
 */

// Simple UUID v4 generator (no external dependency)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface MoveTrace {
  moveRequestId: string;
  timestamp: number;
  fen: string;
  pgn: string;
  plyCount: number;
  moveNumber: number;
  mode: 'vs_cpu' | 'two_player' | 'vs_ai';
  currentTurn: 'w' | 'b';
  phase: 'request' | 'validation' | 'computation' | 'response' | 'applied' | 'error';
  message: string;
  data?: any;
}

class MoveTracer {
  private traces: MoveTrace[] = [];
  private maxTraces = 100;

  generateRequestId(): string {
    return generateUUID();
  }

  log(trace: Omit<MoveTrace, 'timestamp'>): void {
    const fullTrace: MoveTrace = {
      ...trace,
      timestamp: Date.now(),
    };

    this.traces.push(fullTrace);

    // Keep only recent traces
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }

    // Console log for development
    const prefix = `[${trace.phase.toUpperCase()}]`;
    const id = trace.moveRequestId.slice(0, 8);
    const move = `Move #${trace.moveNumber}`;
    
    console.log(
      `%c${prefix} ${id} ${move}%c ${trace.message}`,
      'color: #4CAF50; font-weight: bold',
      'color: inherit',
      trace.data || ''
    );
  }

  logPlayerMove(requestId: string, from: string, to: string, fen: string, pgn: string, moveNumber: number): void {
    this.log({
      moveRequestId: requestId,
      fen,
      pgn,
      plyCount: this.getPlyCount(fen),
      moveNumber,
      mode: 'vs_cpu',
      currentTurn: this.getCurrentTurn(fen),
      phase: 'applied',
      message: `Player move: ${from}→${to}`,
      data: { from, to },
    });
  }

  logCPURequest(requestId: string, fen: string, pgn: string, moveNumber: number): void {
    this.log({
      moveRequestId: requestId,
      fen,
      pgn,
      plyCount: this.getPlyCount(fen),
      moveNumber,
      mode: 'vs_cpu',
      currentTurn: this.getCurrentTurn(fen),
      phase: 'request',
      message: 'CPU move requested',
    });
  }

  logCPUResponse(requestId: string, move: string, fen: string, pgn: string, moveNumber: number, timeMs: number): void {
    this.log({
      moveRequestId: requestId,
      fen,
      pgn,
      plyCount: this.getPlyCount(fen),
      moveNumber,
      mode: 'vs_cpu',
      currentTurn: this.getCurrentTurn(fen),
      phase: 'response',
      message: `CPU responded: ${move} (${timeMs}ms)`,
      data: { move, timeMs },
    });
  }

  logError(requestId: string, error: string, fen: string, pgn: string, moveNumber: number): void {
    console.error(`[ERROR] ${requestId.slice(0, 8)} Move #${moveNumber}: ${error}`);
    this.log({
      moveRequestId: requestId,
      fen,
      pgn,
      plyCount: this.getPlyCount(fen),
      moveNumber,
      mode: 'vs_cpu',
      currentTurn: this.getCurrentTurn(fen),
      phase: 'error',
      message: error,
    });
  }

  logTimeout(requestId: string, fen: string, pgn: string, moveNumber: number, timeoutMs: number): void {
    console.warn(`[TIMEOUT] ${requestId.slice(0, 8)} Move #${moveNumber}: CPU did not respond within ${timeoutMs}ms`);
    this.log({
      moveRequestId: requestId,
      fen,
      pgn,
      plyCount: this.getPlyCount(fen),
      moveNumber,
      mode: 'vs_cpu',
      currentTurn: this.getCurrentTurn(fen),
      phase: 'error',
      message: `CPU timeout after ${timeoutMs}ms`,
      data: { timeoutMs },
    });
  }

  getRecentTraces(count: number = 10): MoveTrace[] {
    return this.traces.slice(-count);
  }

  getTracesByRequestId(requestId: string): MoveTrace[] {
    return this.traces.filter(t => t.moveRequestId === requestId);
  }

  exportTraces(): string {
    return JSON.stringify(this.traces, null, 2);
  }

  clearTraces(): void {
    this.traces = [];
  }

  private getPlyCount(fen: string): number {
    // Ply count is in the last part of FEN
    const parts = fen.split(' ');
    return parts.length >= 6 ? parseInt(parts[5]) : 0;
  }

  private getCurrentTurn(fen: string): 'w' | 'b' {
    const parts = fen.split(' ');
    return (parts[1] === 'w' ? 'w' : 'b') as 'w' | 'b';
  }
}

// Singleton instance
export const moveTracer = new MoveTracer();
