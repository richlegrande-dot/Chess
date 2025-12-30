// API client for communicating with Cloudflare Functions

import type {
  ChessMoveRequest,
  ChessMoveResponse,
  ChatRequest,
  ChatResponse,
} from './models';

const API_BASE = '/api';

// Retry configuration - simplified
const MAX_RETRIES = 2;
const RETRY_DELAY = 500; // 500ms
const REQUEST_TIMEOUT = 25000; // 25 seconds

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      if (response.status >= 500) {
        throw new Error('Server error');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Don't retry on abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    if (retries > 0) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export async function getAIMove(
  fen: string,
  pgn: string,
  modelId: string,
  gameId?: string,
  userMove?: string,
  chatHistory?: any[]
): Promise<ChessMoveResponse> {
  // Map to Worker API format (cpuLevel derived from modelId)
  const cpuLevel = modelId.includes('easy') ? 1 : 
                   modelId.includes('medium') ? 3 : 
                   modelId.includes('hard') ? 5 : 3;
  
  const difficulty = modelId.includes('easy') ? 'easy' : 
                     modelId.includes('medium') ? 'medium' : 
                     modelId.includes('hard') ? 'hard' : 'medium';

  const workerRequest = {
    fen,
    pgn,
    difficulty,
    cpuLevel,
    timeMs: 1000,
    gameId,
  };

  const response = await fetchWithRetry<any>(
    `${API_BASE}/chess-move`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workerRequest),
    }
  );

  if (!response.success || !response.move) {
    throw new Error(response.error || 'Failed to get AI move');
  }

  // Transform Worker API response to expected format
  return {
    move: response.move,
    success: response.success,
    error: response.error,
    gameId: response.diagnostics?.gameId || gameId,
    workerCallLog: response.workerCallLog,
    chatHistory,
  };
}

export async function sendChatMessage(
  request: ChatRequest
): Promise<string> {
  const response = await fetchWithRetry<ChatResponse>(
    `${API_BASE}/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.success || !response.response) {
    throw new Error(response.error || 'Failed to get chat response');
  }

  return response.response;
}

export async function analyzeGame(
  pgn: string,
  moveHistory: any[],
  cpuLevel: number,
  playerColor: string
): Promise<string> {
  const response = await fetchWithRetry<{success: boolean; analysis?: string; error?: string}>(
    `${API_BASE}/analyze-game`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn, moveHistory, cpuLevel, playerColor }),
    }
  );

  if (!response.success || !response.analysis) {
    throw new Error(response.error || 'Failed to analyze game');
  }

  return response.analysis;
}

// Admin API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic apiFetch for admin endpoints
async function apiFetch<T = any>(
  path: string,
  options: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const apiPath = path.startsWith('/api/') ? path : `/api/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(apiPath, config);

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiError(errorMessage, response.status, false);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to server', undefined, true);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      undefined,
      false
    );
  }
}

export const api = {
  chessMove: getAIMove,
  chat: sendChatMessage,
  analyzeGame,

  // Health endpoints
  health: {
    get: () => apiFetch('/api/health'),
    getWithTest: () => apiFetch('/api/health?test=true'),
  },

  // Admin endpoints
  admin: {
    auth: {
      unlock: (password: string) =>
        apiFetch<{ success: boolean; token: string; expiresAt: string }>(
          '/api/admin/auth/unlock',
          { method: 'POST', body: { password } }
        ),
      logout: (token: string) =>
        apiFetch('/api/admin/auth/logout', { method: 'POST', token }),
    },

    knowledge: {
      getSources: (token: string, page = 1, limit = 50) =>
        apiFetch(`/api/admin/knowledge/sources?page=${page}&limit=${limit}`, { token }),

      getSource: (token: string, id: string) =>
        apiFetch(`/api/admin/knowledge/sources/${id}`, { token }),

      createSource: (token: string, data: { title: string; sourceType: string; url?: string }) =>
        apiFetch('/api/admin/knowledge/sources', { method: 'POST', token, body: data }),

      updateSource: (token: string, id: string, data: any) =>
        apiFetch(`/api/admin/knowledge/sources/${id}`, { method: 'PATCH', token, body: data }),

      deleteSource: (token: string, id: string) =>
        apiFetch(`/api/admin/knowledge/sources/${id}`, { method: 'DELETE', token }),

      getChunks: (token: string, sourceId: string) =>
        apiFetch(`/api/admin/knowledge/sources/${sourceId}/chunks`, { token }),

      createChunk: (token: string, sourceId: string, data: any) =>
        apiFetch(`/api/admin/knowledge/sources/${sourceId}/chunks`, {
          method: 'POST',
          token,
          body: data,
        }),

      updateChunk: (token: string, chunkId: string, data: any) =>
        apiFetch(`/api/admin/knowledge/chunks/${chunkId}`, {
          method: 'PATCH',
          token,
          body: data,
        }),

      deleteChunk: (token: string, chunkId: string) =>
        apiFetch(`/api/admin/knowledge/chunks/${chunkId}`, { method: 'DELETE', token }),

      getAuditLog: (token: string, page = 1, limit = 50) =>
        apiFetch(`/api/admin/knowledge/audit?page=${page}&limit=${limit}`, { token }),

      getDiagnostics: (token: string) =>
        apiFetch('/api/admin/knowledge/diagnostics', { token }),
    },

    coach: {
      generateAdvice: (token: string, gameAnalysis: any, context: any) =>
        apiFetch('/api/admin/coach', {
          method: 'POST',
          token,
          body: { action: 'generate_advice', gameAnalysis, context },
        }),

      getThematicCoaching: (token: string, theme: string, skillLevel: 'beginner' | 'intermediate' | 'advanced') =>
        apiFetch('/api/admin/coach', {
          method: 'POST',
          token,
          body: { action: 'thematic_coaching', theme, context: { skillLevel } },
        }),

      searchKnowledge: (token: string, query: string) =>
        apiFetch('/api/admin/coach', {
          method: 'POST',
          token,
          body: { action: 'search_knowledge', query },
        }),
    },

    worker: {
      health: () => apiFetch('/api/admin/worker-health'),
      calls: (limit = 50) => apiFetch(`/api/admin/worker-calls?limit=${limit}`),
      clearCalls: (token: string) =>
        apiFetch('/api/admin/worker-calls/clear', {
          method: 'POST',
          token,
        }),
    },
  },
};
