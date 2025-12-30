/**
 * Stockfish Integration Module for Worker API
 * 
 * Implementation: External HTTP Server (Render.com)
 * Handles cold starts gracefully for Render free tier
 */

export interface StockfishMoveRequest {
  fen: string;
  cpuLevel: number;
  timeMs: number;
  gameId?: string;
  playerId?: string;
  mode?: 'vs-cpu' | 'coaching';
}

export interface StockfishMoveResponse {
  success: true;
  move: string;
  evaluation?: number;
  pv?: string;
  depth?: number;
  nodes?: number;
  time: number;
  mate?: number;
}

export interface StockfishErrorResponse {
  success: false;
  errorCode: 'STOCKFISH_UNAVAILABLE' | 'ENGINE_TIMEOUT' | 'BAD_FEN' | 'INTERNAL' | 'SERVER_ERROR' | 'STOCKFISH_UNAUTHORIZED' | 'STOCKFISH_BAD_RESPONSE' | 'STOCKFISH_TIMEOUT';
  error: string;
}

export type StockfishResponse = StockfishMoveResponse | StockfishErrorResponse;

export interface StockfishEnv {
  STOCKFISH_SERVER_URL: string;
  STOCKFISH_API_KEY: string;
}

export class StockfishEngine {
  private serverUrl: string;
  private apiKey: string;
  private initialized = false;
  private readonly maxRetries = 2;
  private readonly coldStartTimeout = 60000;

  constructor(env: StockfishEnv) {
    this.serverUrl = env.STOCKFISH_SERVER_URL;
    this.apiKey = env.STOCKFISH_API_KEY;
    
    if (!this.serverUrl) throw new Error('STOCKFISH_SERVER_URL not set');
    if (!this.apiKey) throw new Error('STOCKFISH_API_KEY not set');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const timeout = attempt === 1 ? 10000 : this.coldStartTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(`${this.serverUrl}/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
          
          const health = await response.json() as any;
          if (health.status !== 'healthy') throw new Error('Server not healthy');

          this.initialized = true;
          console.log('[Stockfish] Connected:', this.serverUrl);
          return;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error: any) {
        console.error(`[Stockfish] Attempt ${attempt} failed:`, error.message);
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 5000 : 10000));
        }
      }
    }
    
    throw new Error('Failed to initialize Stockfish after retries');
  }

  async computeMove(request: StockfishMoveRequest): Promise<StockfishResponse> {
    try {
      await this.init();

      if (!this.isValidFEN(request.fen)) {
        return { success: false, errorCode: 'BAD_FEN', error: 'Invalid FEN' };
      }

      const cpuLevel = Math.max(1, Math.min(10, request.cpuLevel || 5));
      const requestId = crypto.randomUUID();
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        const timeout = attempt === 1 ? (request.timeMs || 10000) : this.coldStartTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(`${this.serverUrl}/compute-move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'X-Request-Id': requestId
            },
            body: JSON.stringify({ fen: request.fen, cpuLevel }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status === 401) {
            return { success: false, errorCode: 'STOCKFISH_UNAUTHORIZED', error: 'Invalid API key' };
          }

          if (!response.ok) {
            if (attempt < this.maxRetries && response.status >= 500) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            return { success: false, errorCode: 'STOCKFISH_BAD_RESPONSE', error: `Server error: ${response.status}` };
          }

          const result = await response.json() as any;
          if (!result.success) {
            return { success: false, errorCode: 'INTERNAL', error: result.error || 'Unknown error' };
          }

          return {
            success: true,
            move: result.move,
            evaluation: result.diagnostics?.evalCp ? result.diagnostics.evalCp / 100 : undefined,
            pv: result.diagnostics?.pv,
            depth: result.diagnostics?.depth,
            nodes: result.diagnostics?.nodes,
            time: result.diagnostics?.engineMs || 0,
            mate: result.diagnostics?.mate
          };
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError' && attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          if (attempt >= this.maxRetries) {
            return { success: false, errorCode: 'STOCKFISH_TIMEOUT', error: 'Timeout after retries' };
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }
      
      return { success: false, errorCode: 'STOCKFISH_UNAVAILABLE', error: 'Failed after retries' };
    } catch (error: any) {
      return { success: false, errorCode: 'INTERNAL', error: error.message };
    }
  }

  private isValidFEN(fen: string): boolean {
    if (!fen || typeof fen !== 'string') return false;
    const parts = fen.trim().split(' ');
    if (parts.length < 4) return false;
    const ranks = parts[0].split('/');
    return ranks.length === 8;
  }

  async terminate(): Promise<void> {
    this.initialized = false;
  }
}
