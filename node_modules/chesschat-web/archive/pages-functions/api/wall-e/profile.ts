/**
 * Cloudflare Function: Sync Wall-E Player Profile to Database
 * POST /api/wall-e/profile
 */

import { getPrisma, getDatabaseErrorResponse } from '../../lib/prisma';

interface Env {
  DATABASE_URL?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // Check for DATABASE_URL
  if (!context.env.DATABASE_URL) {
    return getDatabaseErrorResponse();
  }

  const prisma = getPrisma(context.env.DATABASE_URL);

  try {
    const profileData = await context.request.json();

    // Generate or use existing user ID
    const userId = profileData.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Upsert player profile
    const profile = await prisma.playerProfile.upsert({
      where: { userId },
      create: {
        userId,
        skillRatings: JSON.stringify(profileData.skillRatings),
        playStyle: profileData.playStyle,
        improvementRate: profileData.improvementRate,
        strengthAreas: JSON.stringify(profileData.strengthAreas),
        weaknessAreas: JSON.stringify(profileData.weaknessAreas),
        commonMistakes: JSON.stringify(profileData.commonMistakes),
        favoriteOpenings: JSON.stringify(profileData.favoriteOpenings),
        ratingHistory: JSON.stringify(profileData.ratingHistory),
        milestones: JSON.stringify(profileData.milestones),
        behavioralPatterns: JSON.stringify(profileData.behavioralPatterns),
        gamesPlayed: profileData.gamesPlayed,
      },
      update: {
        skillRatings: JSON.stringify(profileData.skillRatings),
        playStyle: profileData.playStyle,
        improvementRate: profileData.improvementRate,
        strengthAreas: JSON.stringify(profileData.strengthAreas),
        weaknessAreas: JSON.stringify(profileData.weaknessAreas),
        commonMistakes: JSON.stringify(profileData.commonMistakes),
        favoriteOpenings: JSON.stringify(profileData.favoriteOpenings),
        ratingHistory: JSON.stringify(profileData.ratingHistory),
        milestones: JSON.stringify(profileData.milestones),
        behavioralPatterns: JSON.stringify(profileData.behavioralPatterns),
        gamesPlayed: profileData.gamesPlayed,
      },
    });

    return new Response(JSON.stringify({ success: true, userId: profile.userId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Profile sync error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}

// GET profile
export async function onRequestGet(context: { request: Request; env: Env }) {
  // Check for DATABASE_URL
  if (!context.env.DATABASE_URL) {
    return getDatabaseErrorResponse();
  }

  const prisma = getPrisma(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        userId: profile.userId,
        skillRatings: JSON.parse(profile.skillRatings),
        playStyle: profile.playStyle,
        improvementRate: profile.improvementRate,
        strengthAreas: JSON.parse(profile.strengthAreas),
        weaknessAreas: JSON.parse(profile.weaknessAreas),
        commonMistakes: JSON.parse(profile.commonMistakes),
        favoriteOpenings: JSON.parse(profile.favoriteOpenings),
        ratingHistory: JSON.parse(profile.ratingHistory),
        milestones: JSON.parse(profile.milestones),
        behavioralPatterns: JSON.parse(profile.behavioralPatterns),
        gamesPlayed: profile.gamesPlayed,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}
