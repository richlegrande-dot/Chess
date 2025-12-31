/**
 * Server Capabilities Client
 * 
 * Fetches and caches server capability information to avoid
 * misleading users about what features are actually available.
 */

export interface ServerCapabilities {
  learning: {
    local: boolean;
    server: boolean;
  };
  coaching: {
    local: boolean;
    server: boolean;
  };
  chat: {
    enabled: boolean;
  };
  stockfish: {
    cpuMoves: boolean;
    deepAnalysis: boolean;
  };
  serverInfo: {
    version: string;
    environment: string;
    timestamp: string;
  };
}

let cachedCapabilities: ServerCapabilities | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch server capabilities with caching
 */
export async function getServerCapabilities(): Promise<ServerCapabilities> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedCapabilities && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedCapabilities;
  }

  try {
    const response = await fetch('/api/capabilities', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Capabilities fetch failed: ${response.status}`);
    }

    const capabilities = await response.json() as ServerCapabilities;
    cachedCapabilities = capabilities;
    lastFetchTime = now;
    
    return capabilities;
  } catch (error) {
    console.warn('Failed to fetch server capabilities, using defaults:', error);
    
    // Return safe defaults (everything local-only)
    const defaults: ServerCapabilities = {
      learning: { local: true, server: false },
      coaching: { local: true, server: false },
      chat: { enabled: false },
      stockfish: { cpuMoves: true, deepAnalysis: false },
      serverInfo: {
        version: 'unknown',
        environment: 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    return defaults;
  }
}

/**
 * Clear cached capabilities (useful for testing)
 */
export function clearCapabilitiesCache(): void {
  cachedCapabilities = null;
  lastFetchTime = 0;
}

/**
 * Check if a specific feature is available
 */
export async function isFeatureAvailable(
  category: 'learning' | 'coaching' | 'chat' | 'stockfish',
  feature?: string
): Promise<boolean> {
  const capabilities = await getServerCapabilities();
  
  if (category === 'chat') {
    return capabilities.chat.enabled;
  }
  
  if (category === 'stockfish') {
    if (feature === 'deepAnalysis') return capabilities.stockfish.deepAnalysis;
    return capabilities.stockfish.cpuMoves;
  }
  
  // For learning/coaching, check if server is available
  if (feature === 'server') {
    return capabilities[category].server;
  }
  
  // Local is always available
  return capabilities[category].local;
}
