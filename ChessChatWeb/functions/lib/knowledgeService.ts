/**
 * Knowledge Service - CRUD operations for Knowledge Vault
 * 
 * Implements:
 * - Source and chunk management
 * - Soft delete for sources
 * - Audit logging for all operations
 * - Chunk count tracking
 */

import { PrismaClient, KnowledgeSource, KnowledgeChunk } from '@prisma/client';

export interface CreateSourceInput {
  title: string;
  sourceType: 'DOC' | 'URL' | 'NOTE' | 'IMPORT';
  url?: string;
}

export interface UpdateSourceInput {
  title?: string;
  sourceType?: 'DOC' | 'URL' | 'NOTE' | 'IMPORT';
  url?: string;
}

export interface CreateChunkInput {
  sourceId: string;
  chunkText: string;
  tags?: string[];
  language?: string;
  metadata?: Record<string, any>;
}

export interface UpdateChunkInput {
  chunkText?: string;
  tags?: string[];
  language?: string;
  metadata?: Record<string, any>;
}

export interface SourceWithCount extends KnowledgeSource {
  _count: {
    chunks: number;
  };
}

export class KnowledgeService {
  constructor(private prisma: PrismaClient) {}

  // ========================================================================
  // SOURCES
  // ========================================================================

  async getSources(page = 1, limit = 50): Promise<{ sources: SourceWithCount[]; total: number }> {
    const skip = (page - 1) * limit;

    const [sources, total] = await Promise.all([
      this.prisma.knowledgeSource.findMany({
        where: { isDeleted: false },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.knowledgeSource.count({
        where: { isDeleted: false },
      }),
    ]);

    return { sources, total };
  }

  async getSourceById(id: string): Promise<SourceWithCount | null> {
    return this.prisma.knowledgeSource.findFirst({
      where: { id, isDeleted: false },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  async createSource(input: CreateSourceInput, actor: string): Promise<KnowledgeSource> {
    const source = await this.prisma.knowledgeSource.create({
      data: input,
    });

    // Audit log
    await this.logEdit(actor, 'CREATE', 'Source', source.id, null, source);

    return source;
  }

  async updateSource(id: string, input: UpdateSourceInput, actor: string): Promise<KnowledgeSource> {
    const before = await this.prisma.knowledgeSource.findUnique({ where: { id } });
    
    const source = await this.prisma.knowledgeSource.update({
      where: { id },
      data: input,
    });

    // Audit log
    await this.logEdit(actor, 'UPDATE', 'Source', source.id, before, source);

    return source;
  }

  async deleteSource(id: string, actor: string): Promise<void> {
    const before = await this.prisma.knowledgeSource.findUnique({ where: { id } });

    await this.prisma.knowledgeSource.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Audit log
    await this.logEdit(actor, 'DELETE', 'Source', id, before, null);
  }

  // ========================================================================
  // CHUNKS
  // ========================================================================

  async getChunksBySource(sourceId: string): Promise<KnowledgeChunk[]> {
    return this.prisma.knowledgeChunk.findMany({
      where: { sourceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getChunkById(id: string): Promise<KnowledgeChunk | null> {
    return this.prisma.knowledgeChunk.findUnique({
      where: { id },
    });
  }

  async createChunk(input: CreateChunkInput, actor: string): Promise<KnowledgeChunk> {
    const chunk = await this.prisma.knowledgeChunk.create({
      data: {
        sourceId: input.sourceId,
        chunkText: input.chunkText,
        tags: JSON.stringify(input.tags || []),
        language: input.language,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    // Audit log
    await this.logEdit(actor, 'CREATE', 'Chunk', chunk.id, null, chunk);

    return chunk;
  }

  async updateChunk(id: string, input: UpdateChunkInput, actor: string): Promise<KnowledgeChunk> {
    const before = await this.prisma.knowledgeChunk.findUnique({ where: { id } });

    const chunk = await this.prisma.knowledgeChunk.update({
      where: { id },
      data: {
        chunkText: input.chunkText,
        tags: input.tags ? JSON.stringify(input.tags) : undefined,
        language: input.language,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    });

    // Audit log
    await this.logEdit(actor, 'UPDATE', 'Chunk', chunk.id, before, chunk);

    return chunk;
  }

  async deleteChunk(id: string, actor: string): Promise<void> {
    const before = await this.prisma.knowledgeChunk.findUnique({ where: { id } });

    await this.prisma.knowledgeChunk.delete({
      where: { id },
    });

    // Audit log
    await this.logEdit(actor, 'DELETE', 'Chunk', id, before, null);
  }

  // ========================================================================
  // SEARCH & RETRIEVAL
  // ========================================================================

  async searchChunks(query: string, tags?: string[], limit = 10): Promise<KnowledgeChunk[]> {
    // Simple text search (can be enhanced with full-text search or vector embeddings)
    const where: any = {
      source: { isDeleted: false },
      chunkText: {
        contains: query,
        mode: 'insensitive',
      },
    };

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      where.OR = tags.map(tag => ({
        tags: {
          contains: `"${tag}"`,
        },
      }));
    }

    return this.prisma.knowledgeChunk.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChunksByTags(tags: string[], limit = 10): Promise<KnowledgeChunk[]> {
    // Find chunks that have any of the specified tags
    return this.prisma.knowledgeChunk.findMany({
      where: {
        source: { isDeleted: false },
        OR: tags.map(tag => ({
          tags: {
            contains: `"${tag}"`,
          },
        })),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========================================================================
  // DIAGNOSTICS
  // ========================================================================

  async getDiagnostics() {
    const [totalSources, totalChunks, chunksPerSource] = await Promise.all([
      this.prisma.knowledgeSource.count({ where: { isDeleted: false } }),
      this.prisma.knowledgeChunk.count(),
      this.prisma.knowledgeChunk.groupBy({
        by: ['sourceId'],
        _count: { id: true },
      }),
    ]);

    // Get sources with their counts
    const sourcesWithCounts = await this.prisma.knowledgeSource.findMany({
      where: { isDeleted: false },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    // Detect mismatches
    const mismatches = sourcesWithCounts
      .map(source => {
        const groupByCount = chunksPerSource.find(c => c.sourceId === source.id)?._count.id || 0;
        const relationCount = source._count.chunks;
        
        return {
          sourceId: source.id,
          title: source.title,
          relationCount,
          groupByCount,
          mismatch: relationCount !== groupByCount,
        };
      })
      .filter(s => s.mismatch);

    return {
      totalSources,
      totalChunks,
      chunksPerSource: chunksPerSource.map(c => ({
        sourceId: c.sourceId,
        count: c._count.id,
      })),
      mismatches,
      status: mismatches.length === 0 ? 'OK' : 'MISMATCH_DETECTED',
    };
  }

  // ========================================================================
  // AUDIT LOG
  // ========================================================================

  private async logEdit(
    actor: string,
    action: string,
    entityType: string,
    entityId: string,
    before: any,
    after: any
  ): Promise<void> {
    await this.prisma.knowledgeEditLog.create({
      data: {
        actor,
        action,
        entityType,
        entityId,
        beforeJson: before ? JSON.stringify(before) : null,
        afterJson: after ? JSON.stringify(after) : null,
      },
    });
  }

  async getAuditLog(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.knowledgeEditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.knowledgeEditLog.count(),
    ]);

    return { logs, total };
  }
}
