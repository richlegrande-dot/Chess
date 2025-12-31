/**
 * Stockfish Analysis Cache
 * 
 * Caches Stockfish analysis results to reduce computation costs
 * and improve performance for repeated positions (openings, common tactics).
 * 
 * Uses database-backed caching with TTL expiration.
 */

import type { PrismaClient } from '@prisma/client/edge';
import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface CachedAnalysis {
  evalCp: number | null;
  mate: number | null;
  bestMove: string | null;
  pv: string | null;
  nodes: bigint | null;
  fromCache: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate deterministic cache key from FEN + analysis params
 */
export function generateCacheKey(
  fen: string,
  depth: number,
  movetime: number | undefined
): string {
  const normalized = normalizeFEN(fen);
  const params = `${normalized}:d${depth}:t${movetime || 0}`;
  return createHash('sha256').update(params).digest('hex');
}

/**
 * Normalize FEN to canonical form for caching
 * (remove move counters that don't affect position)
 */
function normalizeFEN(fen: string): string {
  const parts = fen.split(' ');
  // Keep: position, active color, castling, en passant
  // Remove: halfmove clock, fullmove number
  return parts.slice(0, 4).join(' ');
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached analysis if available
 */
export async function getCachedAnalysis(
  prisma: any,
  fen: string,
  depth: number,
  movetime: number | undefined
): Promise<CachedAnalysis | null> {
  const cacheKey = generateCacheKey(fen, depth, movetime);
  
  try {
    const cached = await prisma.analysisCache.findUnique({
      where: { cacheKey },
      select: {
        evalCp: true,
        mate: true,
        bestMove: true,
        pv: true,
        nodes: true,
        expiresAt: true,
        id: true
      }
    });
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (cached.expiresAt < new Date()) {
      // Delete expired entry (fire and forget)
      prisma.analysisCache.delete({
        where: { id: cached.id }
      }).catch(() => {});
      
      return null;
    }
    
    // Update hit count and last used time (fire and forget)
    prisma.analysisCache.update({
      where: { id: cached.id },
      data: {
        hitCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    }).catch(() => {});
    
    return {
      evalCp: cached.evalCp,
      mate: cached.mate,
      bestMove: cached.bestMove,
      pv: cached.pv,
      nodes: cached.nodes,
      fromCache: true
    };
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Store analysis result in cache
 */
export async function setCachedAnalysis(
  prisma: any,
  fen: string,
  depth: number,
  movetime: number | undefined,
  analysis: {
    evalCp?: number | null;
    mate?: number | null;
    bestMove?: string | null;
    pv?: string | null;
    nodes?: bigint | null;
  },
  ttlHours: number = 168 // 7 days default
): Promise<void> {
  const cacheKey = generateCacheKey(fen, depth, movetime);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  
  try {
    await prisma.analysisCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        fen: normalizeFEN(fen),
        depth,
        movetime: movetime || null,
        evalCp: analysis.evalCp || null,
        mate: analysis.mate || null,
        bestMove: analysis.bestMove || null,
        pv: analysis.pv || null,
        nodes: analysis.nodes || null,
        hitCount: 0,
        expiresAt
      },
      update: {
        evalCp: analysis.evalCp || null,
        mate: analysis.mate || null,
        bestMove: analysis.bestMove || null,
        pv: analysis.pv || null,
        nodes: analysis.nodes || null,
        lastUsedAt: new Date(),
        expiresAt
      }
    });
  } catch (error) {
    // Cache write failures are non-fatal
    console.error('[Cache] Error writing cache:', error);
  }
}

/**
 * Clean up expired cache entries (maintenance task)
 */
export async function cleanupExpiredCache(
  prisma: any,
  batchSize: number = 100
): Promise<number> {
  try {
    const result = await prisma.analysisCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('[Cache] Error cleaning up cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(
  prisma: any
): Promise<{
  totalEntries: number;
  totalHits: number;
  avgHitsPerEntry: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  try {
    const [total, stats] = await Promise.all([
      prisma.analysisCache.count(),
      prisma.analysisCache.aggregate({
        _sum: {
          hitCount: true
        },
        _min: {
          createdAt: true
        },
        _max: {
          createdAt: true
        }
      })
    ]);
    
    return {
      totalEntries: total,
      totalHits: stats._sum.hitCount || 0,
      avgHitsPerEntry: total > 0 ? (stats._sum.hitCount || 0) / total : 0,
      oldestEntry: stats._min.createdAt,
      newestEntry: stats._max.createdAt
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return {
      totalEntries: 0,
      totalHits: 0,
      avgHitsPerEntry: 0,
      oldestEntry: null,
      newestEntry: null
    };
  }
}

/**
 * Prune least-used cache entries to stay under size limit
 */
export async function pruneCacheToLimit(
  prisma: any,
  maxEntries: number = 10000
): Promise<number> {
  try {
    // Count current entries
    const currentCount = await prisma.analysisCache.count();
    
    if (currentCount <= maxEntries) {
      return 0;
    }
    
    const toDelete = currentCount - maxEntries;
    
    // Get IDs of least-used entries
    const leastUsed = await prisma.analysisCache.findMany({
      select: { id: true },
      orderBy: [
        { hitCount: 'asc' },
        { lastUsedAt: 'asc' }
      ],
      take: toDelete
    });
    
    // Delete them
    const result = await prisma.analysisCache.deleteMany({
      where: {
        id: {
          in: leastUsed.map(e => e.id)
        }
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('[Cache] Error pruning cache:', error);
    return 0;
  }
}
