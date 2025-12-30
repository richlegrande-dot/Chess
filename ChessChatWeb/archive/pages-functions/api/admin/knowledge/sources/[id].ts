// Cloudflare Pages Function: Get/Update/Delete Single Source
// Path: /api/admin/knowledge/sources/[id]

import { getPrismaClient } from '../../../../lib/db';
import { initializeDatabase } from '../../../../lib/dbMiddleware';
import { AdminAuthService } from '../../../../lib/adminAuthService';
import { KnowledgeService } from '../../../../lib/knowledgeService';

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

function getSourceId(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1];
}

// GET: Get source by ID
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.request, context.env);

    const id = getSourceId(context.request);
    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const source = await knowledgeService.getSourceById(id);

    if (!source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(source),
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

    console.error('Get source error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PATCH: Update source
export async function onRequestPatch(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.request, context.env);

    const id = getSourceId(context.request);
    const body = await context.request.json() as any;

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const source = await knowledgeService.updateSource(id, body, 'admin');

    return new Response(
      JSON.stringify(source),
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

    console.error('Update source error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE: Soft delete source
export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.request, context.env);

    const id = getSourceId(context.request);

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    await knowledgeService.deleteSource(id, 'admin');

    return new Response(
      JSON.stringify({ success: true, message: 'Source deleted' }),
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

    console.error('Delete source error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
