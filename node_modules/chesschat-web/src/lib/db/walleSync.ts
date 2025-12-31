/**
 * Wall-E Data Sync Service
 * Syncs localStorage data to database for persistence
 * Handles migration from localStorage-only to dual-write strategy
 */

import {
  getUserId,
  savePlayerProfile,
  saveTrainingGame,
  saveMistakeSignature,
  loadPlayerProfile,
  loadTrainingGames,
  loadMistakeSignatures,
  type PlayerProfileData,
  type TrainingGameData,
  type MistakeSignatureData,
} from './walleDatabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const SYNC_STATUS_KEY = 'wall_e_sync_status';
const LAST_SYNC_KEY = 'wall_e_last_sync';
const TRAINING_CORE_KEY = 'wall_e_training_core_v2';

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

interface SyncStatus {
  lastSyncTime: number;
  profileSynced: boolean;
  gamesSynced: number;
  signaturesSynced: number;
  errors: string[];
}

function getSyncStatus(): SyncStatus {
  const stored = localStorage.getItem(SYNC_STATUS_KEY);
  if (!stored) {
    return {
      lastSyncTime: 0,
      profileSynced: false,
      gamesSynced: 0,
      signaturesSynced: 0,
      errors: [],
    };
  }
  return JSON.parse(stored);
}

function updateSyncStatus(update: Partial<SyncStatus>): void {
  const current = getSyncStatus();
  const updated = { ...current, ...update, lastSyncTime: Date.now() };
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
}

// ============================================================================
// MIGRATION: LOCALSTORAGE → DATABASE
// ============================================================================

/**
 * Migrate player profile from localStorage to database
 */
export async function syncPlayerProfileToDatabase(): Promise<boolean> {
  try {
    const userId = getUserId();
    const localProfile = localStorage.getItem('enhanced_player_profile');
    
    if (!localProfile) {
      console.log('[Sync] No local player profile found');
      return true; // Nothing to sync
    }

    const profile = JSON.parse(localProfile);
    
    const profileData: PlayerProfileData = {
      userId,
      tacticalRating: profile.tacticalRating || 50,
      positionalRating: profile.positionalRating || 50,
      endgameRating: profile.endgameRating || 50,
      openingRating: profile.openingRating || 50,
      gamesPlayed: profile.gamesPlayed || 0,
      improvementRate: profile.improvementRate || 0,
      strengthAreas: profile.strengthAreas || [],
      weaknessAreas: profile.weaknessAreas || [],
      playStyle: profile.playStyle || 'balanced',
      commonMistakes: profile.commonMistakes || [],
      favoriteOpenings: profile.favoriteOpenings || [],
      ratingHistory: profile.ratingHistory || [],
      milestones: profile.milestones || [],
    };

    await savePlayerProfile(profileData);
    updateSyncStatus({ profileSynced: true });
    console.log('[Sync] Player profile synced to database');
    return true;
  } catch (error) {
    console.error('[Sync] Failed to sync player profile:', error);
    updateSyncStatus({ errors: [`Profile sync failed: ${error}`] });
    return false;
  }
}

/**
 * Migrate training games (50-game core) from localStorage to database
 */
export async function syncTrainingGamesToDatabase(): Promise<boolean> {
  try {
    const userId = getUserId();
    const coreData = localStorage.getItem(TRAINING_CORE_KEY);
    
    if (!coreData) {
      console.log('[Sync] No training core found');
      return true; // Nothing to sync
    }

    const core = JSON.parse(coreData);
    const games = core.trainingGames || [];
    
    console.log(`[Sync] Syncing ${games.length} training games...`);
    
    let syncedCount = 0;
    for (const game of games) {
      try {
        const gameData: TrainingGameData = {
          userId,
          gameIndex: game.gameIndex || syncedCount,
          pgn: game.pgn || '',
          fen: game.fen,
          result: game.result || '*',
          playerColor: game.playerColor || 'w',
          moveCount: game.moveCount || 0,
          cpuLevel: game.cpuLevel || 1,
          tacticalPatterns: game.tacticalPatterns || [],
          strategicIssues: game.strategicIssues || [],
          mistakeEvents: game.mistakeEvents || [],
          decisionMoments: game.decisionMoments || [],
          blunders: game.blunders || 0,
          mistakes: game.mistakes || 0,
          inaccuracies: game.inaccuracies || 0,
          accuracy: game.accuracy || 0,
          openingPerf: game.openingPerf,
          middlegamePerf: game.middlegamePerf,
          endgamePerf: game.endgamePerf,
          topImprovements: game.topImprovements || [],
          encouragement: game.encouragement,
          tacticalFocus: game.tacticalFocus,
          strategicFocus: game.strategicFocus,
        };

        await saveTrainingGame(gameData);
        syncedCount++;
      } catch (err) {
        console.error(`[Sync] Failed to sync game ${syncedCount}:`, err);
      }
    }

    updateSyncStatus({ gamesSynced: syncedCount });
    console.log(`[Sync] Synced ${syncedCount}/${games.length} training games`);
    return syncedCount === games.length;
  } catch (error) {
    console.error('[Sync] Failed to sync training games:', error);
    updateSyncStatus({ errors: [`Games sync failed: ${error}`] });
    return false;
  }
}

/**
 * Migrate mistake signatures from localStorage to database
 */
export async function syncMistakeSignaturesToDatabase(): Promise<boolean> {
  try {
    const userId = getUserId();
    const signaturesData = localStorage.getItem('chess_mistake_signatures');
    
    if (!signaturesData) {
      console.log('[Sync] No mistake signatures found');
      return true; // Nothing to sync
    }

    const signatures = JSON.parse(signaturesData);
    
    console.log(`[Sync] Syncing ${signatures.length} mistake signatures...`);
    
    let syncedCount = 0;
    for (const sig of signatures) {
      try {
        const signatureData: MistakeSignatureData = {
          userId,
          category: sig.category || 'tactical',
          title: sig.title || 'Unknown Mistake',
          mistakeType: sig.mistakeType || 'general',
          motifs: sig.motifs || [],
          positionTypes: sig.positionTypes || [],
          occurrences: sig.occurrences || 1,
          lastSeen: new Date(sig.lastSeen || Date.now()),
          confidenceScore: sig.confidenceScore || 0,
          masteryScore: sig.masteryScore || 0,
          exampleGames: sig.exampleGames || [],
          principleText: sig.principleText,
          coachingAdvice: sig.coachingAdvice,
          teachingAttempts: sig.teachingAttempts || 0,
          successfulGames: sig.successfulGames || 0,
        };

        await saveMistakeSignature(signatureData);
        syncedCount++;
      } catch (err) {
        console.error(`[Sync] Failed to sync signature ${sig.title}:`, err);
      }
    }

    updateSyncStatus({ signaturesSynced: syncedCount });
    console.log(`[Sync] Synced ${syncedCount}/${signatures.length} mistake signatures`);
    return syncedCount === signatures.length;
  } catch (error) {
    console.error('[Sync] Failed to sync mistake signatures:', error);
    updateSyncStatus({ errors: [`Signatures sync failed: ${error}`] });
    return false;
  }
}

// ============================================================================
// FULL SYNC OPERATION
// ============================================================================

/**
 * Perform full sync of all Wall-E data from localStorage to database
 */
export async function performFullSync(): Promise<{
  success: boolean;
  profileSynced: boolean;
  gamesSynced: number;
  signaturesSynced: number;
  errors: string[];
}> {
  console.log('[Sync] Starting full sync to database...');
  
  const results = {
    success: true,
    profileSynced: false,
    gamesSynced: 0,
    signaturesSynced: 0,
    errors: [] as string[],
  };

  // Sync player profile
  try {
    results.profileSynced = await syncPlayerProfileToDatabase();
    if (!results.profileSynced) results.success = false;
  } catch (error) {
    results.errors.push(`Profile sync error: ${error}`);
    results.success = false;
  }

  // Sync training games
  try {
    const gamesSuccess = await syncTrainingGamesToDatabase();
    const status = getSyncStatus();
    results.gamesSynced = status.gamesSynced;
    if (!gamesSuccess) results.success = false;
  } catch (error) {
    results.errors.push(`Games sync error: ${error}`);
    results.success = false;
  }

  // Sync mistake signatures
  try {
    const signaturesSuccess = await syncMistakeSignaturesToDatabase();
    const status = getSyncStatus();
    results.signaturesSynced = status.signaturesSynced;
    if (!signaturesSuccess) results.success = false;
  } catch (error) {
    results.errors.push(`Signatures sync error: ${error}`);
    results.success = false;
  }

  console.log('[Sync] Full sync complete:', results);
  return results;
}

// ============================================================================
// AUTO-SYNC ON APP START
// ============================================================================

/**
 * Check if sync is needed and perform if necessary
 */
export async function autoSyncOnStart(): Promise<void> {
  const status = getSyncStatus();
  const lastSync = status.lastSyncTime;
  const now = Date.now();
  const hoursSinceLastSync = (now - lastSync) / (1000 * 60 * 60);

  // Auto-sync if:
  // 1. Never synced before
  // 2. More than 24 hours since last sync
  // 3. Profile not synced
  const needsSync = 
    lastSync === 0 || 
    hoursSinceLastSync > 24 || 
    !status.profileSynced;

  if (needsSync) {
    console.log('[Sync] Auto-sync triggered');
    await performFullSync();
  } else {
    console.log(`[Sync] Last sync: ${hoursSinceLastSync.toFixed(1)} hours ago, skipping`);
  }
}

// ============================================================================
// RESTORE FROM DATABASE (Recovery)
// ============================================================================

/**
 * Restore data from database to localStorage (recovery mode)
 */
export async function restoreFromDatabase(): Promise<boolean> {
  try {
    const userId = getUserId();
    console.log('[Sync] Restoring data from database...');

    // Restore profile
    const profile = await loadPlayerProfile(userId);
    if (profile) {
      localStorage.setItem('enhanced_player_profile', JSON.stringify(profile));
      console.log('[Sync] Profile restored');
    }

    // Restore training games
    const games = await loadTrainingGames(userId);
    if (games.length > 0) {
      const core = {
        version: 2,
        maxGames: 50,
        trainingGames: games,
        metadata: {
          totalGames: games.length,
          oldestGameDate: Math.min(...games.map(g => Date.now())),
          newestGameDate: Math.max(...games.map(g => Date.now())),
        },
      };
      localStorage.setItem(TRAINING_CORE_KEY, JSON.stringify(core));
      console.log(`[Sync] ${games.length} training games restored`);
    }

    // Restore mistake signatures
    const signatures = await loadMistakeSignatures(userId);
    if (signatures.length > 0) {
      localStorage.setItem('chess_mistake_signatures', JSON.stringify(signatures));
      console.log(`[Sync] ${signatures.length} mistake signatures restored`);
    }

    console.log('[Sync] Restore from database complete');
    return true;
  } catch (error) {
    console.error('[Sync] Failed to restore from database:', error);
    return false;
  }
}
