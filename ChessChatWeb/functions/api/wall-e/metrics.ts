/**
 * Cloudflare Function: Sync Wall-E Learning Metrics to Database
 * POST /api/wall-e/metrics (save metric)
 * GET /api/wall-e/metrics?userId=xxx (fetch all metrics for user)
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
    const metricData = await context.request.json();
    const {
      userId,
      sessionStart,
      sessionEnd,
      gameCount,
      mistakesIdentified,
      mistakesCorrected,
      totalMoves,
      insights,
      progress,
    } = metricData;

    if (!userId || !sessionStart) {
      return new Response(JSON.stringify({ success: false, error: 'userId and sessionStart required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create learning metric
    const metric = await prisma.learningMetric.create({
      data: {
        userId,
        sessionStart: new Date(sessionStart),
        sessionEnd: sessionEnd ? new Date(sessionEnd) : new Date(),
        gameCount: gameCount || 0,
        mistakesIdentified: mistakesIdentified || 0,
        mistakesCorrected: mistakesCorrected || 0,
        totalMoves: totalMoves || 0,
        insights: JSON.stringify(insights || []),
        progress: JSON.stringify(progress || {}),
      },
    });

    return new Response(JSON.stringify({ success: true, metricId: metric.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Metric sync error:', error);
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

    const metrics = await prisma.learningMetric.findMany({
      where: { userId },
      orderBy: { sessionStart: 'desc' },
    });

    const parsedMetrics = metrics.map(metric => ({
      id: metric.id,
      userId: metric.userId,
      sessionStart: metric.sessionStart,
      sessionEnd: metric.sessionEnd,
      gameCount: metric.gameCount,
      mistakesIdentified: metric.mistakesIdentified,
      mistakesCorrected: metric.mistakesCorrected,
      totalMoves: metric.totalMoves,
      insights: JSON.parse(metric.insights),
      progress: JSON.parse(metric.progress),
    }));

    return new Response(JSON.stringify({ success: true, metrics: parsedMetrics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}
