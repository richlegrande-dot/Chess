// Cloudflare Pages Function: Admin Logout
// Path: /api/admin/auth/logout

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
    await initializeDatabase(context.env);
    const prisma = await getPrismaClient();
    
    // Get token from header
    const authHeader = context.request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No token provided',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const authService = new AdminAuthService(prisma, context.env.ADMIN_PASSWORD);
    await authService.logout(token);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logged out successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({
        success: true, // Always return success for logout
        message: 'Logged out',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
