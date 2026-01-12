/**
 * Takeaway Generator - Creates structured coaching takeaways
 * 
 * This module generates the final coaching advice by combining
 * themed turn points into actionable insights. It creates the
 * \"5 key takeaways\" that will be displayed to users and provides
 * rich context for the \"More insights\" chat system.
 */

import { 
  ThemedTurnPoint, 
  Takeaway, 
  GameAnalysisResult,
  CoachTheme,
  GamePhase 
} from './types';

/**
 * Configuration for takeaway generation
 */
export interface TakeawayGeneratorConfig {
  maxTakeaways: number;           // Maximum number of takeaways to generate
  priorityWeighting: number;      // How much to weight theme priority
  frequencyWeighting: number;     // How much to weight theme frequency
  phaseBalancing: boolean;        // Balance takeaways across game phases
  skillLevelAdaptation: boolean;  // Adapt advice complexity to skill level
}

export const DEFAULT_TAKEAWAY_CONFIG: TakeawayGeneratorConfig = {
  maxTakeaways: 5,
  priorityWeighting: 1.5,
  frequencyWeighting: 1.2,
  phaseBalancing: true,
  skillLevelAdaptation: true
};

/**
 * Template for generating advice text based on themes
 */
interface AdviceTemplate {
  title: string;
  description: string;
  actionItems: string[];
  relatedConcepts: string[];
}

/**
 * Generates structured coaching takeaways from themed turn points
 */
export class TakeawayGenerator {
  private config: TakeawayGeneratorConfig;

  constructor(config: Partial<TakeawayGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_TAKEAWAY_CONFIG, ...config };
  }

  /**
   * Generate comprehensive game analysis with takeaways
   */
  async generateAnalysis(
    themedTurnPoints: ThemedTurnPoint[],
    pgn: string,
    playerColor: 'white' | 'black' = 'white',
    skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<GameAnalysisResult> {
    
    // Group themes by frequency and importance
    const themeAnalysis = this.analyzeThemeDistribution(themedTurnPoints);
    
    // Generate takeaways based on most relevant themes
    const takeaways = this.generateTakeaways(
      themeAnalysis,
      themedTurnPoints,
      skillLevel
    );
    
    // Calculate overall game statistics
    const gameStats = this.calculateGameStatistics(themedTurnPoints, playerColor);
    
    return {
      takeaways,
      themedTurnPoints,
      overallRating: this.calculateOverallRating(themedTurnPoints, playerColor),
      gameStats,
      improvementAreas: this.identifyImprovementAreas(themeAnalysis, skillLevel),
      strengthAreas: this.identifyStrengthAreas(themeAnalysis, themedTurnPoints)
    };
  }

  /**
   * Analyze theme distribution across turn points
   */
  private analyzeThemeDistribution(themedTurnPoints: ThemedTurnPoint[]): {
    themeFrequency: Map<string, number>;
    themesByPhase: Map<GamePhase, CoachTheme[]>;
    averagePriority: Map<string, number>;
    totalEvalLoss: Map<string, number>;
  } {
    const themeFrequency = new Map<string, number>();
    const themesByPhase = new Map<GamePhase, CoachTheme[]>();
    const averagePriority = new Map<string, number>();
    const totalEvalLoss = new Map<string, number>();
    
    // Initialize phase maps
    (['opening', 'middlegame', 'endgame'] as GamePhase[]).forEach(phase => {
      themesByPhase.set(phase, []);
    });

    themedTurnPoints.forEach(turnPoint => {
      const phase = turnPoint.gamePhase;
      
      turnPoint.themes.forEach(theme => {
        // Count frequency
        themeFrequency.set(theme.id, (themeFrequency.get(theme.id) || 0) + 1);
        
        // Group by phase
        const phaseThemes = themesByPhase.get(phase) || [];
        phaseThemes.push(theme);
        themesByPhase.set(phase, phaseThemes);
        
        // Calculate average priority
        const currentPriority = averagePriority.get(theme.id) || 0;
        averagePriority.set(theme.id, (currentPriority + theme.priority) / 2);
        
        // Sum evaluation loss
        const currentLoss = totalEvalLoss.get(theme.id) || 0;
        totalEvalLoss.set(theme.id, currentLoss + Math.abs(turnPoint.evalDelta));
      });
    });

    return {
      themeFrequency,
      themesByPhase,
      averagePriority,
      totalEvalLoss
    };
  }

  /**
   * Generate takeaways from theme analysis
   */
  private generateTakeaways(
    themeAnalysis: ReturnType<TakeawayGenerator['analyzeThemeDistribution']>,
    themedTurnPoints: ThemedTurnPoint[],
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Takeaway[] {
    
    // Score themes by relevance
    const themeScores = new Map<string, number>();
    
    themeAnalysis.themeFrequency.forEach((frequency, themeId) => {
      const priority = themeAnalysis.averagePriority.get(themeId) || 0;
      const evalLoss = themeAnalysis.totalEvalLoss.get(themeId) || 0;
      
      let score = 0;
      score += frequency * this.config.frequencyWeighting;
      score += priority * this.config.priorityWeighting;
      score += (evalLoss / 100) * 0.5; // Normalize eval loss
      
      themeScores.set(themeId, score);
    });

    // Sort themes by score and select top themes
    const sortedThemes = Array.from(themeScores.entries())
      .sort(([,scoreA], [,scoreB]) => scoreB - scoreA)
      .slice(0, this.config.maxTakeaways);

    // Generate takeaways for selected themes
    const takeaways: Takeaway[] = [];
    
    sortedThemes.forEach(([themeId, score], index) => {
      const relevantTurnPoints = themedTurnPoints.filter(
        tp => tp.themes.some(theme => theme.id === themeId)
      );
      
      const theme = relevantTurnPoints[0]?.themes.find(t => t.id === themeId);
      if (!theme) return;
      
      const takeaway = this.generateTakeawayFromTheme(
        theme,
        relevantTurnPoints,
        index + 1,
        skillLevel
      );
      
      takeaways.push(takeaway);
    });

    return takeaways;
  }

  /**
   * Generate individual takeaway from theme and turn points
   */
  private generateTakeawayFromTheme(
    theme: CoachTheme,
    turnPoints: ThemedTurnPoint[],
    priority: number,
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Takeaway {
    
    const template = this.getAdviceTemplate(theme, skillLevel);
    const examples = this.generateExamples(turnPoints);
    
    return {
      title: template.title,
      description: template.description,
      priority,
      theme: theme.id,
      category: theme.category,
      actionItems: template.actionItems,
      examples,
      relatedConcepts: template.relatedConcepts,
      skillLevel,
      estimatedImpact: this.calculateEstimatedImpact(turnPoints)
    };
  }

  /**
   * Get advice template for theme and skill level
   */
  private getAdviceTemplate(
    theme: CoachTheme,
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): AdviceTemplate {
    
    // Base template from theme
    const baseTemplate = {
      title: theme.name,
      description: theme.description,
      actionItems: theme.adviceTemplate.actionItems || [],
      relatedConcepts: theme.adviceTemplate.relatedConcepts || []
    };

    // Adapt complexity based on skill level
    if (skillLevel === 'beginner') {
      return {
        ...baseTemplate,
        description: this.simplifyDescription(baseTemplate.description),
        actionItems: baseTemplate.actionItems.slice(0, 3), // Limit to 3 items
        relatedConcepts: baseTemplate.relatedConcepts.slice(0, 2)
      };
    }
    
    if (skillLevel === 'advanced') {
      return {
        ...baseTemplate,
        description: this.enhanceDescription(baseTemplate.description),
        actionItems: [...baseTemplate.actionItems, ...this.getAdvancedActionItems(theme)],
        relatedConcepts: [...baseTemplate.relatedConcepts, ...this.getAdvancedConcepts(theme)]
      };
    }

    return baseTemplate; // Intermediate level
  }

  /**
   * Generate examples from turn points
   */
  private generateExamples(turnPoints: ThemedTurnPoint[]): string[] {
    return turnPoints.slice(0, 2).map(tp => {
      const moveQuality = this.classifyMoveFromEvalDelta(tp.evalDelta);
      const evalChange = Math.abs(tp.evalDelta);
      
      return `Move ${tp.moveNumber}: ${tp.playedMoveSAN} was a ${moveQuality} ` +
             `(${evalChange > 0 ? '-' : '+'}${evalChange.toFixed(0)} centipawns). ` +
             `Better was ${tp.bestMoveSAN}.`;
    });
  }

  /**
   * Calculate game statistics
   */
  private calculateGameStatistics(
    themedTurnPoints: ThemedTurnPoint[],
    playerColor: 'white' | 'black'
  ): {
    totalMoves: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    accuracyPercentage: number;
    avgEvalLoss: number;
  } {
    
    const playerTurnPoints = themedTurnPoints.filter(
      tp => tp.sideToMove === playerColor
    );
    
    let blunders = 0, mistakes = 0, inaccuracies = 0;
    let totalEvalLoss = 0;
    
    playerTurnPoints.forEach(tp => {
      const moveQuality = this.classifyMoveFromEvalDelta(tp.evalDelta);
      const evalLoss = Math.abs(tp.evalDelta);
      
      switch (moveQuality) {
        case 'blunder': blunders++; break;
        case 'mistake': mistakes++; break;
        case 'inaccuracy': inaccuracies++; break;
      }
      
      totalEvalLoss += evalLoss;
    });
    
    const totalErrors = blunders + mistakes + inaccuracies;
    const accuracyPercentage = Math.max(0, 100 - (totalErrors / playerTurnPoints.length * 100));
    
    return {
      totalMoves: playerTurnPoints.length,
      blunders,
      mistakes,
      inaccuracies,
      accuracyPercentage: Math.round(accuracyPercentage),
      avgEvalLoss: Math.round(totalEvalLoss / playerTurnPoints.length)
    };
  }

  /**
   * Calculate overall rating from performance
   */
  private calculateOverallRating(
    themedTurnPoints: ThemedTurnPoint[],
    playerColor: 'white' | 'black'
  ): number {
    const stats = this.calculateGameStatistics(themedTurnPoints, playerColor);
    
    // Rating based on accuracy and error severity
    let rating = stats.accuracyPercentage;
    
    // Penalize errors more heavily
    rating -= stats.blunders * 15;
    rating -= stats.mistakes * 8;
    rating -= stats.inaccuracies * 3;
    
    return Math.max(0, Math.min(100, rating));
  }

  /**
   * Identify areas needing improvement
   */
  private identifyImprovementAreas(
    themeAnalysis: ReturnType<TakeawayGenerator['analyzeThemeDistribution']>,
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): string[] {
    
    const improvements: string[] = [];
    
    // Find most frequent problematic themes
    const sortedByFrequency = Array.from(themeAnalysis.themeFrequency.entries())
      .sort(([,freqA], [,freqB]) => freqB - freqA)
      .slice(0, 3);
    
    sortedByFrequency.forEach(([themeId, frequency]) => {
      if (frequency >= 2) {
        improvements.push(this.getImprovementSuggestion(themeId, skillLevel));
      }
    });
    
    return improvements;
  }

  /**
   * Identify strength areas
   */
  private identifyStrengthAreas(
    themeAnalysis: ReturnType<TakeawayGenerator['analyzeThemeDistribution']>,
    themedTurnPoints: ThemedTurnPoint[]
  ): string[] {
    
    const strengths: string[] = [];
    
    // Find phases with fewer errors
    const phaseErrors = new Map<GamePhase, number>();
    
    themedTurnPoints.forEach(tp => {
      const currentErrors = phaseErrors.get(tp.gamePhase) || 0;
      phaseErrors.set(tp.gamePhase, currentErrors + 1);
    });
    
    const sortedPhases = Array.from(phaseErrors.entries())
      .sort(([,errorsA], [,errorsB]) => errorsA - errorsB);
    
    if (sortedPhases.length > 0) {
      const [strongestPhase] = sortedPhases[0];
      strengths.push(`Strong ${strongestPhase} play`);
    }
    
    return strengths;
  }

  // Utility methods

  private classifyMoveFromEvalDelta(evalDelta: number): string {
    const abs = Math.abs(evalDelta);
    if (abs >= 300) return 'blunder';
    if (abs >= 150) return 'mistake';
    if (abs >= 75) return 'inaccuracy';
    return 'good';
  }

  private calculateEstimatedImpact(turnPoints: ThemedTurnPoint[]): number {
    const totalEvalLoss = turnPoints.reduce(
      (sum, tp) => sum + Math.abs(tp.evalDelta), 0
    );
    return Math.min(100, totalEvalLoss / 10); // Normalize to 0-100
  }

  private simplifyDescription(description: string): string {
    // Simplify language for beginners
    return description
      .replace(/centipawn/g, 'point')
      .replace(/evaluation/g, 'position value')
      .replace(/tactical motif/g, 'tactical pattern');
  }

  private enhanceDescription(description: string): string {
    // Add more technical detail for advanced players
    return description + \" Consider studying master games with similar patterns.\";
  }

  private getAdvancedActionItems(theme: CoachTheme): string[] {
    // Add advanced action items based on theme
    const advancedItems: Record<string, string[]> = {
      'tactics': ['Study tactical motif databases', 'Practice blindfold visualization'],
      'strategy': ['Analyze pawn structures in detail', 'Study positional sacrifices'],
      'endgame': ['Memorize theoretical positions', 'Practice technique with tablebases']
    };
    
    return advancedItems[theme.category] || [];
  }

  private getAdvancedConcepts(theme: CoachTheme): string[] {
    // Add advanced concepts based on theme
    const advancedConcepts: Record<string, string[]> = {
      'tactics': ['Zwischenzug', 'Deflection', 'Interference'],
      'strategy': ['Prophylaxis', 'Restriction', 'Transformation'],
      'endgame': ['Opposition', 'Triangulation', 'Corresponding squares']
    };
    
    return advancedConcepts[theme.category] || [];
  }

  private getImprovementSuggestion(themeId: string, skillLevel: string): string {
    // Generate improvement suggestions based on theme
    const suggestions: Record<string, string> = {
      'calculation_accuracy': 'Practice calculating variations more deeply',
      'blunder_recovery': 'Learn to stay calm after mistakes and find the best practical chances',
      'pattern_recognition': 'Study more tactical puzzles to improve pattern recognition',
      'time_management': 'Work on balancing speed and accuracy in your calculations'
    };
    
    return suggestions[themeId] || 'Focus on consistent improvement in this area';
  }

  /**
   * Get configuration
   */
  getConfig(): TakeawayGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TakeawayGeneratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}"