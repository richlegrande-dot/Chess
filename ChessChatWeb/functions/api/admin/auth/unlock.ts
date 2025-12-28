// Cloudflare Pages Function: Admin Authentication
// Path: /api/admin/auth/unlock

import { getPrismaClient, db } from '../../../lib/db';
import { initializeDatabase } from '../../../lib/dbMiddleware';
import { AdminAuthService } from '../../../lib/adminAuthService';

interface Env {
  ADMIN_PASSWORD: string;
  DB?: D1Database; // D1 binding (preferred)
  DATABASE_URL?: string; // Fallback
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    // Get admin password from environment
    const adminPassword = context.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Admin password not configured on server',
        }),
        {
          status: 503,
          headers: corsHeaders,
        }
      );
    }

    // Initialize database (optional - database features may not be available)
    try {
      await initializeDatabase(context.env);
    } catch (dbError) {
      console.warn('[Admin] Database not available:', dbError);
      // Continue without database - admin auth can work without it
    }

    // Parse request body
    const body = await context.request.json() as { password?: string };
    
    if (!body.password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Password is required',
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Simple password check (without database)
    if (!db.isAvailable()) {
      // No database - do simple password comparison
      if (body.password === adminPassword) {
        // Generate a simple JWT-style token
        const token = Buffer.from(JSON.stringify({
          exp: Date.now() + 3600000, // 1 hour
          iat: Date.now(),
        })).toString('base64');
        
        return new Response(
          JSON.stringify({
            success: true,
            token,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid password',
          }),
          {
            status: 401,
            headers: corsHeaders,
          }
        );
      }
    }

    // Database available - use full auth service
    const prisma = await getPrismaClient();
    const authService = new AdminAuthService(prisma, adminPassword);
    const session = await authService.unlock(body.password);

    return new Response(
      JSON.stringify({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Check if it's an invalid password error
    if (message.includes('Invalid password')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid password',
        }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // Check if database is not ready
    if (message.includes('Database is not ready')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Service unavailable: Database not ready',
        }),
        {
          status: 503,
          headers: corsHeaders,
        }
      );
    }

    // Other errors
    console.error('[Admin] Unlock error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred during authentication',
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
