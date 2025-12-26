// Cloudflare Pages Function: Knowledge Diagnostics
// Path: /api/admin/knowledge/diagnostics

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

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await initializeDatabase(context.env);
    await requireAuth(context.request, context.env);

    const prisma = await getPrismaClient();
    const knowledgeService = new KnowledgeService(prisma);
    
    const diagnostics = await knowledgeService.getDiagnostics();

    return new Response(
      JSON.stringify(diagnostics),
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

    console.error('Get diagnostics error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
