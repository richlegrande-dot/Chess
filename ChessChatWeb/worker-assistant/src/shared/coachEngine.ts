/**
 * CoachEngine Service
 * 
 * Self-contained chess coach using knowledge base (when available).
 * Degrades gracefully without database access.
 * 
 * Core Capabilities:
 * - Retrieve relevant knowledge chunks based on game context (if DB available)
 * - Generate coaching takeaways from knowledge base
 * - Provide contextual advice for tactical/strategic positions
 * - No external API dependencies (fully self-contained)
 */

import { getPrisma } from './prisma';
import { PrismaClient } from '@prisma/client/edge';

// Local types to avoid dependency on broken analysis types
interface GameAnalysisResult {
  overallRating: number;
  gameStats: {
    blunders: number;
    mistakes: number;
    inaccuracies?: number;
    accuracyPercentage: number;
  };
  takeaways: Array<{
    title: string;
    description: string;
    category?: string;
  }>;
}

interface KnowledgeChunk {
  id: string;
  sourceId: string;
  chunkText: string;
  tags: string;
  language: string;
  metadata: string;
  source: {
    title: string;
    sourceType: string;
  };
}

interface CoachingContext {
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  playerColor: 'white' | 'black';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  themes: string[];
  moveCount?: number;
  materialBalance?: number;
}

interface CoachingAdvice {
  advice: string;
  relevantKnowledge: string[];
  sources: string[];
  confidence: number;
}

export class CoachEngine {
  // Database is optional - coach engine works without it
  private databaseUrl?: string;

  constructor(databaseUrl?: string) {
    this.databaseUrl = databaseUrl;
  }

  /**
   * Retrieve relevant knowledge chunks based on context (requires database)
   */
  async retrieveRelevantKnowledge(context: CoachingContext, limit: number = 5): Promise<KnowledgeChunk[]> {
    // If no database available, return empty array (graceful degradation)
    if (!this.databaseUrl) {
      return [];
    }

    try {
      const prisma = getPrisma(this.databaseUrl);

      // Build search tags from context
      const searchTags = this.buildSearchTags(context);
      
      // Search for chunks matching any of the tags
      const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        source: {
          isDeleted: false,
        },
        OR: searchTags.map(tag => ({
          tags: {
            contains: tag,
          },
        })),
      },
      include: {
        source: {
          select: {
            title: true,
            sourceType: true,
          },
        },
      },
      take: limit * 2, // Get extra for scoring
    });

    // Score and rank chunks by relevance
    const scoredChunks = chunks.map(chunk => ({
      chunk,
      score: this.scoreChunkRelevance(chunk, context),
    }));

    // Sort by score and return top N
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(sc => sc.chunk);
    } catch (error) {
      console.warn('[CoachEngine] Knowledge retrieval failed:', error);
      return [];
    }
  }

  /**
   * Build search tags from coaching context
   */
  private buildSearchTags(context: CoachingContext): string[] {
    const tags: string[] = [];

    // Add game phase
    tags.push(context.gamePhase);

    // Add themes
    tags.push(...context.themes);

    // Add skill-level specific tags
    if (context.skillLevel === 'beginner') {
      tags.push('basics', 'fundamentals', 'principles');
    } else if (context.skillLevel === 'advanced') {
      tags.push('advanced', 'technique', 'mastery');
    }

    // Add opening-specific tags
    if (context.gamePhase === 'opening') {
      tags.push('development', 'center', 'castling', 'king-safety');
    }

    // Add endgame-specific tags
    if (context.gamePhase === 'endgame') {
      tags.push('pawn', 'rook', 'king-activity', 'opposition');
    }

    return tags;
  }

  /**
   * Score chunk relevance to context
   */
  private scoreChunkRelevance(chunk: KnowledgeChunk, context: CoachingContext): number {
    let score = 0;
    const chunkTags = this.parseTagsJson(chunk.tags);
    const chunkText = chunk.chunkText.toLowerCase();

    // Exact tag matches (high weight)
    for (const tag of context.themes) {
      if (chunkTags.includes(tag.toLowerCase())) {
        score += 10;
      }
      if (chunkText.includes(tag.toLowerCase())) {
        score += 5;
      }
    }

    // Game phase match
    if (chunkTags.includes(context.gamePhase) || chunkText.includes(context.gamePhase)) {
      score += 8;
    }

    // Skill level relevance
    const metadata = this.parseMetadataJson(chunk.metadata);
    if (metadata.skillLevel === context.skillLevel) {
      score += 3;
    }

    // Source type bonus
    if (chunk.source.title.toLowerCase().includes(context.gamePhase)) {
      score += 5;
    }

    // Tactics-related sources get bonus for tactical themes
    if (chunk.source.title.toLowerCase().includes('tactic') && 
        context.themes.some(t => ['pin', 'fork', 'skewer', 'tactics'].includes(t.toLowerCase()))) {
      score += 7;
    }

    return score;
  }

  /**
   * Generate coaching advice from game analysis
   */
  async generateCoachingAdvice(
    analysisResult: GameAnalysisResult,
    context: CoachingContext
  ): Promise<CoachingAdvice> {
    // Retrieve relevant knowledge
    const knowledgeChunks = await this.retrieveRelevantKnowledge(context, 5);

    if (knowledgeChunks.length === 0) {
      return {
        advice: this.generateFallbackAdvice(analysisResult, context),
        relevantKnowledge: [],
        sources: [],
        confidence: 0.3,
      };
    }

    // Extract key points from knowledge chunks
    const keyPoints = knowledgeChunks.map(chunk => 
      this.extractKeyPoints(chunk.chunkText)
    ).flat();

    // Generate advice combining analysis and knowledge
    const advice = this.synthesizeAdvice(analysisResult, keyPoints, context);

    return {
      advice,
      relevantKnowledge: knowledgeChunks.map(c => c.chunkText),
      sources: [...new Set(knowledgeChunks.map(c => c.source.title))],
      confidence: Math.min(0.9, 0.5 + (knowledgeChunks.length * 0.1)),
    };
  }

  /**
   * Extract key teaching points from knowledge chunk
   */
  private extractKeyPoints(chunkText: string): string[] {
    const points: string[] = [];

    // Extract sentences with key indicators
    const sentences = chunkText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Look for instructional patterns
      if (
        lowerSentence.includes('always') ||
        lowerSentence.includes('never') ||
        lowerSentence.includes('should') ||
        lowerSentence.includes('must') ||
        lowerSentence.includes('key') ||
        lowerSentence.includes('important') ||
        lowerSentence.includes('remember') ||
        lowerSentence.includes('rule') ||
        lowerSentence.match(/\d+\./) // Numbered lists
      ) {
        points.push(sentence);
      }
    }

    return points.slice(0, 3); // Top 3 most relevant points
  }

  /**
   * Synthesize coaching advice from analysis and knowledge
   */
  private synthesizeAdvice(
    analysis: GameAnalysisResult,
    keyPoints: string[],
    context: CoachingContext
  ): string {
    const sections: string[] = [];

    // Game overview
    sections.push(`Game Analysis (${context.gamePhase} phase):`);
    sections.push(`Overall Rating: ${analysis.overallRating}/100`);
    sections.push(`Accuracy: ${analysis.gameStats.accuracyPercentage}%`);

    if (analysis.gameStats.blunders > 0) {
      sections.push(`⚠️ Blunders: ${analysis.gameStats.blunders}`);
    }

    sections.push(''); // Blank line

    // Key takeaways from analysis
    if (analysis.takeaways.length > 0) {
      sections.push('Key Areas for Improvement:');
      analysis.takeaways.slice(0, 3).forEach((takeaway, i) => {
        sections.push(`${i + 1}. ${takeaway.title}: ${takeaway.description}`);
      });
      sections.push(''); // Blank line
    }

    // Knowledge-based advice
    if (keyPoints.length > 0) {
      sections.push('Coaching Guidance:');
      keyPoints.forEach(point => {
        sections.push(`• ${point}`);
      });
      sections.push(''); // Blank line
    }

    // Specific recommendations
    sections.push('Next Steps:');
    sections.push(this.generateRecommendations(analysis, context));

    return sections.join('\n');
  }

  /**
   * Generate specific recommendations
   */
  private generateRecommendations(analysis: GameAnalysisResult, context: CoachingContext): string {
    const recommendations: string[] = [];

    // Based on blunders/mistakes
    if (analysis.gameStats.blunders > 2) {
      recommendations.push('Practice tactical puzzles daily to reduce blunders');
    } else if (analysis.gameStats.mistakes > 3) {
      recommendations.push('Slow down and calculate candidate moves more carefully');
    }

    // Based on game phase
    if (context.gamePhase === 'opening') {
      recommendations.push('Review opening principles: control center, develop pieces, castle early');
    } else if (context.gamePhase === 'endgame') {
      recommendations.push('Study basic endgame positions to improve technique');
    }

    // Based on accuracy
    if (analysis.gameStats.accuracyPercentage < 70) {
      recommendations.push('Focus on finding the best move, not just a good move');
    }

    // Based on themes
    const commonThemes = analysis.takeaways.map(t => t.category);
    if (commonThemes.includes('tactics')) {
      recommendations.push('Work on pattern recognition with tactical training');
    }
    if (commonThemes.includes('strategy')) {
      recommendations.push('Study positional concepts and long-term planning');
    }

    return recommendations.join('\n• ');
  }

  /**
   * Generate fallback advice when no knowledge chunks found
   */
  private generateFallbackAdvice(analysis: GameAnalysisResult, context: CoachingContext): string {
    const sections: string[] = [];

    sections.push(`Game Analysis Summary:`);
    sections.push(`Rating: ${analysis.overallRating}/100`);
    sections.push(`Blunders: ${analysis.gameStats.blunders}, Mistakes: ${analysis.gameStats.mistakes}`);
    sections.push(`Accuracy: ${analysis.gameStats.accuracyPercentage}%`);
    sections.push('');

    if (analysis.takeaways.length > 0) {
      sections.push('Main Takeaways:');
      analysis.takeaways.slice(0, 3).forEach(t => {
        sections.push(`• ${t.title}: ${t.description}`);
      });
    } else {
      sections.push('Keep practicing and analyzing your games to improve!');
    }

    return sections.join('\n');
  }

  /**
   * Get coaching for specific position or theme
   */
  async getThematicCoaching(theme: string, skillLevel: 'beginner' | 'intermediate' | 'advanced'): Promise<string> {
    const context: CoachingContext = {
      gamePhase: 'middlegame', // Default
      playerColor: 'white',
      skillLevel,
      themes: [theme],
    };

    const chunks = await this.retrieveRelevantKnowledge(context, 3);

    if (chunks.length === 0) {
      return `No specific guidance found for "${theme}". Try practicing tactical puzzles or reviewing basic principles.`;
    }

    // Combine relevant chunks into coaching
    const coaching: string[] = [];
    coaching.push(`Coaching on: ${theme}`);
    coaching.push('');

    chunks.forEach((chunk, i) => {
      const keyPoints = this.extractKeyPoints(chunk.chunkText);
      if (keyPoints.length > 0) {
        coaching.push(`From "${chunk.source.title}":`);
        keyPoints.forEach(point => coaching.push(`• ${point}`));
        coaching.push('');
      }
    });

    return coaching.join('\n');
  }

  /**
   * Search knowledge base by query (requires database)
   */
  async searchKnowledge(query: string, limit: number = 5): Promise<KnowledgeChunk[]> {
    // If no database available, return empty array
    if (!this.databaseUrl) {
      return [];
    }

    try {
      const prisma = getPrisma(this.databaseUrl);

      // Simple text search in chunk content and tags
      const chunks = await prisma.knowledgeChunk.findMany({
        where: {
          source: {
            isDeleted: false,
          },
          OR: [
            { chunkText: { contains: query, mode: 'insensitive' } },
            { tags: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          source: {
            select: {
              title: true,
              sourceType: true,
            },
          },
        },
        take: limit,
      });

      return chunks;
    } catch (error) {
      console.warn('[CoachEngine] Knowledge search failed:', error);
      return [];
    }
  }

  // Helper methods

  private parseTagsJson(tagsJson: string): string[] {
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseMetadataJson(metadataJson: string): any {
    try {
      return JSON.parse(metadataJson);
    } catch {
      return {};
    }
  }
}

// Singleton instance - no DB by default (can be overridden by passing databaseUrl)
let coachEngineInstance: CoachEngine | null = null;

export function getCoachEngine(databaseUrl?: string): CoachEngine {
  if (!coachEngineInstance || (databaseUrl && coachEngineInstance['databaseUrl'] !== databaseUrl)) {
    coachEngineInstance = new CoachEngine(databaseUrl);
  }
  return coachEngineInstance;
}
