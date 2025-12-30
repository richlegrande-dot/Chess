/**
 * POST /api/admin/coach
 * 
 * Generate coaching advice using CoachEngine and Knowledge Vault.
 * Protected endpoint - requires admin authentication.
 */

import { getPrismaClient } from '../../lib/db';
import { initializeDatabase } from '../../lib/dbMiddleware';
import { AdminAuthService } from '../../lib/adminAuthService';
import { getCoachEngine } from '../../lib/coachEngine.ts';

interface CoachRequest {
  gameAnalysis?: any;
  context: {
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    playerColor: 'white' | 'black';
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    themes: string[];
    moveCount?: number;
    materialBalance?: number;
  };
  action: 'generate_advice' | 'thematic_coaching' | 'search_knowledge';
  query?: string;
  theme?: string;
}

interface Env {
  ADMIN_PASSWORD: string;
  DATABASE_URL: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    // Initialize database
    await initializeDatabase(env);
    const prisma = await getPrismaClient();
    
    // Verify session
    const sessionToken = request.headers.get('X-Session-Token');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Missing session token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create auth service and validate token
    const authService = new AdminAuthService(prisma, env.ADMIN_PASSWORD);
    const isValid = await authService.validateToken(sessionToken);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: CoachRequest = await request.json();
    const { action, context: coachContext, gameAnalysis, query, theme } = body;

    // Get coach engine
    const coachEngine = getCoachEngine();

    // Handle different actions
    let result: any;

    switch (action) {
      case 'generate_advice':
        if (!gameAnalysis || !coachContext) {
          return new Response(
            JSON.stringify({ error: 'Missing gameAnalysis or context' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        result = await coachEngine.generateCoachingAdvice(gameAnalysis, coachContext);
        break;

      case 'thematic_coaching':
        if (!theme || !coachContext?.skillLevel) {
          return new Response(
            JSON.stringify({ error: 'Missing theme or skillLevel' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const coaching = await coachEngine.getThematicCoaching(theme, coachContext.skillLevel);
        result = { coaching, theme };
        break;

      case 'search_knowledge':
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Missing query' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const chunks = await coachEngine.searchKnowledge(query, 10);
        result = {
          query,
          results: chunks.map(chunk => ({
            id: chunk.id,
            text: chunk.chunkText.slice(0, 300) + (chunk.chunkText.length > 300 ? '...' : ''),
            fullText: chunk.chunkText,
            tags: chunk.tags,
            source: chunk.source.title,
          })),
          count: chunks.length,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Coach endpoint error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process coaching request',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
