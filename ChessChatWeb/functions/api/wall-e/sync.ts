/**
 * Cloudflare Function: Bulk sync all Wall-E data from localStorage to Database
 * POST /api/wall-e/sync
 * 
 * Accepts complete localStorage state and syncs all tables at once.
 * This is used for initial migration and periodic full syncs.
 * 
 * ENFORCES: 50-game rolling window (server-side)
 */

import { getPrisma, getDatabaseErrorResponse } from '../../lib/prisma';
import { enforce50GameWindow } from '../../lib/learningProgress';

interface Env {
  DATABASE_URL?: string;
}

interface SyncPayload {
  userId: string;
  playerProfile?: any;
  trainingGames?: any[];
  mistakeSignatures?: any[];
  learningMetrics?: any[];
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // Check for DATABASE_URL
  if (!context.env.DATABASE_URL) {
    return getDatabaseErrorResponse();
  }

  const prisma = getPrisma(context.env.DATABASE_URL);

  try {
    const syncData: SyncPayload = await context.request.json();
    const { userId, playerProfile, trainingGames, mistakeSignatures, learningMetrics } = syncData;

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = {
      profileSynced: false,
      gamesSynced: 0,
      mistakesSynced: 0,
      metricsSynced: 0,
    };

    // Sync player profile
    if (playerProfile) {
      await prisma.playerProfile.upsert({
        where: { userId },
        create: {
          userId,
          skillRatings: JSON.stringify(playerProfile.skillRatings || {}),
          playStyle: playerProfile.playStyle || 'balanced',
          improvementRate: playerProfile.improvementRate || 0,
          strengthAreas: JSON.stringify(playerProfile.strengthAreas || []),
          weaknessAreas: JSON.stringify(playerProfile.weaknessAreas || []),
          commonMistakes: JSON.stringify(playerProfile.commonMistakes || []),
          favoriteOpenings: JSON.stringify(playerProfile.favoriteOpenings || []),
          ratingHistory: JSON.stringify(playerProfile.ratingHistory || []),
          milestones: JSON.stringify(playerProfile.milestones || []),
          behavioralPatterns: JSON.stringify(playerProfile.behavioralPatterns || {}),
          gamesPlayed: playerProfile.gamesPlayed || 0,
        },
        update: {
          skillRatings: JSON.stringify(playerProfile.skillRatings || {}),
          playStyle: playerProfile.playStyle || 'balanced',
          improvementRate: playerProfile.improvementRate || 0,
          strengthAreas: JSON.stringify(playerProfile.strengthAreas || []),
          weaknessAreas: JSON.stringify(playerProfile.weaknessAreas || []),
          commonMistakes: JSON.stringify(playerProfile.commonMistakes || []),
          favoriteOpenings: JSON.stringify(profileProfile.favoriteOpenings || []),
          ratingHistory: JSON.stringify(playerProfile.ratingHistory || []),
          milestones: JSON.stringify(playerProfile.milestones || []),
          behavioralPatterns: JSON.stringify(playerProfile.behavioralPatterns || {}),
          gamesPlayed: playerProfile.gamesPlayed || 0,
        },
      });
      results.profileSynced = true;
    }

    // Sync training games (50-game rolling window)
    if (trainingGames && Array.isArray(trainingGames)) {
      for (const game of trainingGames) {
        await prisma.trainingGame.upsert({
          where: {
            userId_gameIndex: { userId, gameIndex: game.gameIndex },
          },
          create: {
            userId,
            gameIndex: game.gameIndex,
            pgn: game.pgn || '',
            analysis: JSON.stringify(game.analysis || {}),
            metrics: JSON.stringify(game.metrics || {}),
            timestamp: game.timestamp ? new Date(game.timestamp) : new Date(),
          },
          update: {
            pgn: game.pgn || '',
            analysis: JSON.stringify(game.analysis || {}),
            metrics: JSON.stringify(game.metrics || {}),
            timestamp: game.timestamp ? new Date(game.timestamp) : new Date(),
          },
        });
        results.gamesSynced++;
      }
      
      // ENFORCE: 50-game window (server-side rule)
      await enforce50GameWindow(prisma, userId);
    }

    // Sync mistake signatures
    if (mistakeSignatures && Array.isArray(mistakeSignatures)) {
      for (const mistake of mistakeSignatures) {
        await prisma.mistakeSignature.upsert({
          where: {
            userId_category_title: {
              userId,
              category: mistake.category,
              title: mistake.title,
            },
          },
          create: {
            userId,
            category: mistake.category,
            title: mistake.title,
            description: mistake.description || '',
            patternDetails: JSON.stringify(mistake.patternDetails || {}),
            occurrenceCount: mistake.occurrenceCount || 1,
            lastOccurrence: mistake.lastOccurrence ? new Date(mistake.lastOccurrence) : new Date(),
            confidenceScore: mistake.confidenceScore || 0.5,
            masteryScore: mistake.masteryScore || 0,
            examplePositions: JSON.stringify(mistake.examplePositions || []),
            relatedConcepts: JSON.stringify(mistake.relatedConcepts || []),
          },
          update: {
            description: mistake.description || '',
            patternDetails: JSON.stringify(mistake.patternDetails || {}),
            occurrenceCount: mistake.occurrenceCount || 1,
            lastOccurrence: mistake.lastOccurrence ? new Date(mistake.lastOccurrence) : new Date(),
            confidenceScore: mistake.confidenceScore || 0.5,
            masteryScore: mistake.masteryScore || 0,
            examplePositions: JSON.stringify(mistake.examplePositions || []),
            relatedConcepts: JSON.stringify(mistake.relatedConcepts || []),
          },
        });
        results.mistakesSynced++;
      }
    }

    // Sync learning metrics
    if (learningMetrics && Array.isArray(learningMetrics)) {
      for (const metric of learningMetrics) {
        await prisma.learningMetric.create({
          data: {
            userId,
            sessionStart: metric.sessionStart ? new Date(metric.sessionStart) : new Date(),
            sessionEnd: metric.sessionEnd ? new Date(metric.sessionEnd) : new Date(),
            gameCount: metric.gameCount || 0,
            mistakesIdentified: metric.mistakesIdentified || 0,
            mistakesCorrected: metric.mistakesCorrected || 0,
            totalMoves: metric.totalMoves || 0,
            insights: JSON.stringify(metric.insights || []),
            progress: JSON.stringify(metric.progress || {}),
          },
        });
        results.metricsSynced++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Sync complete',
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}
