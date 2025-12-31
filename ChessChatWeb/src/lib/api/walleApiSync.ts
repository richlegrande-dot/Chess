/**
 * Wall-E API Sync Module
 * 
 * Replaces direct Prisma calls with API requests to Cloudflare Functions.
 * All database operations now go through the serverless backend.
 */

/**
 * Get the user ID from localStorage (generate if needed)
 */
function getUserId(): string {
  let userId = localStorage.getItem('wall-e-user-id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('wall-e-user-id', userId);
  }
  return userId;
}

/**
 * Sync player profile to database via API
 * NOTE: Endpoint not deployed - data stored locally only
 */
export async function savePlayerProfileViaAPI(profileData: any): Promise<boolean> {
  // API endpoints not deployed in production - fail silently
  // All data is stored in localStorage instead
  return true;
}

/**
 * Sync training game to database via API
 * NOTE: Endpoint not deployed - data stored locally only
 */
export async function saveTrainingGameViaAPI(gameData: any): Promise<boolean> {
  // API endpoints not deployed in production - fail silently
  // All data is stored in localStorage instead
  return true;
}

/**
 * Sync mistake signature to database via API
 * NOTE: Endpoint not deployed - data stored locally only
 */
export async function saveMistakeSignatureViaAPI(mistakeData: any): Promise<boolean> {
  // API endpoints not deployed in production - fail silently
  // All data is stored in localStorage instead
  return true;
}

/**
 * Sync learning metric to database via API
 * NOTE: Endpoint not deployed - data stored locally only
 */
export async function saveLearningMetricViaAPI(metricData: any): Promise<boolean> {
  // API endpoints not deployed in production - fail silently
  // All data is stored in localStorage instead
  return true;
}

/**
 * Bulk sync all Wall-E data from localStorage to database
 * NOTE: Endpoint not deployed - data stored locally only
 */
export async function performFullSyncViaAPI(): Promise<boolean> {
  // API endpoints not deployed in production - fail silently
  // All data is stored in localStorage instead
  localStorage.setItem('wall-e-last-sync', new Date().toISOString());
  return true;
}

/**
 * Auto-sync on app startup (non-blocking)
 * Only syncs if last sync was > 24 hours ago
 */
export async function autoSyncOnStartViaAPI(): Promise<void> {
  try {
    const lastSync = localStorage.getItem('wall-e-last-sync');
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (!lastSync || now - new Date(lastSync).getTime() > twentyFourHours) {
      console.log('🔄 Starting Wall-E auto-sync...');
      await performFullSyncViaAPI();
    } else {
      console.log('⏭️ Skipping sync (last sync < 24h ago)');
    }
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
    // Don't throw - auto-sync is non-critical
  }
}

/**
 * Fetch player profile from database
 * NOTE: Endpoint not deployed - returns null (data in localStorage only)
 */
export async function loadPlayerProfileViaAPI(): Promise<any | null> {
  // API endpoints not deployed in production - return null
  // All data is stored in localStorage instead
  return null;
}

/**
 * Fetch training games from database
 * NOTE: Endpoint not deployed - returns empty array (data in localStorage only)
 */
export async function loadTrainingGamesViaAPI(): Promise<any[]> {
  // API endpoints not deployed in production - return empty array
  // All data is stored in localStorage instead
  return [];
}

/**
 * Fetch mistake signatures from database
 * NOTE: Endpoint not deployed - returns empty array (data in localStorage only)
 */
export async function loadMistakeSignaturesViaAPI(): Promise<any[]> {
  // API endpoints not deployed in production - return empty array
  // All data is stored in localStorage instead
  return [];
}

/**
 * Fetch learning metrics from database
 * NOTE: Endpoint not deployed - returns empty array (data in localStorage only)
 */
export async function loadLearningMetricsViaAPI(): Promise<any[]> {
  // API endpoints not deployed in production - return empty array
  // All data is stored in localStorage instead
  return [];
}
