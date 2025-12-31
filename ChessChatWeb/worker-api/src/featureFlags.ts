/**
 * Feature Flags for Learning Layer V3
 * 
 * Provides safe, gradual rollout with multiple safety levels.
 */

export interface LearningV3Config {
  enabled: boolean;
  readonly: boolean;
  shadowMode: boolean;
  asyncAnalysis: boolean;
  maxPlyAnalysis: number;
  stockfishDepth: number;
  timeoutMs: number;
  canaryEnabled: boolean;
  canaryPercentage: number;
}

export interface Env {
  // Existing vars
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  ENVIRONMENT: string;
  VERSION: string;
  STOCKFISH_SERVER_URL: string;
  STOCKFISH_API_KEY: string;
  ENABLE_STOCKFISH_KEEPWARM?: string;
  AI_COACH?: Fetcher;
  INTERNAL_AUTH_TOKEN?: string;
  
  // Learning V3 Feature Flags (all default to SAFE values)
  LEARNING_V3_ENABLED?: string;           // default: "false"
  LEARNING_V3_READONLY?: string;          // default: "true"
  LEARNING_V3_SHADOW_MODE?: string;       // default: "true"
  LEARNING_V3_ASYNC_ANALYSIS?: string;    // default: "true"
  LEARNING_V3_MAX_PLY_ANALYSIS?: string;  // default: "4" (aggressive timeout prevention)
  LEARNING_V3_STOCKFISH_DEPTH?: string;   // default: "14"
  LEARNING_V3_TIMEOUT_MS?: string;        // default: "8000"
  LEARNING_V3_CANARY_ENABLED?: string;    // default: "false"
  LEARNING_V3_CANARY_PERCENTAGE?: string; // default: "1"
}

/**
 * Parse Learning V3 configuration from environment
 */
export function getLearningV3Config(env: Env): LearningV3Config {
  return {
    enabled: env.LEARNING_V3_ENABLED === 'true',
    readonly: env.LEARNING_V3_READONLY !== 'false', // default true
    shadowMode: env.LEARNING_V3_SHADOW_MODE !== 'false', // default true
    asyncAnalysis: env.LEARNING_V3_ASYNC_ANALYSIS !== 'false', // default true
    maxPlyAnalysis: parseInt(env.LEARNING_V3_MAX_PLY_ANALYSIS || '4', 10),
    stockfishDepth: parseInt(env.LEARNING_V3_STOCKFISH_DEPTH || '14', 10),
    timeoutMs: parseInt(env.LEARNING_V3_TIMEOUT_MS || '8000', 10),
    canaryEnabled: env.LEARNING_V3_CANARY_ENABLED === 'true',
    canaryPercentage: parseInt(env.LEARNING_V3_CANARY_PERCENTAGE || '1', 10),
  };
}

/**
 * Determine if user is in canary group
 * Uses deterministic hash for consistent user experience
 */
export function isUserInCanary(userId: string, config: LearningV3Config): boolean {
  if (!config.canaryEnabled) {
    return false;
  }
  
  // Simple hash: sum of char codes
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash += userId.charCodeAt(i);
  }
  
  const bucket = hash % 100;
  return bucket < config.canaryPercentage;
}

/**
 * Check if request has admin override header
 */
export function hasAdminOverride(request: Request): string | null {
  const header = request.headers.get('X-Learning-V3');
  if (header === 'on' || header === 'off') {
    return header;
  }
  return null;
}

/**
 * Determine effective Learning V3 state for a request
 */
export function getEffectiveLearningState(
  env: Env,
  request: Request,
  userId: string | null
): { enabled: boolean; config: LearningV3Config; reason: string } {
  const config = getLearningV3Config(env);
  
  // Check admin override first (requires admin auth)
  const override = hasAdminOverride(request);
  if (override) {
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${env.ADMIN_PASSWORD}`;
    
    if (authHeader === expectedAuth) {
      return {
        enabled: override === 'on',
        config,
        reason: `admin-override:${override}`,
      };
    }
  }
  
  // Check global enable flag
  if (!config.enabled) {
    return {
      enabled: false,
      config,
      reason: 'globally-disabled',
    };
  }
  
  // Check canary rollout
  if (config.canaryEnabled && userId) {
    const inCanary = isUserInCanary(userId, config);
    return {
      enabled: inCanary,
      config,
      reason: inCanary ? 'canary-enabled' : 'canary-excluded',
    };
  }
  
  // Default: respect global flag
  return {
    enabled: config.enabled,
    config,
    reason: 'globally-enabled',
  };
}

/**
 * Create standard disabled response
 */
export function createDisabledResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      disabled: true,
      message: 'Learning Layer V3 is currently disabled',
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Create read-only blocked response
 */
export function createReadOnlyBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      readonly: true,
      message: 'Learning Layer V3 is in read-only mode',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
