/**
 * Database initialization helper for Cloudflare Pages Functions
 * Supports both D1 bindings and traditional DATABASE_URL
 */

import { db } from './db';

interface CloudflareEnv {
  DB?: D1Database; // D1 binding (preferred for Cloudflare)
  DATABASE_URL?: string; // Traditional connection string (fallback)
  [key: string]: any;
}

/**
 * Initialize database with environment variables from Cloudflare context
 * Call this at the start of each Function handler
 * 
 * Prioritizes D1 binding (env.DB) over DATABASE_URL
 */
export async function initializeDatabase(env: CloudflareEnv): Promise<void> {
  // Priority 1: D1 binding (native Cloudflare)
  if (env.DB) {
    console.log('[DB] Using D1 binding');
    await db.initializeD1(env.DB);
    return;
  }
  
  // Priority 2: Traditional DATABASE_URL (for Prisma)
  if (env.DATABASE_URL) {
    console.log('[DB] Using DATABASE_URL');
    await db.initialize(env.DATABASE_URL);
    return;
  }
  
  // Neither available - optional database
  console.warn('[DB] No database configured - database features will be unavailable');
}

/**
 * Middleware wrapper for Cloudflare Pages Functions
 * Automatically initializes database before handler execution
 */
export function withDatabase<T extends CloudflareEnv>(
  handler: (context: { request: Request; env: T; params: any }) => Promise<Response>
) {
  return async (context: { request: Request; env: T; params: any }): Promise<Response> => {
    try {
      // Initialize database with environment variables
      await initializeDatabase(context.env);
      
      // Call the actual handler
      return await handler(context);
    } catch (error) {
      console.error('Database initialization error:', error);
      return new Response(
        JSON.stringify({
          error: 'Database connection failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}
