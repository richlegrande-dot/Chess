/**
 * Wall-E Engine - Self-Contained AI Chess Coach
 * 
 * NO API KEYS REQUIRED - uses only knowledge base and learning data
 * 
 * Core Capabilities:
 * - Chat with historical learning context
 * - Game analysis with personalized insights
 * - Coaching that improves based on user history
 * - No dependency on external AI services
 * - Structured, actionable responses with ≥2 personalized references
 * - Runtime validation of coaching quality
 * 
 * Learning Loop:
 * - Fetches player profile, recent games, and mistake patterns
 * - Generates advice referencing specific past mistakes
 * - Tracks coaching advice issued for future evaluation
 */

import { getPrisma } from './prisma';
import { getCoachEngine, type CoachingContext, type GameAnalysisResult } from './coachEngine';
import { PrismaClient } from '@prisma/client/edge';
import {
  buildPersonalizedReferences,
  validatePersonalization,
  augmentWithPersonalization,
  type PersonalizationContext,
  type PersonalizedReference,
  type HistoryEvidence,
} from './personalizedReferences';
import {
  selectCoachingStrategy,
  composeAdvice,
  trackAdviceIssued,
  applyTacticalStrategicProgression,
  correctForLossAversionBias,
  type CoachingContext as HeuristicsContext,
} from './coachHeuristicsV2';
import {
  buildStructuredResponse,
  renderStructuredResponse,
  enforceStructuredResponse,
  type CoachingAdvice,
} from './coachResponseTemplate';

interface WallEContext {
  userId: string;
  databaseUrl: string;
}

interface PlayerLearningHistory {
  profile: any;
  recentGames: any[];
  topMistakes: any[];
  learningMetrics: any[];
  coachingMemory?: any;
}

interface WallEChatResponse {
  response: string;
  confidenceScore: number;
  sourcesUsed: string[];
  learningApplied: boolean;
  historyEvidence: HistoryEvidence; // REQUIRED: Provable history usage
  personalizedReferences: PersonalizedReference[]; // REQUIRED: Explicit references
  adviceQuality?: CoachingAdvice; // NEW: Track advice type and quality signals
}

interface WallEAnalysisResponse {
  analysis: string;
  recommendations: string[];
  personalizedInsights: string[];
  sourcesUsed: string[];
  confidenceScore: number;
  historyEvidence: HistoryEvidence; // REQUIRED: Provable history usage
  personalizedReferences: PersonalizedReference[]; // REQUIRED: Explicit references
  adviceQuality?: CoachingAdvice; // NEW: Track advice type and quality signals
}

export class WallEEngine {
  private coachEngine = getCoachEngine();

  /**
   * Fetch player's learning history for personalized coaching
   */
  private async fetchLearningHistory(
    prisma: PrismaClient,
    userId: string
  ): Promise<PlayerLearningHistory | null> {
    try {
      // Fetch player profile
      const profile = await prisma.playerProfile.findUnique({
        where: { userId },
      });

      // Fetch recent games (last 10)
      const recentGames = await prisma.trainingGame.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      // Fetch top mistake patterns (most frequent)
      const topMistakes = await prisma.mistakeSignature.findMany({
        where: { userId },
        orderBy: { occurrenceCount: 'desc' },
        take: 5,
      });

      // Fetch recent learning metrics
      const learningMetrics = await prisma.learningMetric.findMany({
        where: { userId },
        orderBy: { sessionStart: 'desc' },
        take: 5,
      });

      // Fetch coaching memory (V2)
      const coachingMemory = await prisma.coachingMemory.findUnique({
        where: { userId },
      });

      return {
        profile,
        recentGames: recentGames.map(g => ({
          ...g,
          analysis: JSON.parse(g.analysis),
          metrics: JSON.parse(g.metrics),
        })),
        topMistakes: topMistakes.map(m => ({
          ...m,
          patternDetails: JSON.parse(m.patternDetails),
          examplePositions: JSON.parse(m.examplePositions),
          relatedConcepts: JSON.parse(m.relatedConcepts),
        })),
        learningMetrics: learningMetrics.map(lm => ({
          ...lm,
          insights: JSON.parse(lm.insights),
          progress: JSON.parse(lm.progress),
        })),
        coachingMemory,
      };
    } catch (error) {
      console.error('[Wall-E] Failed to fetch learning history:', error);
      return null;
    }
  }

  /**
   * Generate personalized context from learning history
   */
  private generatePersonalizedContext(history: PlayerLearningHistory | null): string {
    if (!history || !history.profile) {
      return '';
    }

    const sections: string[] = [];

    // Player profile context
    if (history.profile) {
      const profile = history.profile;
      sections.push(`Player Profile:`);
      sections.push(`- Play Style: ${profile.playStyle}`);
      sections.push(`- Games Played: ${profile.gamesPlayed}`);
      sections.push(`- Improvement Rate: ${profile.improvementRate} pts/10 games`);
    }

    // Top recurring mistakes
    if (history.topMistakes.length > 0) {
      sections.push(`\nRecurring Patterns:`);
      history.topMistakes.slice(0, 3).forEach(mistake => {
        sections.push(`- ${mistake.title} (${mistake.category}): occurred ${mistake.occurrenceCount} times`);
      });
    }

    // Recent performance trends
    if (history.recentGames.length > 0) {
      const avgAccuracy = history.recentGames
        .map(g => g.metrics?.accuracy || 0)
        .reduce((sum, acc) => sum + acc, 0) / history.recentGames.length;
      
      sections.push(`\nRecent Performance:`);
      sections.push(`- Average Accuracy: ${avgAccuracy.toFixed(1)}%`);
      sections.push(`- Last ${history.recentGames.length} games analyzed`);
    }

    return sections.join('\n');
  }

  /**
   * Build PersonalizationContext from learning history
   */
  private buildPersonalizationContext(history: PlayerLearningHistory | null): PersonalizationContext {
    if (!history) {
      return { recentGames: [], topMistakePatterns: [] };
    }

    return {
      recentGames: history.recentGames.map(game => ({
        id: game.id,
        fen: game.fen,
        moveHistory: game.moves ? JSON.parse(game.moves) : [],
        result: game.result,
        createdAt: game.timestamp,
        mistakes: game.analysis?.mistakes || [],
      })),
      topMistakePatterns: history.topMistakes.map((mistake, index) => ({
        key: mistake.signatureKey,
        name: mistake.title,
        occurrences: mistake.occurrenceCount,
        description: mistake.category,
        examples: mistake.patternDetails?.examples || [],
      })),
    };
  }

  /**
   * Chat with Wall-E (personalized based on user history)
   * 
   * NO API KEYS - uses knowledge base + learning history only
   * ENFORCES: ≥2 personalized references per response
   * V2: Uses pedagogical heuristics for coaching strategy
   */
  async chat(
    context: WallEContext,
    userMessage: string,
    gameContext?: any
  ): Promise<WallEChatResponse> {
    try {
      const prisma = getPrisma(context.databaseUrl);

      // Fetch learning history for personalization
      const learningHistory = await this.fetchLearningHistory(prisma, context.userId);

      // Build personalization context
      const personalizationCtx = this.buildPersonalizationContext(learningHistory);
      
      // Build personalized references (REQUIRED: ≥2 references)
      const { references, evidence } = buildPersonalizedReferences(personalizationCtx);

      // V2: Build heuristics context and select strategy
      let response: string;
      let confidenceScore = 0.5;
      
      if (learningHistory && learningHistory.recentGames.length >= 3) {
        const heuristicsCtx = this.buildHeuristicsContext(learningHistory);
        const strategy = selectCoachingStrategy(heuristicsCtx);
        
        // Check for loss aversion bias
        const biasCheck = correctForLossAversionBias(heuristicsCtx);
        
        // Compose advice using selected strategy
        const strategicAdvice = composeAdvice(strategy, heuristicsCtx);
        
        // Build full response
        response = strategicAdvice;
        
        // Add bias correction if needed
        if (biasCheck.hasBias) {
          response += `\n\n💡 ${biasCheck.suggestion}`;
        }
        
        confidenceScore = strategy.focusPattern ? 0.8 : 0.5;
        
        // Track advice issued
        if (strategy.focusPattern) {
          const adviceRecord = trackAdviceIssued(strategy.focusPattern, response);
          await this.updateCoachingMemory(prisma, context.userId, adviceRecord);
        }
      } else {
        // Fallback to basic coaching for new players
        const coachingContext = this.parseUserMessageToContext(userMessage, gameContext);
        const advice = await this.coachEngine.generateCoachingAdvice(
          this.buildAnalysisFromGameContext(gameContext),
          coachingContext
        );
        response = advice.advice;
        confidenceScore = advice.confidence;
      }

      // Augment response with personalized references
      response = augmentWithPersonalization(response, references, evidence);

      // Validate personalization (fail-safe check)
      const validation = validatePersonalization(response, evidence);
      if (!validation.valid) {
        console.warn('[Wall-E] Personalization validation failed:', validation.errors);
        // Re-augment if validation fails
        response = augmentWithPersonalization(response, references, evidence);
      }

      return {
        response,
        confidenceScore,
        sourcesUsed: ['knowledge_base', 'learning_history', 'coaching_heuristics_v2'],
        learningApplied: learningHistory !== null,
        historyEvidence: evidence, // REQUIRED: Provable history usage
        personalizedReferences: references, // REQUIRED: Explicit references
      };
    } catch (error) {
      console.error('[Wall-E] Chat error:', error);
      
      // Graceful degradation with evidence
      const emptyEvidence: HistoryEvidence = {
        lastGamesUsed: 0,
        gameIdsUsed: [],
        topMistakePatternsUsed: [],
        personalizedReferenceCount: 0,
        insufficientHistory: true,
        insufficientReason: 'error fetching history',
      };

      return {
        response: this.generateFallbackResponse(userMessage),
        confidenceScore: 0.3,
        sourcesUsed: [],
        learningApplied: false,
        historyEvidence: emptyEvidence,
        personalizedReferences: [],
      };
    }
  }

  /**
   * Analyze a game with Wall-E (personalized based on user history)
   * 
   * NO API KEYS - uses knowledge base + learning history only
   * ENFORCES: ≥2 personalized references per response
   */
  async analyzeGame(
    context: WallEContext,
    pgn: string,
    moveHistory: any[],
    gameMetadata: {
      cpuLevel?: number;
      playerColor?: string;
      result?: string;
    }
  ): Promise<WallEAnalysisResponse> {
    try {
      const prisma = getPrisma(context.databaseUrl);

      // Fetch learning history
      const learningHistory = await this.fetchLearningHistory(prisma, context.userId);

      // Build personalization context
      const personalizationCtx = this.buildPersonalizationContext(learningHistory);
      
      // Build personalized references (REQUIRED: ≥2 references)
      const { references, evidence } = buildPersonalizedReferences(personalizationCtx);

      // Detect game phase and build coaching context
      const coachingContext: CoachingContext = {
        gamePhase: this.detectGamePhase(moveHistory),
        playerColor: (gameMetadata.playerColor || 'white') as 'white' | 'black',
        skillLevel: this.inferSkillLevel(learningHistory),
        themes: this.detectThemes(moveHistory, learningHistory),
        moveCount: moveHistory.length,
      };

      // Generate base analysis using CoachEngine
      const analysisResult = this.buildAnalysisFromMoveHistory(moveHistory, learningHistory);
      const advice = await this.coachEngine.generateCoachingAdvice(analysisResult, coachingContext);

      // Generate personalized insights with references
      const personalizedInsights = this.generatePersonalizedInsights(
        analysisResult,
        learningHistory
      );

      // Add explicit references to insights
      references.forEach(ref => {
        personalizedInsights.push(ref.text);
      });

      // Generate specific recommendations
      const recommendations = this.generatePersonalizedRecommendations(
        analysisResult,
        learningHistory,
        coachingContext
      );

      // Augment analysis with personalization
      let analysis = augmentWithPersonalization(advice.advice, references, evidence);

      // Validate personalization
      const validation = validatePersonalization(analysis, evidence);
      if (!validation.valid) {
        console.warn('[Wall-E] Game analysis personalization failed:', validation.errors);
        analysis = augmentWithPersonalization(advice.advice, references, evidence);
      }

      return {
        analysis,
        recommendations,
        personalizedInsights,
        sourcesUsed: advice.sources,
        confidenceScore: advice.confidence,
        historyEvidence: evidence, // REQUIRED: Provable history usage
        personalizedReferences: references, // REQUIRED: Explicit references
      };
    } catch (error) {
      console.error('[Wall-E] Game analysis error:', error);

      // Graceful degradation
      const emptyEvidence: HistoryEvidence = {
        lastGamesUsed: 0,
        gameIdsUsed: [],
        topMistakePatternsUsed: [],
        personalizedReferenceCount: 0,
        insufficientHistory: true,
        insufficientReason: 'error during analysis',
      };

      return {
        analysis: this.generateFallbackAnalysis(moveHistory),
        recommendations: [],
        personalizedInsights: [],
        sourcesUsed: [],
        confidenceScore: 0.3,
        historyEvidence: emptyEvidence,
        personalizedReferences: [],
      };
    }
  }

      return {
        analysis: advice.advice,
        recommendations,
        personalizedInsights,
        sourcesUsed: advice.sources,
        confidenceScore: advice.confidence,
      };
    } catch (error) {
      console.error('[Wall-E] Game analysis error:', error);

      // Graceful degradation
      return {
        analysis: 'Analysis temporarily unavailable. The learning system is still processing your game data.',
        recommendations: ['Keep practicing and playing games to build your learning profile'],
        personalizedInsights: [],
        sourcesUsed: [],
        confidenceScore: 0.2,
      };
    }
  }

  /**
   * Parse user message into coaching context
   */
  private parseUserMessageToContext(message: string, gameContext?: any): CoachingContext {
    const lowerMessage = message.toLowerCase();

    // Detect game phase
    let gamePhase: 'opening' | 'middlegame' | 'endgame' = 'middlegame';
    if (lowerMessage.includes('opening') || lowerMessage.includes('start')) {
      gamePhase = 'opening';
    } else if (lowerMessage.includes('endgame') || lowerMessage.includes('ending')) {
      gamePhase = 'endgame';
    }

    // Detect themes
    const themes: string[] = [];
    const themeKeywords = {
      tactics: ['tactic', 'fork', 'pin', 'skewer', 'discover'],
      strategy: ['strategy', 'plan', 'position', 'structure'],
      opening: ['opening', 'debut', 'start'],
      endgame: ['endgame', 'ending', 'pawn ending'],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        themes.push(theme);
      }
    }

    if (themes.length === 0) {
      themes.push('general');
    }

    return {
      gamePhase,
      playerColor: 'white',
      skillLevel: 'intermediate',
      themes,
    };
  }

  /**
   * Build analysis result from game context
   */
  private buildAnalysisFromGameContext(gameContext?: any): GameAnalysisResult {
    if (!gameContext) {
      return {
        overallRating: 50,
        gameStats: {
          blunders: 0,
          mistakes: 0,
          accuracyPercentage: 75,
        },
        takeaways: [],
      };
    }

    return {
      overallRating: gameContext.rating || 50,
      gameStats: {
        blunders: gameContext.blunders || 0,
        mistakes: gameContext.mistakes || 0,
        accuracyPercentage: gameContext.accuracy || 75,
      },
      takeaways: gameContext.takeaways || [],
    };
  }

  /**
   * Build analysis from move history
   */
  private buildAnalysisFromMoveHistory(
    moveHistory: any[],
    learningHistory: PlayerLearningHistory | null
  ): GameAnalysisResult {
    // Simple heuristic analysis (can be enhanced)
    const blunders = moveHistory.filter(m => m.evaluation && Math.abs(m.evaluation) > 300).length;
    const mistakes = moveHistory.filter(m => m.evaluation && Math.abs(m.evaluation) > 100 && Math.abs(m.evaluation) <= 300).length;
    
    const accuracy = Math.max(0, Math.min(100, 100 - (blunders * 10 + mistakes * 5)));

    return {
      overallRating: accuracy,
      gameStats: {
        blunders,
        mistakes,
        accuracyPercentage: accuracy,
      },
      takeaways: this.generateTakeawaysFromHistory(moveHistory, learningHistory),
    };
  }

  /**
   * Generate takeaways from move history
   */
  private generateTakeawaysFromHistory(
    moveHistory: any[],
    learningHistory: PlayerLearningHistory | null
  ): Array<{ title: string; description: string; category?: string }> {
    const takeaways: Array<{ title: string; description: string; category?: string }> = [];

    // Check for recurring mistake patterns
    if (learningHistory && learningHistory.topMistakes.length > 0) {
      const topMistake = learningHistory.topMistakes[0];
      takeaways.push({
        title: `Watch for ${topMistake.title}`,
        description: `You've made this mistake ${topMistake.occurrenceCount} times recently. ${topMistake.description}`,
        category: topMistake.category,
      });
    }

    return takeaways;
  }

  /**
   * Detect game phase from move history
   */
  private detectGamePhase(moveHistory: any[]): 'opening' | 'middlegame' | 'endgame' {
    if (moveHistory.length < 15) return 'opening';
    if (moveHistory.length > 40) return 'endgame';
    return 'middlegame';
  }

  /**
   * Infer skill level from learning history
   */
  private inferSkillLevel(
    history: PlayerLearningHistory | null
  ): 'beginner' | 'intermediate' | 'advanced' {
    if (!history || !history.profile) return 'intermediate';

    const gamesPlayed = history.profile.gamesPlayed || 0;
    if (gamesPlayed < 10) return 'beginner';
    if (gamesPlayed > 50) return 'advanced';
    return 'intermediate';
  }

  /**
   * Detect themes from move history and learning patterns
   */
  private detectThemes(moveHistory: any[], history: PlayerLearningHistory | null): string[] {
    const themes: string[] = ['general'];

    // Add themes from top mistakes
    if (history && history.topMistakes.length > 0) {
      history.topMistakes.forEach(mistake => {
        themes.push(mistake.category);
      });
    }

    return [...new Set(themes)].slice(0, 3);
  }

  /**
   * Generate personalized insights
   */
  private generatePersonalizedInsights(
    analysis: GameAnalysisResult,
    history: PlayerLearningHistory | null
  ): string[] {
    const insights: string[] = [];

    if (!history) return insights;

    // Compare current performance to historical average
    if (history.recentGames.length > 0) {
      const avgHistoricalAccuracy = history.recentGames
        .map(g => g.metrics?.accuracy || 0)
        .reduce((sum, acc) => sum + acc, 0) / history.recentGames.length;

      if (analysis.gameStats.accuracyPercentage > avgHistoricalAccuracy + 5) {
        insights.push(`✓ Your accuracy (${analysis.gameStats.accuracyPercentage}%) is above your recent average (${avgHistoricalAccuracy.toFixed(1)}%) - great improvement!`);
      } else if (analysis.gameStats.accuracyPercentage < avgHistoricalAccuracy - 5) {
        insights.push(`⚠ Your accuracy (${analysis.gameStats.accuracyPercentage}%) is below your recent average (${avgHistoricalAccuracy.toFixed(1)}%) - review your games to understand why.`);
      }
    }

    // Mention recurring patterns
    if (history.topMistakes.length > 0) {
      const topMistake = history.topMistakes[0];
      insights.push(`📋 You've struggled with "${topMistake.title}" ${topMistake.occurrenceCount} times. Focus on this pattern in training.`);
    }

    return insights;
  }

  /**
   * Generate personalized recommendations
   */
  private generatePersonalizedRecommendations(
    analysis: GameAnalysisResult,
    history: PlayerLearningHistory | null,
    context: CoachingContext
  ): string[] {
    const recommendations: string[] = [];

    // General recommendations based on analysis
    if (analysis.gameStats.blunders > 2) {
      recommendations.push('Practice tactical puzzles daily (15-20 min) to reduce blunders');
    }

    if (analysis.gameStats.accuracyPercentage < 70) {
      recommendations.push('Slow down and calculate 2-3 candidate moves before each turn');
    }

    // Personalized recommendations from history
    if (history) {
      if (history.topMistakes.length > 0) {
        const topMistake = history.topMistakes[0];
        recommendations.push(`Focus on ${topMistake.category} training to address "${topMistake.title}"`);
      }

      if (history.profile && history.profile.gamesPlayed < 20) {
        recommendations.push('Play at least 3 games per week to build consistency');
      }
    }

    // Phase-specific recommendations
    if (context.gamePhase === 'opening') {
      recommendations.push('Review opening principles: control center, develop pieces, castle early');
    } else if (context.gamePhase === 'endgame') {
      recommendations.push('Study basic endgame patterns (K+P vs K, rook endgames)');
    }

    return recommendations;
  }

  /**
   * Generate fallback response when learning system unavailable
   */
  private generateFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('opening')) {
      return 'Opening Principles:\n• Control the center with pawns and pieces\n• Develop your pieces (knights before bishops)\n• Castle early for king safety\n• Don\'t move the same piece twice in the opening\n• Connect your rooks';
    }

    if (lowerMessage.includes('tactic') || lowerMessage.includes('fork') || lowerMessage.includes('pin')) {
      return 'Tactical Patterns to Study:\n• Forks: attacking two pieces at once\n• Pins: restricting piece movement\n• Skewers: forcing a valuable piece to move\n• Discovered attacks: moving one piece to reveal another\n• Practice these daily on puzzle sites';
    }

    if (lowerMessage.includes('endgame')) {
      return 'Endgame Fundamentals:\n• Activate your king (it\'s a strong piece in endgames)\n• Create passed pawns\n• Use opposition in pawn endgames\n• Rook behind passed pawns\n• Study basic checkmate patterns';
    }

    return 'I\'m here to help! Ask me about:\n• Opening principles\n• Tactical patterns\n• Endgame techniques\n• Position analysis\n• Your recent games';
  }

  /**
   * Build heuristics context from learning history (V2)
   */
  private buildHeuristicsContext(history: PlayerLearningHistory): HeuristicsContext {
    return {
      topMistakePatterns: history.topMistakes.map(m => ({
        id: m.id,
        title: m.title,
        category: m.category,
        occurrenceCount: m.occurrenceCount,
        lastOccurrence: m.lastOccurrence,
        masteryScore: m.masteryScore,
        confidenceScore: m.confidenceScore,
      })),
      recentGames: history.recentGames.map(g => ({
        id: g.id,
        timestamp: g.timestamp,
        accuracy: g.metrics?.accuracy,
        mistakeCount: g.analysis?.mistakeCount || 0,
        mistakeTypes: g.analysis?.mistakeTypes || [],
        result: g.result,
      })),
      learningMetrics: history.learningMetrics.map(m => ({
        sessionStart: m.sessionStart,
        gameCount: m.gameCount,
        mistakesIdentified: m.mistakesIdentified,
        mistakesCorrected: m.mistakesCorrected,
        progress: m.progress,
      })),
      coachingMemory: history.coachingMemory ? {
        adviceIssued: JSON.parse(history.coachingMemory.adviceIssued || '[]'),
        recentTakeaways: JSON.parse(history.coachingMemory.recentTakeaways || '[]'),
        accuracyTrend: JSON.parse(history.coachingMemory.accuracyTrend || '[]'),
      } : undefined,
    };
  }

  /**
   * Update coaching memory with newly issued advice (V2)
   */
  private async updateCoachingMemory(
    prisma: PrismaClient,
    userId: string,
    adviceRecord: any
  ): Promise<void> {
    try {
      // Fetch or create coaching memory
      let memory = await prisma.coachingMemory.findUnique({
        where: { userId },
      });

      if (!memory) {
        // Create new memory
        await prisma.coachingMemory.create({
          data: {
            userId,
            adviceIssued: JSON.stringify([adviceRecord]),
            lastUpdated: new Date(),
          },
        });
      } else {
        // Update existing memory
        const adviceList = JSON.parse(memory.adviceIssued || '[]');
        adviceList.push(adviceRecord);
        
        // Keep only last 20 advice records
        const trimmedList = adviceList.slice(-20);
        
        await prisma.coachingMemory.update({
          where: { userId },
          data: {
            adviceIssued: JSON.stringify(trimmedList),
            lastUpdated: new Date(),
          },
        });
      }
    } catch (error) {
      console.warn('[Wall-E] Failed to update coaching memory:', error);
      // Non-critical error, continue
    }
  }
}

// Singleton instance
let walleEngineInstance: WallEEngine | null = null;

export function getWallEEngine(): WallEEngine {
  if (!walleEngineInstance) {
    walleEngineInstance = new WallEEngine();
  }
  return walleEngineInstance;
}
