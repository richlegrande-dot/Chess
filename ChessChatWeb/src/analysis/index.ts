/**
 * Chess Analysis Pipeline - Main orchestrator for game analysis
 * 
 * This module brings together all analysis components to provide
 * a complete coaching system. It coordinates engine analysis,
 * theme assignment, and takeaway generation to transform raw
 * game data into structured coaching advice.
 */

import { 
  GameAnalysisResult,
  TurnPoint,
  ThemedTurnPoint,
  Takeaway
} from './types';
import { EngineAnalyzer, EngineAnalysisConfig } from './EngineAnalyzer';
import { PhaseClassifier, PhaseClassifierConfig } from './PhaseClassifier';
import { ThemeAssigner, ThemeAssignerConfig } from './ThemeAssigner';
import { TakeawayGenerator, TakeawayGeneratorConfig } from './TakeawayGenerator';

/**
 * Main analysis pipeline configuration
 */
export interface AnalysisPipelineConfig {
  engine: Partial<EngineAnalysisConfig>;
  phaseClassifier: Partial<PhaseClassifierConfig>;
  themeAssigner: Partial<ThemeAssignerConfig>;
  takeawayGenerator: Partial<TakeawayGeneratorConfig>;
}

export const DEFAULT_PIPELINE_CONFIG: AnalysisPipelineConfig = {
  engine: {},
  phaseClassifier: {},
  themeAssigner: {},
  takeawayGenerator: {}
};

/**
 * Main chess analysis pipeline
 */
export class ChessAnalysisPipeline {
  private engineAnalyzer: EngineAnalyzer;
  private phaseClassifier: PhaseClassifier;
  private themeAssigner: ThemeAssigner;
  private takeawayGenerator: TakeawayGenerator;

  constructor(config: Partial<AnalysisPipelineConfig> = {}) {
    const fullConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    
    this.engineAnalyzer = new EngineAnalyzer(fullConfig.engine);
    this.phaseClassifier = new PhaseClassifier(fullConfig.phaseClassifier);
    this.themeAssigner = new ThemeAssigner(
      fullConfig.themeAssigner, 
      this.phaseClassifier
    );
    this.takeawayGenerator = new TakeawayGenerator(fullConfig.takeawayGenerator);
  }

  /**
   * Complete analysis of a chess game
   * This is the main entry point for the coaching system
   */
  async analyzeGame(
    pgn: string,
    playerColor: 'white' | 'black' = 'white',
    skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<GameAnalysisResult> {
    
    console.log('🔍 Starting chess game analysis...');
    
    try {
      // Step 1: Engine analysis to find turning points
      console.log('⚡ Running engine analysis...');
      const turnPoints = await this.engineAnalyzer.analyzeGame(pgn, playerColor);
      console.log(`📊 Found ${turnPoints.length} turning points`);
      
      // Step 2: Assign coaching themes to turning points
      console.log('🎯 Assigning coaching themes...');
      const themedTurnPoints = await this.themeAssigner.assignThemes(turnPoints, skillLevel);
      console.log(`🏷️ Themed ${themedTurnPoints.length} positions`);
      
      // Step 3: Generate takeaways and complete analysis
      console.log('📝 Generating coaching takeaways...');
      const result = await this.takeawayGenerator.generateAnalysis(
        themedTurnPoints,
        pgn,
        playerColor,
        skillLevel
      );
      
      console.log(`✅ Analysis complete: ${result.takeaways.length} takeaways generated`);
      console.log(`🎯 Overall rating: ${result.overallRating}/100`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw new Error(`Game analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze a single position for coaching insights
   */
  async analyzePosition(
    fen: string,
    moveNumber: number = 1,
    skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<{
    gamePhase: string;
    evaluation: number;
    suggestedThemes: string[];
    keyInsights: string[];
  }> {
    
    // Classify game phase
    const gamePhase = this.phaseClassifier.classifyPhase(fen, moveNumber);
    
    // Get position evaluation
    const evaluation = await this.engineAnalyzer['engine'].evaluatePosition(fen);
    
    // Mock theme suggestions for single position
    // In a real implementation, this would analyze position characteristics
    const suggestedThemes = this.getSuggestedThemesForPhase(gamePhase, skillLevel);
    
    const keyInsights = [
      `Position is in the ${gamePhase} phase`,
      `Evaluation: ${evaluation > 0 ? '+' : ''}${(evaluation / 100).toFixed(2)} pawns`,
      `Recommended focus: ${suggestedThemes[0] || 'general improvement'}`
    ];
    
    return {
      gamePhase,
      evaluation,
      suggestedThemes,
      keyInsights
    };
  }

  /**
   * Get improvement recommendations based on analysis history
   */
  async getImprovementPlan(
    recentAnalyses: GameAnalysisResult[],
    skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<{
    topWeaknesses: string[];
    recommendedStudy: string[];
    practiceAreas: string[];
    estimatedTimeToImprove: string;
  }> {
    
    // Aggregate common themes across recent games
    const themeFrequency = new Map<string, number>();
    const categoryFrequency = new Map<string, number>();
    
    recentAnalyses.forEach(analysis => {
      analysis.takeaways.forEach(takeaway => {
        // Count theme frequency
        themeFrequency.set(
          takeaway.theme, 
          (themeFrequency.get(takeaway.theme) || 0) + 1
        );
        
        // Count category frequency
        categoryFrequency.set(
          takeaway.category,
          (categoryFrequency.get(takeaway.category) || 0) + 1
        );
      });
    });
    
    // Find top weaknesses
    const topWeaknesses = Array.from(themeFrequency.entries())
      .sort(([,freqA], [,freqB]) => freqB - freqA)
      .slice(0, 3)
      .map(([theme]) => this.getThemeDisplayName(theme));
    
    // Generate study recommendations
    const topCategories = Array.from(categoryFrequency.entries())
      .sort(([,freqA], [,freqB]) => freqB - freqA)
      .slice(0, 2)
      .map(([category]) => category);
    
    const recommendedStudy = this.getStudyRecommendations(topCategories, skillLevel);
    const practiceAreas = this.getPracticeRecommendations(topWeaknesses, skillLevel);
    
    return {
      topWeaknesses,
      recommendedStudy,
      practiceAreas,
      estimatedTimeToImprove: this.estimateImprovementTime(recentAnalyses.length, skillLevel)
    };
  }

  /**
   * Generate coaching context for chat system
   */
  generateChatContext(analysisResult: GameAnalysisResult): {
    gameOverview: string;
    keyThemes: string[];
    specificExamples: string[];
    improvementQuestions: string[];
  } {
    
    const { takeaways, overallRating, gameStats } = analysisResult;
    
    const gameOverview = `This game had an overall rating of ${overallRating}/100. ` +
      `You had ${gameStats.blunders} blunder(s), ${gameStats.mistakes} mistake(s), ` +
      `and ${gameStats.inaccuracies} inaccuracy(ies) with an accuracy of ${gameStats.accuracyPercentage}%.`;
    
    const keyThemes = takeaways.map(t => t.title);
    
    const specificExamples = takeaways
      .filter(t => t.examples && t.examples.length > 0)
      .map(t => t.examples![0])
      .slice(0, 3);
    
    const improvementQuestions = [
      `What specific tactics should I practice based on this game?`,
      `How can I improve my ${takeaways[0]?.category || 'overall'} play?`,
      `What opening principles did I miss?`,
      `How should I approach similar positions in the future?`
    ];
    
    return {
      gameOverview,
      keyThemes,
      specificExamples,
      improvementQuestions
    };
  }

  /**
   * Export analysis for external use
   */
  exportAnalysis(result: GameAnalysisResult): {
    summary: string;
    detailed: object;
    chatReady: object;
  } {
    return {
      summary: this.generateAnalysisSummary(result),
      detailed: {
        takeaways: result.takeaways,
        turnPoints: result.themedTurnPoints,
        stats: result.gameStats,
        rating: result.overallRating
      },
      chatReady: this.generateChatContext(result)
    };
  }

  // Private helper methods
  
  private getSuggestedThemesForPhase(phase: string, skillLevel: string): string[] {
    const themesByPhase: Record<string, Record<string, string[]>> = {
      'opening': {
        'beginner': ['Development', 'Center Control', 'King Safety'],
        'intermediate': ['Opening Principles', 'Tactical Awareness', 'Pawn Structure'],
        'advanced': ['Opening Theory', 'Positional Understanding', 'Strategic Planning']
      },
      'middlegame': {
        'beginner': ['Tactics', 'Piece Activity', 'Basic Strategy'],
        'intermediate': ['Calculation', 'Positional Play', 'Time Management'],
        'advanced': ['Strategic Planning', 'Complex Tactics', 'Evaluation Skills']
      },
      'endgame': {
        'beginner': ['Basic Checkmates', 'King Activity', 'Pawn Promotion'],
        'intermediate': ['Endgame Technique', 'Opposition', 'Practical Play'],
        'advanced': ['Theoretical Endgames', 'Precision', 'Conversion Technique']
      }
    };
    
    return themesByPhase[phase]?.[skillLevel] || ['General Improvement'];
  }
  
  private getThemeDisplayName(themeId: string): string {
    const displayNames: Record<string, string> = {
      'calculation_accuracy': 'Calculation Accuracy',
      'blunder_recovery': 'Blunder Recovery',
      'pattern_recognition': 'Pattern Recognition',
      'time_management': 'Time Management',
      'opening_principles': 'Opening Principles',
      'tactical_awareness': 'Tactical Awareness'
    };
    
    return displayNames[themeId] || themeId.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
  }
  
  private getStudyRecommendations(categories: string[], skillLevel: string): string[] {
    const recommendations: Record<string, Record<string, string[]>> = {
      'tactics': {
        'beginner': ['Basic tactical puzzles', 'Pin and fork patterns'],
        'intermediate': ['Complex tactical combinations', 'Defensive tactics'],
        'advanced': ['Advanced tactical motifs', 'Calculation depth exercises']
      },
      'strategy': {
        'beginner': ['Basic positional concepts', 'Piece coordination'],
        'intermediate': ['Pawn structure evaluation', 'Positional sacrifices'],
        'advanced': ['Strategic masterpieces', 'Prophylactic thinking']
      }
    };
    
    const result: string[] = [];
    categories.forEach(category => {
      const categoryRecs = recommendations[category]?.[skillLevel];
      if (categoryRecs) result.push(...categoryRecs);
    });
    
    return result.slice(0, 5); // Limit recommendations
  }
  
  private getPracticeRecommendations(weaknesses: string[], skillLevel: string): string[] {
    return weaknesses.map(weakness => 
      `Practice ${weakness.toLowerCase()} through targeted exercises`
    );
  }
  
  private estimateImprovementTime(gamesAnalyzed: number, skillLevel: string): string {
    const baseTime: Record<string, number> = {
      'beginner': 2,
      'intermediate': 4,
      'advanced': 6
    };
    
    const weeks = Math.max(1, baseTime[skillLevel] - Math.floor(gamesAnalyzed / 5));
    return `${weeks}-${weeks + 2} weeks with consistent practice`;
  }
  
  private generateAnalysisSummary(result: GameAnalysisResult): string {
    const { takeaways, overallRating, gameStats } = result;
    
    return `Game Analysis Summary:\
` +
           `Overall Rating: ${overallRating}/100\
` +
           `Accuracy: ${gameStats.accuracyPercentage}%\
` +
           `Key Areas: ${takeaways.slice(0, 3).map(t => t.title).join(', ')}\
` +
           `Focus: ${takeaways[0]?.description || 'Continue improving overall play'}`;
  }
  
  /**
   * Get individual component instances for direct access
   */
  getEngineAnalyzer(): EngineAnalyzer { return this.engineAnalyzer; }
  getPhaseClassifier(): PhaseClassifier { return this.phaseClassifier; }
  getThemeAssigner(): ThemeAssigner { return this.themeAssigner; }
  getTakeawayGenerator(): TakeawayGenerator { return this.takeawayGenerator; }
}

/**
 * Factory function for creating analysis pipeline with common configurations
 */
export function createAnalysisPipeline(preset: 'fast' | 'balanced' | 'thorough' = 'balanced'): ChessAnalysisPipeline {
  const configs: Record<string, Partial<AnalysisPipelineConfig>> = {
    'fast': {
      engine: {
        depthLimit: 8,
        timePerMove: 500,
        maxTurnPoints: 5
      },
      takeawayGenerator: {
        maxTakeaways: 3
      }
    },
    'balanced': {
      engine: {
        depthLimit: 12,
        timePerMove: 1000,
        maxTurnPoints: 8
      },
      takeawayGenerator: {
        maxTakeaways: 5
      }
    },
    'thorough': {
      engine: {
        depthLimit: 16,
        timePerMove: 2000,
        maxTurnPoints: 12
      },
      takeawayGenerator: {
        maxTakeaways: 7
      }
    }
  };
  
  return new ChessAnalysisPipeline(configs[preset]);
}

// Export all types and classes for external use
export * from './types';
export * from './coachThemes';
export { EngineAnalyzer } from './EngineAnalyzer';
export { PhaseClassifier } from './PhaseClassifier';
export { ThemeAssigner } from './ThemeAssigner';
export { TakeawayGenerator } from './TakeawayGenerator';"