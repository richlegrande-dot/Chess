// Cloudflare Pages Function: Admin Authentication
// Path: /api/admin/auth/unlock

import { getPrismaClient } from '../../../lib/db';
import { initializeDatabase } from '../../../lib/dbMiddleware';
import { AdminAuthService } from '../../../lib/adminAuthService';

interface Env {
  ADMIN_PASSWORD: string;
  DATABASE_URL: string;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    // Initialize database
    await initializeDatabase(context.env);
    const prisma = await getPrismaClient();
    
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
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create auth service and attempt unlock
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Other errors
    console.error('Admin unlock error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred during authentication',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
