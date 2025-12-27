// Security utilities for Cloudflare Functions
// Input sanitization, rate limiting, and validation

/**
 * Sanitize chess FEN notation
 * Allows only valid FEN characters: letters, numbers, spaces, slashes
 */
export function sanitizeFEN(fen: string): string {
  if (!fen || typeof fen !== 'string') {
    throw new Error('Invalid FEN: must be a non-empty string');
  }

  // Basic FEN validation - allow standard FEN characters
  // FEN has 6 parts: position, turn, castling, en passant, halfmove, fullmove
  const parts = fen.trim().split(/\s+/);
  
  if (parts.length < 4) {
    throw new Error('Invalid FEN format: requires at least 4 parts');
  }

  // Validate piece placement (first part) - only valid chess characters
  const positionPattern = /^[rnbqkpRNBQKP1-8\/]+$/;
  if (!positionPattern.test(parts[0])) {
    throw new Error('Invalid FEN: invalid piece placement');
  }

  // Validate turn indicator
  if (!['w', 'b'].includes(parts[1])) {
    throw new Error('Invalid FEN: turn must be w or b');
  }

  return fen.trim();
}

/**
 * Sanitize PGN (Portable Game Notation)
 * Allows move numbers, piece notation, captures, checks, algebraic notation
 */
export function sanitizePGN(pgn: string): string {
  if (typeof pgn !== 'string') {
    throw new Error('Invalid PGN: must be a string');
  }

  // Allow standard PGN characters: pieces (KQRBN), files (a-h), ranks (1-8), 
  // move notation (x, +, #, O-O, =), move numbers, spaces, newlines
  const sanitized = pgn.replace(/[^KQRBNPa-h1-8x+#O\-=\.\s\d]/g, '');
  
  // Limit length to prevent abuse (typical game < 5000 chars)
  if (sanitized.length > 10000) {
    throw new Error('PGN too long');
  }

  return sanitized.trim();
}

/**
 * Sanitize model identifier
 * Wall-E uses internal chess engine - no external model validation needed
 */
export function sanitizeModelIdentifier(model: string): string {
  // Wall-E doesn't use external models
  // Keep function for backward compatibility but always returns valid
  if (!model || typeof model !== 'string') {
    return 'wall-e';
  }
  return model.toLowerCase().trim();
}

/**
 * Sanitize user chat message
 * Remove potential XSS vectors, limit length
 */
export function sanitizeUserMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message: must be a non-empty string');
  }

  // Remove HTML tags
  let sanitized = message.replace(/<[^>]*>/g, '');
  
  // Remove potential script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Limit length (reasonable chat message)
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
  }

  return sanitized.trim();
}

/**
 * Rate limiting using Cloudflare KV
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  limit: number = 30,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `rate_limit:${identifier}`;
  const now = Date.now();

  try {
    // Get current rate limit data
    const data = await kv.get(key, 'json') as { count: number; resetAt: number } | null;

    if (!data || data.resetAt < now) {
      // No existing limit or expired - create new window
      await kv.put(
        key,
        JSON.stringify({ count: 1, resetAt: now + windowSeconds * 1000 }),
        { expirationTtl: windowSeconds + 10 } // Extra 10s buffer
      );
      return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000 };
    }

    if (data.count >= limit) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetAt: data.resetAt };
    }

    // Increment counter
    const newCount = data.count + 1;
    await kv.put(
      key,
      JSON.stringify({ count: newCount, resetAt: data.resetAt }),
      { expirationTtl: Math.ceil((data.resetAt - now) / 1000) + 10 }
    );

    return { allowed: true, remaining: limit - newCount, resetAt: data.resetAt };
  } catch (error) {
    // If KV fails, allow request (fail open for availability)
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: limit, resetAt: now + windowSeconds * 1000 };
  }
}

/**
 * Get client IP address from request
 * Cloudflare provides this in CF-Connecting-IP header
 */
export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] || 
         'unknown';
}

/**
 * Validate required environment variables
 * Wall-E has NO required API keys
 */
export function validateEnvironment(env: any): { valid: boolean; missing: string[] } {
  // Wall-E works without external dependencies
  // DATABASE_URL is optional (enables personalization)
  const required: string[] = [];
  const missing: string[] = [];

  for (const key of required) {
    if (!env[key] || env[key].trim() === '') {
      missing.push(key);
    }
  }

  return { valid: true, missing }; // Always valid
}

/**
 * Error code mapping for user-friendly messages
 */
export enum ErrorCode {
  MOVE_GENERATION_FAILED = 'MOVE_GENERATION_FAILED',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_MODEL = 'INVALID_MODEL',
  TIMEOUT = 'TIMEOUT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_CONFIG = 'MISSING_CONFIG'
}

/**
 * Map error to user-friendly response
 */
export function mapErrorToResponse(error: any, errorCode: ErrorCode): {
  success: false;
  error: string;
  errorCode: ErrorCode;
  userMessage: string;
  retryable: boolean;
} {
  const errorMessages: Record<ErrorCode, string> = {
    [ErrorCode.MOVE_GENERATION_FAILED]: 'The AI had trouble generating a move. Please try again.',
    [ErrorCode.ANALYSIS_FAILED]: 'Game analysis is temporarily unavailable. Please try again.',
    [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
    [ErrorCode.INVALID_MODEL]: 'The selected AI model is not available. Please choose a different model.',
    [ErrorCode.TIMEOUT]: 'The request took too long. Please try again.',
    [ErrorCode.API_UNAVAILABLE]: 'The AI service is temporarily unavailable. Please try again in a few moments.',
    [ErrorCode.INVALID_INPUT]: 'Invalid game data. Please refresh the page and start a new game.',
    [ErrorCode.MISSING_CONFIG]: 'The service is not properly configured. Please contact support.'
  };

  const retryable = [
    ErrorCode.MOVE_GENERATION_FAILED,
    ErrorCode.ANALYSIS_FAILED,
    ErrorCode.TIMEOUT,
    ErrorCode.API_UNAVAILABLE
  ].includes(errorCode);

  return {
    success: false,
    error: error.message || 'Unknown error',
    errorCode,
    userMessage: errorMessages[errorCode],
    retryable
  };
}

/**
 * Increment analytics counter in KV
 */
export async function incrementCounter(
  kv: KVNamespace | undefined,
  counterName: string
): Promise<void> {
  if (!kv) return; // Analytics disabled

  try {
    const key = `counter:${counterName}`;
    const currentValue = await kv.get(key);
    const newValue = currentValue ? parseInt(currentValue) + 1 : 1;
    await kv.put(key, newValue.toString());
  } catch (error) {
    // Don't fail request if analytics fails
    console.error('Analytics counter increment failed:', error);
  }
}

/**
 * Get analytics counters
 */
export async function getCounters(
  kv: KVNamespace | undefined
): Promise<Record<string, number>> {
  if (!kv) return {};

  try {
    const keys = ['totalPageLoads', 'totalGamesStarted', 'totalGamesFinished', 'totalAnalysisRequests'];
    const counters: Record<string, number> = {};

    for (const key of keys) {
      const value = await kv.get(`counter:${key}`);
      counters[key] = value ? parseInt(value) : 0;
    }

    return counters;
  } catch (error) {
    console.error('Failed to get analytics counters:', error);
    return {};
  }
}
