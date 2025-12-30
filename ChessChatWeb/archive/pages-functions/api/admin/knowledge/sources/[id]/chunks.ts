// Cloudflare Pages Function: Knowledge Chunks API
// Path: /api/admin/knowledge/sources/[id]/chunks

import { getPrismaClient } from '../../../../../lib/db';
import { initializeDatabase } from '../../../../../lib/dbMiddleware';
import { AdminAuthService } from '../../../../../lib/adminAuthService';
import { KnowledgeService } from '../../../../../lib/knowledgeService';

interface Env {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
}

async function requireAuth(request: Request, env: Env): Promise<void> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized: No token provided');
  }

  const prisma = await getPrismaClient();
  const authService = new AdminAuthService(prisma, env.ADMIN_PASSWORD);
  const isValid = await authService.validateToken(token);

  if (!isValid) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

function getSourceId(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // Path is /api/admin/knowledge/sources/[id]/chunks
  return parts[parts.length - 2];
}

// GET: Get chunks by source ID
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  // Initialize database with environment variables
  await initializeDatabase(context.env);
  try {
    await requireAuth(context.request, context.env);

    const sourceId = getSourceId(context.request);
    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const chunks = await knowledgeService.getChunksBySource(sourceId);

    return new Response(
      JSON.stringify(chunks),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('Unauthorized')) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Get chunks error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST: Create chunk for source
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  // Initialize database with environment variables
  await initializeDatabase(context.env);
  try {
    await requireAuth(context.request, context.env);

    const sourceId = getSourceId(context.request);
    const body = await context.request.json() as any;

    if (!body.chunkText) {
      return new Response(
        JSON.stringify({ error: 'chunkText is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const chunk = await knowledgeService.createChunk(
      {
        sourceId,
        chunkText: body.chunkText,
        tags: body.tags,
        language: body.language,
        metadata: body.metadata,
      },
      'admin'
    );

    return new Response(
      JSON.stringify(chunk),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('Unauthorized')) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Create chunk error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
