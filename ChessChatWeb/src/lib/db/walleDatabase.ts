/**
 * Wall-E Database Persistence Layer
 * Syncs Wall-E's memory bank and player profile to Prisma database
 * Provides dual-write strategy: localStorage (fast) + database (persistent)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface PlayerProfileData {
  userId: string;
  tacticalRating: number;
  positionalRating: number;
  endgameRating: number;
  openingRating: number;
  gamesPlayed: number;
  improvementRate: number;
  strengthAreas: string[];
  weaknessAreas: string[];
  playStyle: 'aggressive' | 'defensive' | 'balanced' | 'positional';
  commonMistakes: string[];
  favoriteOpenings: string[];
  ratingHistory: Array<{ date: number; rating: number }>;
  milestones: Array<{ achievement: string; date: number }>;
}

export interface TrainingGameData {
  userId: string;
  gameIndex: number;
  pgn: string;
  fen?: string;
  result: string;
  playerColor: 'w' | 'b';
  moveCount: number;
  cpuLevel: number;
  tacticalPatterns: string[];
  strategicIssues: string[];
  mistakeEvents: any[];
  decisionMoments: any[];
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  accuracy: number;
  openingPerf?: string;
  middlegamePerf?: string;
  endgamePerf?: string;
  topImprovements: any[];
  encouragement?: string;
  tacticalFocus?: string;
  strategicFocus?: string;
}

export interface MistakeSignatureData {
  userId: string;
  category: string;
  title: string;
  mistakeType: string;
  motifs: string[];
  positionTypes: string[];
  occurrences: number;
  lastSeen: Date;
  confidenceScore: number;
  masteryScore: number;
  exampleGames: Array<{ gameId: string; moveNumber: number; fen: string }>;
  principleText?: string;
  coachingAdvice?: string;
  teachingAttempts: number;
  successfulGames: number;
}

export interface LearningMetricData {
  userId: string;
  sessionId: string;
  sessionStart: Date;
  sessionEnd?: Date;
  gamesInSession: number;
  averageAccuracy: number;
  improvementDelta: number;
  areasImproved: string[];
  areasRegressed: string[];
  newPatternsLearned: number;
  keyInsights: any[];
  progressMade: string[];
}

// ============================================================================
// PLAYER PROFILE OPERATIONS
// ============================================================================

export async function savePlayerProfile(data: PlayerProfileData): Promise<void> {
  try {
    await prisma.playerProfile.upsert({
      where: { userId: data.userId },
      update: {
        tacticalRating: data.tacticalRating,
        positionalRating: data.positionalRating,
        endgameRating: data.endgameRating,
        openingRating: data.openingRating,
        gamesPlayed: data.gamesPlayed,
        improvementRate: data.improvementRate,
        strengthAreas: JSON.stringify(data.strengthAreas),
        weaknessAreas: JSON.stringify(data.weaknessAreas),
        playStyle: data.playStyle,
        commonMistakes: JSON.stringify(data.commonMistakes),
        favoriteOpenings: JSON.stringify(data.favoriteOpenings),
        ratingHistory: JSON.stringify(data.ratingHistory),
        milestones: JSON.stringify(data.milestones),
        updatedAt: new Date(),
      },
      create: {
        userId: data.userId,
        tacticalRating: data.tacticalRating,
        positionalRating: data.positionalRating,
        endgameRating: data.endgameRating,
        openingRating: data.openingRating,
        gamesPlayed: data.gamesPlayed,
        improvementRate: data.improvementRate,
        strengthAreas: JSON.stringify(data.strengthAreas),
        weaknessAreas: JSON.stringify(data.weaknessAreas),
        playStyle: data.playStyle,
        commonMistakes: JSON.stringify(data.commonMistakes),
        favoriteOpenings: JSON.stringify(data.favoriteOpenings),
        ratingHistory: JSON.stringify(data.ratingHistory),
        milestones: JSON.stringify(data.milestones),
      },
    });
    console.log('[WalleDB] Player profile saved:', data.userId);
  } catch (error) {
    console.error('[WalleDB] Failed to save player profile:', error);
    throw error;
  }
}

export async function loadPlayerProfile(userId: string): Promise<PlayerProfileData | null> {
  try {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
    });

    if (!profile) return null;

    return {
      userId: profile.userId,
      tacticalRating: profile.tacticalRating,
      positionalRating: profile.positionalRating,
      endgameRating: profile.endgameRating,
      openingRating: profile.openingRating,
      gamesPlayed: profile.gamesPlayed,
      improvementRate: profile.improvementRate,
      strengthAreas: JSON.parse(profile.strengthAreas),
      weaknessAreas: JSON.parse(profile.weaknessAreas),
      playStyle: profile.playStyle as any,
      commonMistakes: JSON.parse(profile.commonMistakes),
      favoriteOpenings: JSON.parse(profile.favoriteOpenings),
      ratingHistory: JSON.parse(profile.ratingHistory),
      milestones: JSON.parse(profile.milestones),
    };
  } catch (error) {
    console.error('[WalleDB] Failed to load player profile:', error);
    return null;
  }
}

// ============================================================================
// TRAINING GAME OPERATIONS (50-Game Rolling Window)
// ============================================================================

export async function saveTrainingGame(data: TrainingGameData): Promise<void> {
  try {
    // Ensure userId exists in PlayerProfile first
    await prisma.playerProfile.upsert({
      where: { userId: data.userId },
      update: {},
      create: {
        userId: data.userId,
        strengthAreas: '[]',
        weaknessAreas: '[]',
        commonMistakes: '[]',
        favoriteOpenings: '[]',
        ratingHistory: '[]',
        milestones: '[]',
      },
    });

    await prisma.trainingGame.upsert({
      where: {
        userId_gameIndex: {
          userId: data.userId,
          gameIndex: data.gameIndex,
        },
      },
      update: {
        pgn: data.pgn,
        fen: data.fen,
        result: data.result,
        playerColor: data.playerColor,
        moveCount: data.moveCount,
        cpuLevel: data.cpuLevel,
        tacticalPatterns: JSON.stringify(data.tacticalPatterns),
        strategicIssues: JSON.stringify(data.strategicIssues),
        mistakeEvents: JSON.stringify(data.mistakeEvents),
        decisionMoments: JSON.stringify(data.decisionMoments),
        blunders: data.blunders,
        mistakes: data.mistakes,
        inaccuracies: data.inaccuracies,
        accuracy: data.accuracy,
        openingPerf: data.openingPerf,
        middlegamePerf: data.middlegamePerf,
        endgamePerf: data.endgamePerf,
        topImprovements: JSON.stringify(data.topImprovements),
        encouragement: data.encouragement,
        tacticalFocus: data.tacticalFocus,
        strategicFocus: data.strategicFocus,
      },
      create: {
        userId: data.userId,
        gameIndex: data.gameIndex,
        pgn: data.pgn,
        fen: data.fen,
        result: data.result,
        playerColor: data.playerColor,
        moveCount: data.moveCount,
        cpuLevel: data.cpuLevel,
        tacticalPatterns: JSON.stringify(data.tacticalPatterns),
        strategicIssues: JSON.stringify(data.strategicIssues),
        mistakeEvents: JSON.stringify(data.mistakeEvents),
        decisionMoments: JSON.stringify(data.decisionMoments),
        blunders: data.blunders,
        mistakes: data.mistakes,
        inaccuracies: data.inaccuracies,
        accuracy: data.accuracy,
        openingPerf: data.openingPerf,
        middlegamePerf: data.middlegamePerf,
        endgamePerf: data.endgamePerf,
        topImprovements: JSON.stringify(data.topImprovements),
        encouragement: data.encouragement,
        tacticalFocus: data.tacticalFocus,
        strategicFocus: data.strategicFocus,
      },
    });
    console.log(`[WalleDB] Training game saved: ${data.userId} #${data.gameIndex}`);
  } catch (error) {
    console.error('[WalleDB] Failed to save training game:', error);
    throw error;
  }
}

export async function loadTrainingGames(userId: string): Promise<TrainingGameData[]> {
  try {
    const games = await prisma.trainingGame.findMany({
      where: { userId },
      orderBy: { gameIndex: 'asc' },
    });

    return games.map(game => ({
      userId: game.userId,
      gameIndex: game.gameIndex,
      pgn: game.pgn,
      fen: game.fen || undefined,
      result: game.result,
      playerColor: game.playerColor as 'w' | 'b',
      moveCount: game.moveCount,
      cpuLevel: game.cpuLevel,
      tacticalPatterns: JSON.parse(game.tacticalPatterns),
      strategicIssues: JSON.parse(game.strategicIssues),
      mistakeEvents: JSON.parse(game.mistakeEvents),
      decisionMoments: JSON.parse(game.decisionMoments),
      blunders: game.blunders,
      mistakes: game.mistakes,
      inaccuracies: game.inaccuracies,
      accuracy: game.accuracy,
      openingPerf: game.openingPerf || undefined,
      middlegamePerf: game.middlegamePerf || undefined,
      endgamePerf: game.endgamePerf || undefined,
      topImprovements: JSON.parse(game.topImprovements),
      encouragement: game.encouragement || undefined,
      tacticalFocus: game.tacticalFocus || undefined,
      strategicFocus: game.strategicFocus || undefined,
    }));
  } catch (error) {
    console.error('[WalleDB] Failed to load training games:', error);
    return [];
  }
}

// ============================================================================
// MISTAKE SIGNATURE OPERATIONS
// ============================================================================

export async function saveMistakeSignature(data: MistakeSignatureData): Promise<void> {
  try {
    // Ensure userId exists first
    await prisma.playerProfile.upsert({
      where: { userId: data.userId },
      update: {},
      create: {
        userId: data.userId,
        strengthAreas: '[]',
        weaknessAreas: '[]',
        commonMistakes: '[]',
        favoriteOpenings: '[]',
        ratingHistory: '[]',
        milestones: '[]',
      },
    });

    // Find existing signature by category + title + userId
    const existing = await prisma.mistakeSignature.findFirst({
      where: {
        userId: data.userId,
        category: data.category,
        title: data.title,
      },
    });

    if (existing) {
      await prisma.mistakeSignature.update({
        where: { id: existing.id },
        data: {
          mistakeType: data.mistakeType,
          motifs: JSON.stringify(data.motifs),
          positionTypes: JSON.stringify(data.positionTypes),
          occurrences: data.occurrences,
          lastSeen: data.lastSeen,
          confidenceScore: data.confidenceScore,
          masteryScore: data.masteryScore,
          exampleGames: JSON.stringify(data.exampleGames),
          principleText: data.principleText,
          coachingAdvice: data.coachingAdvice,
          teachingAttempts: data.teachingAttempts,
          successfulGames: data.successfulGames,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.mistakeSignature.create({
        data: {
          userId: data.userId,
          category: data.category,
          title: data.title,
          mistakeType: data.mistakeType,
          motifs: JSON.stringify(data.motifs),
          positionTypes: JSON.stringify(data.positionTypes),
          occurrences: data.occurrences,
          lastSeen: data.lastSeen,
          confidenceScore: data.confidenceScore,
          masteryScore: data.masteryScore,
          exampleGames: JSON.stringify(data.exampleGames),
          principleText: data.principleText,
          coachingAdvice: data.coachingAdvice,
          teachingAttempts: data.teachingAttempts,
          successfulGames: data.successfulGames,
        },
      });
    }
    console.log(`[WalleDB] Mistake signature saved: ${data.userId} - ${data.title}`);
  } catch (error) {
    console.error('[WalleDB] Failed to save mistake signature:', error);
    throw error;
  }
}

export async function loadMistakeSignatures(userId: string): Promise<MistakeSignatureData[]> {
  try {
    const signatures = await prisma.mistakeSignature.findMany({
      where: { userId },
      orderBy: { lastSeen: 'desc' },
    });

    return signatures.map(sig => ({
      userId: sig.userId,
      category: sig.category,
      title: sig.title,
      mistakeType: sig.mistakeType,
      motifs: JSON.parse(sig.motifs),
      positionTypes: JSON.parse(sig.positionTypes),
      occurrences: sig.occurrences,
      lastSeen: sig.lastSeen,
      confidenceScore: sig.confidenceScore,
      masteryScore: sig.masteryScore,
      exampleGames: JSON.parse(sig.exampleGames),
      principleText: sig.principleText || undefined,
      coachingAdvice: sig.coachingAdvice || undefined,
      teachingAttempts: sig.teachingAttempts,
      successfulGames: sig.successfulGames,
    }));
  } catch (error) {
    console.error('[WalleDB] Failed to load mistake signatures:', error);
    return [];
  }
}

// ============================================================================
// LEARNING METRICS OPERATIONS
// ============================================================================

export async function saveLearningMetric(data: LearningMetricData): Promise<void> {
  try {
    // Ensure userId exists first
    await prisma.playerProfile.upsert({
      where: { userId: data.userId },
      update: {},
      create: {
        userId: data.userId,
        strengthAreas: '[]',
        weaknessAreas: '[]',
        commonMistakes: '[]',
        favoriteOpenings: '[]',
        ratingHistory: '[]',
        milestones: '[]',
      },
    });

    await prisma.learningMetric.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        sessionStart: data.sessionStart,
        sessionEnd: data.sessionEnd,
        gamesInSession: data.gamesInSession,
        averageAccuracy: data.averageAccuracy,
        improvementDelta: data.improvementDelta,
        areasImproved: JSON.stringify(data.areasImproved),
        areasRegressed: JSON.stringify(data.areasRegressed),
        newPatternsLearned: data.newPatternsLearned,
        keyInsights: JSON.stringify(data.keyInsights),
        progressMade: JSON.stringify(data.progressMade),
      },
    });
    console.log(`[WalleDB] Learning metric saved: ${data.userId} - ${data.sessionId}`);
  } catch (error) {
    console.error('[WalleDB] Failed to save learning metric:', error);
    throw error;
  }
}

export async function loadLearningMetrics(userId: string, limit = 10): Promise<LearningMetricData[]> {
  try {
    const metrics = await prisma.learningMetric.findMany({
      where: { userId },
      orderBy: { sessionStart: 'desc' },
      take: limit,
    });

    return metrics.map(metric => ({
      userId: metric.userId,
      sessionId: metric.sessionId,
      sessionStart: metric.sessionStart,
      sessionEnd: metric.sessionEnd || undefined,
      gamesInSession: metric.gamesInSession,
      averageAccuracy: metric.averageAccuracy,
      improvementDelta: metric.improvementDelta,
      areasImproved: JSON.parse(metric.areasImproved),
      areasRegressed: JSON.parse(metric.areasRegressed),
      newPatternsLearned: metric.newPatternsLearned,
      keyInsights: JSON.parse(metric.keyInsights),
      progressMade: JSON.parse(metric.progressMade),
    }));
  } catch (error) {
    console.error('[WalleDB] Failed to load learning metrics:', error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique user ID (can be based on browser fingerprint, session, etc.)
 */
export function getUserId(): string {
  let userId = localStorage.getItem('wall_e_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('wall_e_user_id', userId);
  }
  return userId;
}

/**
 * Cleanup - close Prisma connection
 */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
