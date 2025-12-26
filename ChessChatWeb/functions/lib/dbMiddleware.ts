/**
 * Database initialization helper for Cloudflare Pages Functions
 * Ensures database is initialized with proper environment variables
 */

import { db } from './db';

interface CloudflareEnv {
  DATABASE_URL?: string;
  [key: string]: any;
}

/**
 * Initialize database with environment variables from Cloudflare context
 * Call this at the start of each Function handler
 */
export async function initializeDatabase(env: CloudflareEnv): Promise<void> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Initialize the singleton db instance with the environment variable
  await db.initialize(env.DATABASE_URL);
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
