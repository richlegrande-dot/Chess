/**
 * Training Data Collector
 * Collects game analyses and exports them as training data for custom LLM
 */

import { CoachingReport, GameplayMetrics, TacticalMistake, StrategicViolation } from './types';

export interface TrainingExample {
  // Unique identifier
  id: string;
  timestamp: number;
  
  // Game context
  gameId?: string;
  playerLevel: number;
  playerColor: 'w' | 'b';
  gameResult: string;
  moveCount: number;
  
  // Analysis input features
  totalMoves: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  missedWins: number;
  principleViolations: number;
  
  // Tactical patterns encountered
  tacticalPatterns: string[];
  strategicIssues: string[];
  
  // Rule-based coaching output (ground truth for training)
  topImprovements: Array<{
    title: string;
    description: string;
    category: string;
    severity: number;
  }>;
  encouragement: string;
  tacticalFocus: string;
  strategicFocus: string;
  
  // Phase analysis
  openingPerformance: string;
  middlegamePerformance: string;
  endgamePerformance: string;
  
  // Raw data for advanced training
  mistakeDetails?: TacticalMistake[];
  violationDetails?: StrategicViolation[];
  metricsDetails?: GameplayMetrics[];
}

export class TrainingDataCollector {
  private examples: TrainingExample[] = [];
  private storageKey = 'chess_coaching_training_data';
  private maxExamples = 1000; // Limit to prevent storage overflow

  constructor() {
    this.loadFromStorage();
    this.migrateFromOtherPorts();
  }

  /**
   * Migrate data from other ports (in case server port changed)
   * Checks localStorage for data from common dev ports
   */
  private migrateFromOtherPorts(): void {
    // Skip if we already have data
    if (this.examples.length > 0) {
      console.log(`[TrainingCollector] Already have ${this.examples.length} examples, skipping migration`);
      return;
    }

    // Try to load from other ports by checking current URL
    const currentPort = window.location.port;
    const portsToCheck = ['3001', '3002', '3003', '3004', '3000', '5173'];
    
    console.log(`[TrainingCollector] Current port: ${currentPort}, checking for data from other ports...`);

    for (const port of portsToCheck) {
      if (port === currentPort) continue;

      try {
        // Try to access localStorage data that might exist from other ports
        // This won't work directly, but we'll check for backup keys
        const backupKey = `${this.storageKey}_port_${port}`;
        const data = localStorage.getItem(backupKey);
        
        if (data) {
          const examples = JSON.parse(data);
          console.log(`[TrainingCollector] Found ${examples.length} examples from port ${port}, migrating...`);
          this.examples = examples;
          this.saveToStorage();
          return;
        }
      } catch (error) {
        // Silently continue
      }
    }

    console.log('[TrainingCollector] No data found from other ports');
  }

  /**
   * Collect training data from a coaching report
   */
  collect(
    report: CoachingReport,
    gameContext: {
      gameId?: string;
      playerLevel: number;
      playerColor: 'w' | 'b';
      gameResult: string;
      moveHistory: Array<{ move: string; fen: string }>;
    },
    mistakes: TacticalMistake[],
    violations: StrategicViolation[],
    metrics: GameplayMetrics[]
  ): TrainingExample {
    const example: TrainingExample = {
      id: this.generateId(),
      timestamp: Date.now(),
      
      // Game context
      gameId: gameContext.gameId,
      playerLevel: gameContext.playerLevel,
      playerColor: gameContext.playerColor,
      gameResult: gameContext.gameResult,
      moveCount: gameContext.moveHistory.length,
      
      // Statistics
      totalMoves: report.statistics.totalMoves,
      blunders: report.statistics.blunders,
      mistakes: report.statistics.mistakes,
      inaccuracies: report.statistics.inaccuracies,
      missedWins: report.statistics.missedWins,
      principleViolations: report.statistics.principleViolations,
      
      // Patterns
      tacticalPatterns: this.extractTacticalPatterns(mistakes),
      strategicIssues: this.extractStrategicIssues(violations),
      
      // Coaching output
      topImprovements: report.improvements.map(imp => ({
        title: imp.title,
        description: imp.description,
        category: imp.category,
        severity: imp.severity,
      })),
      encouragement: report.encouragement,
      tacticalFocus: report.tacticalFocus,
      strategicFocus: report.strategicFocus,
      
      // Phase analysis
      openingPerformance: report.gamePhaseAnalysis.opening,
      middlegamePerformance: report.gamePhaseAnalysis.middlegame,
      endgamePerformance: report.gamePhaseAnalysis.endgame,
      
      // Raw data
      mistakeDetails: mistakes,
      violationDetails: violations,
      metricsDetails: metrics,
    };

    this.addExample(example);
    return example;
  }

  /**
   * Add example to collection
   */
  private addExample(example: TrainingExample): void {
    this.examples.push(example);
    
    // Keep only most recent examples
    if (this.examples.length > this.maxExamples) {
      this.examples = this.examples.slice(-this.maxExamples);
    }
    
    this.saveToStorage();
  }

  /**
   * Get all collected examples
   */
  getExamples(): TrainingExample[] {
    return [...this.examples];
  }

  /**
   * Get examples count
   */
  getCount(): number {
    return this.examples.length;
  }

  /**
   * Export training data in JSONL format (one JSON object per line)
   * This is the standard format for LLM training
   */
  exportAsJSONL(): string {
    return this.examples
      .map(example => this.formatForTraining(example))
      .map(data => JSON.stringify(data))
      .join('\n');
  }

  /**
   * Export training data in JSON format
   */
  exportAsJSON(): string {
    return JSON.stringify(
      this.examples.map(ex => this.formatForTraining(ex)),
      null,
      2
    );
  }

  /**
   * Download training data as a file
   */
  downloadTrainingData(format: 'jsonl' | 'json' = 'jsonl'): void {
    const data = format === 'jsonl' ? this.exportAsJSONL() : this.exportAsJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_coaching_training_data_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.examples = [];
    this.saveToStorage();
  }

  /**
   * Get statistics about collected data
   */
  getStatistics(): {
    totalGames: number;
    totalMoves: number;
    averageBlunders: number;
    averageMistakes: number;
    playerLevelDistribution: Record<number, number>;
    colorDistribution: { white: number; black: number };
    tacticalPatternsFound: Record<string, number>;
    strategicIssuesFound: Record<string, number>;
  } {
    const stats = {
      totalGames: this.examples.length,
      totalMoves: 0,
      averageBlunders: 0,
      averageMistakes: 0,
      playerLevelDistribution: {} as Record<number, number>,
      colorDistribution: { white: 0, black: 0 },
      tacticalPatternsFound: {} as Record<string, number>,
      strategicIssuesFound: {} as Record<string, number>,
    };

    if (this.examples.length === 0) return stats;

    let totalBlunders = 0;
    let totalMistakes = 0;

    for (const example of this.examples) {
      stats.totalMoves += example.moveCount;
      totalBlunders += example.blunders;
      totalMistakes += example.mistakes;
      
      // Player level distribution
      stats.playerLevelDistribution[example.playerLevel] = 
        (stats.playerLevelDistribution[example.playerLevel] || 0) + 1;
      
      // Color distribution
      if (example.playerColor === 'w') {
        stats.colorDistribution.white++;
      } else {
        stats.colorDistribution.black++;
      }
      
      // Tactical patterns
      for (const pattern of example.tacticalPatterns) {
        stats.tacticalPatternsFound[pattern] = 
          (stats.tacticalPatternsFound[pattern] || 0) + 1;
      }
      
      // Strategic issues
      for (const issue of example.strategicIssues) {
        stats.strategicIssuesFound[issue] = 
          (stats.strategicIssuesFound[issue] || 0) + 1;
      }
    }

    stats.averageBlunders = totalBlunders / this.examples.length;
    stats.averageMistakes = totalMistakes / this.examples.length;

    return stats;
  }

  /**
   * Format example for LLM training (prompt + completion)
   */
  private formatForTraining(example: TrainingExample): {
    prompt: string;
    completion: string;
    metadata?: any;
  } {
    // Create structured prompt
    const prompt = this.createPrompt(example);
    
    // Create target completion
    const completion = this.createCompletion(example);
    
    // Include metadata for filtering/analysis
    const metadata = {
      id: example.id,
      timestamp: example.timestamp,
      playerLevel: example.playerLevel,
      moveCount: example.moveCount,
      blunders: example.blunders,
      mistakes: example.mistakes,
    };

    return { prompt, completion, metadata };
  }

  /**
   * Create training prompt
   */
  private createPrompt(example: TrainingExample): string {
    return `You are a chess coach analyzing a game. Here's the game data:

Player Level: ${example.playerLevel}/10
Player Color: ${example.playerColor === 'w' ? 'White' : 'Black'}
Game Result: ${example.gameResult}
Total Moves: ${example.totalMoves}

Performance Statistics:
- Blunders: ${example.blunders}
- Mistakes: ${example.mistakes}
- Inaccuracies: ${example.inaccuracies}
- Missed Tactical Opportunities: ${example.missedWins}
- Strategic Principle Violations: ${example.principleViolations}

Tactical Patterns Encountered:
${example.tacticalPatterns.length > 0 ? example.tacticalPatterns.map(p => `- ${p}`).join('\n') : '- None'}

Strategic Issues:
${example.strategicIssues.length > 0 ? example.strategicIssues.map(i => `- ${i}`).join('\n') : '- None'}

Phase Performance:
- Opening: ${example.openingPerformance}
- Middlegame: ${example.middlegamePerformance}
- Endgame: ${example.endgamePerformance}

Provide personalized coaching feedback:`;
  }

  /**
   * Create target completion (what the model should learn to generate)
   */
  private createCompletion(example: TrainingExample): string {
    let completion = '## Top Improvements\n\n';
    
    example.topImprovements.forEach((imp, i) => {
      completion += `${i + 1}. **${imp.title}**\n${imp.description}\n\n`;
    });

    completion += `## Focus Areas\n\n`;
    completion += `**Tactical Focus:** ${example.tacticalFocus}\n\n`;
    completion += `**Strategic Focus:** ${example.strategicFocus}\n\n`;

    completion += `## What You Did Well\n\n`;
    completion += example.encouragement;

    return completion;
  }

  /**
   * Extract tactical patterns from mistakes
   */
  private extractTacticalPatterns(mistakes: TacticalMistake[]): string[] {
    const patterns = new Set<string>();
    
    for (const mistake of mistakes) {
      if (mistake.pattern) {
        patterns.add(mistake.pattern);
      }
      
      // Extract patterns from explanations
      if (mistake.explanation.includes('fork')) patterns.add('fork');
      if (mistake.explanation.includes('pin')) patterns.add('pin');
      if (mistake.explanation.includes('skewer')) patterns.add('skewer');
      if (mistake.explanation.includes('back-rank')) patterns.add('back_rank_mate');
      if (mistake.explanation.includes('undefended')) patterns.add('hanging_piece');
    }
    
    return Array.from(patterns);
  }

  /**
   * Extract strategic issues from violations
   */
  private extractStrategicIssues(violations: StrategicViolation[]): string[] {
    const issues = new Set<string>();
    
    for (const violation of violations) {
      issues.add(violation.principle);
    }
    
    return Array.from(issues);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      // Save only essential data (without raw metrics to save space)
      const essentialData = this.examples.map(ex => ({
        ...ex,
        mistakes: undefined,
        violations: undefined,
        metrics: undefined,
      }));
      
      const dataString = JSON.stringify(essentialData);
      localStorage.setItem(this.storageKey, dataString);
      
      // Also save with port-specific key as backup for migration
      const currentPort = window.location.port;
      if (currentPort) {
        const backupKey = `${this.storageKey}_port_${currentPort}`;
        localStorage.setItem(backupKey, dataString);
      }
      
      console.log(`[TrainingCollector] Saved ${essentialData.length} examples to storage`);
    } catch (error) {
      console.warn('Failed to save training data to storage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.examples = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load training data from storage:', error);
      this.examples = [];
    }
  }
}

// Export singleton instance
export const trainingCollector = new TrainingDataCollector();
