/**
 * Prisma Client Singleton for Cloudflare Workers/Pages Functions
 * 
 * This module provides a connection-pooled Prisma client optimized for
 * Cloudflare's serverless environment.
 * 
 * Key Features:
 * - Module-level singleton to reuse connections across requests
 * - Prisma Accelerate support for connection pooling
 * - Edge-compatible client
 * - Defensive error handling for missing DATABASE_URL
 * - Safe logging (no credential leakage)
 * 
 * Usage:
 * ```typescript
 * import { getPrisma } from '../lib/prisma';
 * 
 * export async function onRequestPost(context: { request: Request; env: Env }) {
 *   const prisma = getPrisma(context.env.DATABASE_URL);
 *   const results = await prisma.playerProfile.findMany();
 *   // DO NOT call prisma.$disconnect() in production
 *   return Response.json(results);
 * }
 * ```
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

// Module-level singleton cache
let prismaSingleton: PrismaClient | null = null;
let lastDatabaseUrl: string | null = null;

/**
 * Get or create Prisma client singleton
 * 
 * @param databaseUrl - The DATABASE_URL from context.env
 * @returns Prisma client instance
 * @throws Error if DATABASE_URL is missing or invalid
 */
export function getPrisma(databaseUrl: string | undefined): PrismaClient {
  // Defensive check: DATABASE_URL must be provided
  if (!databaseUrl) {
    const error = 'DATABASE_URL not provided. Cannot initialize Prisma client.';
    console.error(`[Prisma] FATAL: ${error}`);
    throw new Error(error);
  }

  // Safe logging: only log prefix to avoid credential leakage
  const urlPrefix = databaseUrl.substring(0, 12);
  
  // Check if we need to create a new client (URL changed)
  if (prismaSingleton && lastDatabaseUrl === databaseUrl) {
    // Reuse existing singleton
    return prismaSingleton;
  }

  // Create new client
  try {
    console.log(`[Prisma] Initializing client for URL prefix: ${urlPrefix}...`);
    
    const basePrisma = new PrismaClient({
      datasourceUrl: databaseUrl,
      log: ['error', 'warn'], // Only log errors and warnings
    });

    // Extend with Accelerate for connection pooling
    prismaSingleton = basePrisma.$extends(withAccelerate()) as any;
    lastDatabaseUrl = databaseUrl;

    console.log(`[Prisma] ✓ Client initialized successfully`);
    return prismaSingleton;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Prisma] ✗ Failed to initialize client: ${message}`);
    throw new Error(`Prisma initialization failed: ${message}`);
  }
}

/**
 * Health check: verify database connectivity
 * 
 * @param prisma - Prisma client instance
 * @returns true if connection is healthy, false otherwise
 */
export async function checkPrismaHealth(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Prisma] Health check failed: ${message}`);
    return false;
  }
}

/**
 * Get safe error response when DATABASE_URL is missing
 * 
 * @param corsHeaders - Optional CORS headers to include
 * @returns Response object with error message
 */
export function getDatabaseErrorResponse(corsHeaders?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Database connection unavailable',
      message: 'DATABASE_URL environment variable is not configured. Please add it in Cloudflare Dashboard > Settings > Environment variables.',
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

/**
 * IMPORTANT: Connection Management for Cloudflare Workers
 * 
 * Do NOT call prisma.$disconnect() in production for Workers/Pages Functions.
 * 
 * Why?
 * - Workers have short request lifecycle
 * - Module-level singleton allows connection reuse across requests
 * - Prisma Accelerate handles connection pooling
 * - Disconnecting on every request defeats the purpose of connection pooling
 * 
 * When to disconnect?
 * - Local development/testing only
 * - Long-running scripts that complete
 * - Cleanup in test teardown
 * 
 * Production pattern:
 * ```typescript
 * const prisma = getPrisma(env.DATABASE_URL);
 * const result = await prisma.model.findMany();
 * // No disconnect - let the singleton persist
 * return Response.json(result);
 * ```
 */
