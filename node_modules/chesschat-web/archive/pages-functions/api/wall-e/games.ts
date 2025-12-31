/**
 * Cloudflare Function: Sync Wall-E Training Games to Database
 * POST /api/wall-e/games (save game)
 * GET /api/wall-e/games?userId=xxx (fetch all games for user)
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
    const gameData = await context.request.json();
    const { userId, gameIndex, pgn, analysis, metrics } = gameData;

    if (!userId || gameIndex === undefined) {
      return new Response(JSON.stringify({ success: false, error: 'userId and gameIndex required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert training game (50-game rolling window)
    const game = await prisma.trainingGame.upsert({
      where: {
        userId_gameIndex: { userId, gameIndex },
      },
      create: {
        userId,
        gameIndex,
        pgn: pgn || '',
        analysis: JSON.stringify(analysis || {}),
        metrics: JSON.stringify(metrics || {}),
      },
      update: {
        pgn: pgn || '',
        analysis: JSON.stringify(analysis || {}),
        metrics: JSON.stringify(metrics || {}),
        timestamp: new Date(),
      },
    });

    return new Response(JSON.stringify({ success: true, gameId: game.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Game sync error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}

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

    const games = await prisma.trainingGame.findMany({
      where: { userId },
      orderBy: { gameIndex: 'asc' },
    });

    const parsedGames = games.map(game => ({
      id: game.id,
      userId: game.userId,
      gameIndex: game.gameIndex,
      pgn: game.pgn,
      analysis: JSON.parse(game.analysis),
      metrics: JSON.parse(game.metrics),
      timestamp: game.timestamp,
    }));

    return new Response(JSON.stringify({ success: true, games: parsedGames }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Games fetch error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}
