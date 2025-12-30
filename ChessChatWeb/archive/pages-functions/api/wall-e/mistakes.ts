/**
 * Cloudflare Function: Sync Wall-E Mistake Signatures to Database
 * POST /api/wall-e/mistakes (save mistake)
 * GET /api/wall-e/mistakes?userId=xxx (fetch all mistakes for user)
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
    const mistakeData = await context.request.json();
    const {
      userId,
      category,
      title,
      description,
      patternDetails,
      occurrenceCount,
      lastOccurrence,
      confidenceScore,
      masteryScore,
      examplePositions,
      relatedConcepts,
    } = mistakeData;

    if (!userId || !category || !title) {
      return new Response(JSON.stringify({ success: false, error: 'userId, category, and title required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create or update mistake signature
    const mistake = await prisma.mistakeSignature.upsert({
      where: {
        userId_category_title: { userId, category, title },
      },
      create: {
        userId,
        category,
        title,
        description: description || '',
        patternDetails: JSON.stringify(patternDetails || {}),
        occurrenceCount: occurrenceCount || 1,
        lastOccurrence: lastOccurrence ? new Date(lastOccurrence) : new Date(),
        confidenceScore: confidenceScore || 0.5,
        masteryScore: masteryScore || 0,
        examplePositions: JSON.stringify(examplePositions || []),
        relatedConcepts: JSON.stringify(relatedConcepts || []),
      },
      update: {
        description: description || undefined,
        patternDetails: JSON.stringify(patternDetails || {}),
        occurrenceCount: occurrenceCount || undefined,
        lastOccurrence: lastOccurrence ? new Date(lastOccurrence) : undefined,
        confidenceScore: confidenceScore || undefined,
        masteryScore: masteryScore || undefined,
        examplePositions: JSON.stringify(examplePositions || []),
        relatedConcepts: JSON.stringify(relatedConcepts || []),
      },
    });

    return new Response(JSON.stringify({ success: true, mistakeId: mistake.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Mistake sync error:', error);
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

    const mistakes = await prisma.mistakeSignature.findMany({
      where: { userId },
      orderBy: { occurrenceCount: 'desc' },
    });

    const parsedMistakes = mistakes.map(mistake => ({
      id: mistake.id,
      userId: mistake.userId,
      category: mistake.category,
      title: mistake.title,
      description: mistake.description,
      patternDetails: JSON.parse(mistake.patternDetails),
      occurrenceCount: mistake.occurrenceCount,
      lastOccurrence: mistake.lastOccurrence,
      confidenceScore: mistake.confidenceScore,
      masteryScore: mistake.masteryScore,
      examplePositions: JSON.parse(mistake.examplePositions),
      relatedConcepts: JSON.parse(mistake.relatedConcepts),
      createdAt: mistake.createdAt,
    }));

    return new Response(JSON.stringify({ success: true, mistakes: parsedMistakes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Mistakes fetch error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Note: No $disconnect() - singleton persists across requests
}
