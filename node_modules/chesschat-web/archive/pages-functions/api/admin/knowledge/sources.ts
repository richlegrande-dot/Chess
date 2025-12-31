// Cloudflare Pages Function: Knowledge Sources CRUD
// Path: /api/admin/knowledge/sources

import { getPrismaClient } from '../../../lib/db';
import { initializeDatabase } from '../../../lib/dbMiddleware';
import { AdminAuthService } from '../../../lib/adminAuthService';
import { KnowledgeService } from '../../../lib/knowledgeService';

interface Env {
  ADMIN_PASSWORD: string;
  DATABASE_URL: string;
}

async function requireAuth(request: Request, env: Env): Promise<void> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized: No token provided');
  }

  await initializeDatabase(env);
  const prisma = await getPrismaClient();
  const authService = new AdminAuthService(prisma, env.ADMIN_PASSWORD);
  const isValid = await authService.validateToken(token);

  if (!isValid) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

// GET: List sources
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.request, context.env);

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const result = await knowledgeService.getSources(page, limit);

    return new Response(
      JSON.stringify(result),
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
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (message.includes('Database is not ready')) {
      return new Response(
        JSON.stringify({ error: 'Service unavailable' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.error('Get sources error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// POST: Create source
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.request, context.env);

    const body = await context.request.json() as {
      title?: string;
      sourceType?: string;
      url?: string;
    };

    if (!body.title || !body.sourceType) {
      return new Response(
        JSON.stringify({ error: 'title and sourceType are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const source = await knowledgeService.createSource(
      {
        title: body.title,
        sourceType: body.sourceType as any,
        url: body.url,
      },
      'admin'
    );

    return new Response(
      JSON.stringify(source),
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
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.error('Create source error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
