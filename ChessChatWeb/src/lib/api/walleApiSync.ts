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
 */
export async function savePlayerProfileViaAPI(profileData: any): Promise<boolean> {
  try {
    const userId = getUserId();
    const response = await fetch('/api/wall-e/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...profileData }),
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ Player profile synced to database');
      return true;
    } else {
      console.error('❌ Profile sync failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Profile sync error:', error);
    return false;
  }
}

/**
 * Sync training game to database via API
 */
export async function saveTrainingGameViaAPI(gameData: any): Promise<boolean> {
  try {
    const userId = getUserId();
    const response = await fetch('/api/wall-e/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...gameData }),
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ Training game ${gameData.gameIndex} synced to database`);
      return true;
    } else {
      console.error('❌ Game sync failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Game sync error:', error);
    return false;
  }
}

/**
 * Sync mistake signature to database via API
 */
export async function saveMistakeSignatureViaAPI(mistakeData: any): Promise<boolean> {
  try {
    const userId = getUserId();
    const response = await fetch('/api/wall-e/mistakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...mistakeData }),
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ Mistake signature "${mistakeData.title}" synced to database`);
      return true;
    } else {
      console.error('❌ Mistake sync failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Mistake sync error:', error);
    return false;
  }
}

/**
 * Sync learning metric to database via API
 */
export async function saveLearningMetricViaAPI(metricData: any): Promise<boolean> {
  try {
    const userId = getUserId();
    const response = await fetch('/api/wall-e/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...metricData }),
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ Learning metric synced to database');
      return true;
    } else {
      console.error('❌ Metric sync failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Metric sync error:', error);
    return false;
  }
}

/**
 * Bulk sync all Wall-E data from localStorage to database
 */
export async function performFullSyncViaAPI(): Promise<boolean> {
  try {
    const userId = getUserId();

    // Gather all localStorage data
    const playerProfile = localStorage.getItem('wall-e-player-profile');
    const trainingGames = localStorage.getItem('wall-e-training-games');
    const mistakeSignatures = localStorage.getItem('wall-e-mistake-signatures');
    const learningMetrics = localStorage.getItem('wall-e-learning-metrics');

    const payload = {
      userId,
      playerProfile: playerProfile ? JSON.parse(playerProfile) : null,
      trainingGames: trainingGames ? JSON.parse(trainingGames) : null,
      mistakeSignatures: mistakeSignatures ? JSON.parse(mistakeSignatures) : null,
      learningMetrics: learningMetrics ? JSON.parse(learningMetrics) : null,
    };

    const response = await fetch('/api/wall-e/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ Full sync complete:', result.results);
      localStorage.setItem('wall-e-last-sync', new Date().toISOString());
      return true;
    } else {
      console.error('❌ Full sync failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Full sync error:', error);
    return false;
  }
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
 */
export async function loadPlayerProfileViaAPI(): Promise<any | null> {
  try {
    const userId = getUserId();
    const response = await fetch(`/api/wall-e/profile?userId=${userId}`);
    const result = await response.json();

    if (result.success && result.profile) {
      return result.profile;
    }
    return null;
  } catch (error) {
    console.error('❌ Profile load error:', error);
    return null;
  }
}

/**
 * Fetch training games from database
 */
export async function loadTrainingGamesViaAPI(): Promise<any[]> {
  try {
    const userId = getUserId();
    const response = await fetch(`/api/wall-e/games?userId=${userId}`);
    const result = await response.json();

    if (result.success && result.games) {
      return result.games;
    }
    return [];
  } catch (error) {
    console.error('❌ Games load error:', error);
    return [];
  }
}

/**
 * Fetch mistake signatures from database
 */
export async function loadMistakeSignaturesViaAPI(): Promise<any[]> {
  try {
    const userId = getUserId();
    const response = await fetch(`/api/wall-e/mistakes?userId=${userId}`);
    const result = await response.json();

    if (result.success && result.mistakes) {
      return result.mistakes;
    }
    return [];
  } catch (error) {
    console.error('❌ Mistakes load error:', error);
    return [];
  }
}

/**
 * Fetch learning metrics from database
 */
export async function loadLearningMetricsViaAPI(): Promise<any[]> {
  try {
    const userId = getUserId();
    const response = await fetch(`/api/wall-e/metrics?userId=${userId}`);
    const result = await response.json();

    if (result.success && result.metrics) {
      return result.metrics;
    }
    return [];
  } catch (error) {
    console.error('❌ Metrics load error:', error);
    return [];
  }
}
