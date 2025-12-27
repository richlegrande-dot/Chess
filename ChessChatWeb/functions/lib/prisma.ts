/**
 * Prisma Client - Re-export from shared
 * 
 * The actual implementation is in: ../../shared/prisma.ts
 */

export * from '../../shared/prisma';
export { getPrisma } from '../../shared/prisma';
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
