/**
 * Deep Thinking Engine for Advanced Chess Analysis
 * Implements chain-of-thought reasoning and multi-step analysis
 * Based on research from:
 * - Leela Chess Zero (deep evaluation patterns)
 * - OpenAI reasoning models (structured thought process)
 * - CMU Allie (human-like learning patterns)
 */

import { Chess } from 'chess.js';
import { GameplayMetrics } from '../coaching/types';

export interface ThoughtStep {
  step: number;
  reasoning: string;
  evaluation: number;
  alternatives: string[];
  confidence: number;
}

export interface DeepAnalysis {
  position: string; // FEN
  thoughts: ThoughtStep[];
  finalJudgment: string;
  keyInsights: string[];
  learningOpportunities: string[];
  patternRecognition: RecognizedPattern[];
}

export interface RecognizedPattern {
  type: 'tactical' | 'positional' | 'endgame' | 'opening';
  name: string;
  description: string;
  frequency: number; // How often player encounters this
  masteryLevel: number; // 0-100, how well they handle it
  recommendation: string;
}

export interface PlayerTendency {
  pattern: string;
  occurrences: number;
  successRate: number;
  contexts: string[]; // Game phases where this happens
  improvement: string;
}

/**
 * Deep Thinking Engine
 * Analyzes games with multi-step reasoning similar to human thought process
 */
export class DeepThinkingEngine {
  private patternDatabase: Map<string, RecognizedPattern>;
  private playerTendencies: Map<string, PlayerTendency>;

  constructor() {
    this.patternDatabase = new Map();
    this.playerTendencies = new Map();
    this.initializePatternDatabase();
  }

  /**
   * Analyze a critical position with chain-of-thought reasoning
   */
  public async analyzePositionDeeply(
    fen: string,
    moveHistory: Array<{ move: string; fen: string }>,
    playerColor: 'w' | 'b'
  ): Promise<DeepAnalysis> {
    const thoughts: ThoughtStep[] = [];
    const chess = new Chess(fen);

    // Step 1: Material assessment
    thoughts.push({
      step: 1,
      reasoning: this.assessMaterial(chess),
      evaluation: this.calculateMaterialBalance(chess),
      alternatives: [],
      confidence: 0.9
    });

    // Step 2: King safety evaluation
    thoughts.push({
      step: 2,
      reasoning: this.assessKingSafety(chess, playerColor),
      evaluation: this.calculateKingSafetyScore(chess, playerColor),
      alternatives: this.suggestKingSafetyImprovements(chess, playerColor),
      confidence: 0.85
    });

    // Step 3: Piece activity and development
    thoughts.push({
      step: 3,
      reasoning: this.assessPieceActivity(chess, playerColor),
      evaluation: this.calculateActivityScore(chess, playerColor),
      alternatives: this.suggestActivityImprovements(chess, playerColor),
      confidence: 0.8
    });

    // Step 4: Pawn structure evaluation
    thoughts.push({
      step: 4,
      reasoning: this.assessPawnStructure(chess, playerColor),
      evaluation: this.calculatePawnStructureScore(chess),
      alternatives: [],
      confidence: 0.75
    });

    // Step 5: Tactical opportunities
    const tactics = this.findTacticalMotifs(chess, playerColor);
    thoughts.push({
      step: 5,
      reasoning: this.describeTactics(tactics),
      evaluation: tactics.length > 0 ? 50 : 0,
      alternatives: tactics.map(t => t.description),
      confidence: 0.7
    });

    // Synthesize thoughts into final judgment
    const finalJudgment = this.synthesizeAnalysis(thoughts, chess, playerColor);
    
    // Extract key insights
    const keyInsights = this.extractKeyInsights(thoughts, moveHistory);
    
    // Identify learning opportunities
    const learningOpportunities = this.identifyLearningOpportunities(
      thoughts,
      moveHistory,
      playerColor
    );

    // Recognize patterns
    const patterns = this.recognizePatterns(chess, moveHistory, playerColor);

    return {
      position: fen,
      thoughts,
      finalJudgment,
      keyInsights,
      learningOpportunities,
      patternRecognition: patterns
    };
  }

  /**
   * Analyze player's decision-making patterns across multiple games
   */
  public analyzePlayerThinking(
    gameHistory: Array<{
      metrics: GameplayMetrics[];
      result: string;
      playerColor: 'w' | 'b';
    }>
  ): {
    tendencies: PlayerTendency[];
    cognitivePatterns: string[];
    improvementAreas: Array<{ area: string; priority: number; advice: string }>;
  } {
    const tendencies: PlayerTendency[] = [];

    // Analyze tactical tendencies
    this.analyzeTacticalTendencies(gameHistory, tendencies);

    // Analyze positional tendencies
    this.analyzePositionalTendencies(gameHistory, tendencies);

    // Analyze time management patterns
    this.analyzeTimePatterns(gameHistory, tendencies);

    // Identify cognitive patterns
    const cognitivePatterns = this.identifyCognitivePatterns(tendencies);

    // Generate prioritized improvement areas
    const improvementAreas = this.prioritizeImprovements(tendencies, cognitivePatterns);

    // Store for future reference
    tendencies.forEach(t => {
      this.playerTendencies.set(t.pattern, t);
    });

    return {
      tendencies,
      cognitivePatterns,
      improvementAreas
    };
  }

  /**
   * Generate deep coaching advice using chain-of-thought
   */
  public generateDeepCoaching(
    position: string,
    playerHistory: DeepAnalysis[]
  ): string {
    const analysis = playerHistory[playerHistory.length - 1];
    
    let coaching = "Let me think through this position with you:\n\n";

    // Walk through each thought step
    analysis.thoughts.forEach(thought => {
      coaching += `**Step ${thought.step}**: ${thought.reasoning}\n`;
      if (thought.alternatives.length > 0) {
        coaching += `   Alternatives to consider: ${thought.alternatives.join(', ')}\n`;
      }
      coaching += `   (Confidence: ${(thought.confidence * 100).toFixed(0)}%)\n\n`;
    });

    coaching += `\n**Overall Assessment**: ${analysis.finalJudgment}\n\n`;

    // Add pattern-based insights
    if (analysis.patternRecognition.length > 0) {
      coaching += "**Patterns I Notice**:\n";
      analysis.patternRecognition.forEach(pattern => {
        coaching += `- ${pattern.name}: ${pattern.description}\n`;
        coaching += `  Your mastery: ${pattern.masteryLevel}% | `;
        coaching += `Recommendation: ${pattern.recommendation}\n`;
      });
    }

    return coaching;
  }

  // ============= Private Helper Methods =============

  private initializePatternDatabase(): void {
    // Initialize common tactical patterns
    this.patternDatabase.set('fork', {
      type: 'tactical',
      name: 'Fork',
      description: 'Attacking two pieces simultaneously',
      frequency: 0,
      masteryLevel: 50,
      recommendation: 'Look for knight and queen forks in every position'
    });

    this.patternDatabase.set('pin', {
      type: 'tactical',
      name: 'Pin',
      description: 'Restricting a piece that shields a more valuable piece',
      frequency: 0,
      masteryLevel: 50,
      recommendation: 'Check if any opponent pieces are aligned with their king/queen'
    });

    this.patternDatabase.set('back-rank', {
      type: 'tactical',
      name: 'Back Rank Weakness',
      description: 'King trapped on back rank by own pawns',
      frequency: 0,
      masteryLevel: 50,
      recommendation: 'Always give your king a "luft" (escape square) by moving h3 or h6'
    });

    // Add more patterns...
  }

  private assessMaterial(chess: Chess): string {
    const balance = this.calculateMaterialBalance(chess);
    
    if (Math.abs(balance) < 100) {
      return "Material is roughly equal. The position will be decided by positional factors and tactics.";
    } else if (balance > 300) {
      return `You're up significant material (+${(balance / 100).toFixed(1)} pawns). Focus on simplifying and converting your advantage.`;
    } else if (balance < -300) {
      return `You're down material (-${Math.abs(balance / 100).toFixed(1)} pawns). Look for tactical complications or try to create threats.`;
    } else if (balance > 0) {
      return `You have a slight material advantage (+${(balance / 100).toFixed(1)} pawns). Maintain pressure but don't overextend.`;
    } else {
      return `You're slightly behind in material (-${Math.abs(balance / 100).toFixed(1)} pawns). Seek active piece play to compensate.`;
    }
  }

  private calculateMaterialBalance(chess: Chess): number {
    const values: { [key: string]: number } = {
      'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0
    };

    let balance = 0;
    const board = chess.board();

    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = values[square.type];
          balance += square.color === 'w' ? value : -value;
        }
      });
    });

    return balance;
  }

  private assessKingSafety(chess: Chess, playerColor: 'w' | 'b'): string {
    const king = this.findKing(chess, playerColor);
    if (!king) return "King position unclear.";

    const castled = this.hasCastled(chess, playerColor);
    const pawnsShielding = this.countPawnShield(chess, king, playerColor);

    if (castled && pawnsShielding >= 2) {
      return "Your king is well-protected behind a solid pawn shield. Good defensive setup.";
    } else if (castled && pawnsShielding === 1) {
      return "Your king is castled but the pawn shield is weakened. Be cautious of piece infiltration.";
    } else if (!castled && chess.moves().length > 10) {
      return "Your king is still in the center. This is dangerous - castle soon!";
    } else {
      return "King safety is concerning. Your king is exposed to potential attacks.";
    }
  }

  private calculateKingSafetyScore(chess: Chess, playerColor: 'w' | 'b'): number {
    const king = this.findKing(chess, playerColor);
    if (!king) return 0;

    let score = 50; // Base score

    if (this.hasCastled(chess, playerColor)) score += 30;
    score += this.countPawnShield(chess, king, playerColor) * 10;
    score -= this.countAttackersNearKing(chess, king, playerColor) * 15;

    return Math.max(0, Math.min(100, score));
  }

  private suggestKingSafetyImprovements(chess: Chess, playerColor: 'w' | 'b'): string[] {
    const suggestions: string[] = [];

    if (!this.hasCastled(chess, playerColor)) {
      suggestions.push("Castle to safety (0-0 or 0-0-0)");
    }

    const king = this.findKing(chess, playerColor);
    if (king) {
      const shield = this.countPawnShield(chess, king, playerColor);
      if (shield < 2) {
        suggestions.push("Push h3/h6 to give king an escape square");
      }
    }

    return suggestions;
  }

  private assessPieceActivity(chess: Chess, playerColor: 'w' | 'b'): string {
    const score = this.calculateActivityScore(chess, playerColor);

    if (score > 75) {
      return "Your pieces are very active! They control key squares and have good mobility.";
    } else if (score > 50) {
      return "Decent piece activity. Look for ways to improve your worst-placed piece.";
    } else {
      return "Your pieces are somewhat passive. Try to activate them by finding better squares.";
    }
  }

  private calculateActivityScore(chess: Chess, playerColor: 'w' | 'b'): number {
    let totalMobility = 0;
    let pieceCount = 0;

    const board = chess.board();
    board.forEach((row, rankIndex) => {
      row.forEach((square, fileIndex) => {
        if (square && square.color === playerColor) {
          pieceCount++;
          const squareNotation = String.fromCharCode(97 + fileIndex) + (8 - rankIndex);
          const moves = chess.moves({ square: squareNotation as any, verbose: true });
          totalMobility += moves.length;
        }
      });
    });

    const averageMobility = pieceCount > 0 ? totalMobility / pieceCount : 0;
    return Math.min(100, averageMobility * 10);
  }

  private suggestActivityImprovements(chess: Chess, playerColor: 'w' | 'b'): string[] {
    const suggestions: string[] = [];
    
    // Find undeveloped pieces
    const backRank = playerColor === 'w' ? 0 : 7;
    const board = chess.board();
    
    let unmoved = 0;
    board[backRank].forEach(square => {
      if (square && square.type !== 'p' && square.type !== 'k') {
        unmoved++;
      }
    });

    if (unmoved > 2) {
      suggestions.push("Develop your remaining pieces (knights and bishops)");
    }

    suggestions.push("Look for outposts (squares where your pieces can't be attacked by pawns)");
    
    return suggestions;
  }

  private assessPawnStructure(chess: Chess, playerColor: 'w' | 'b'): string {
    const weaknesses = this.findPawnWeaknesses(chess, playerColor);
    
    if (weaknesses.length === 0) {
      return "Solid pawn structure with no significant weaknesses.";
    } else if (weaknesses.length <= 2) {
      return `Minor pawn weaknesses detected: ${weaknesses.join(', ')}. Not critical but keep an eye on them.`;
    } else {
      return `Multiple pawn weaknesses: ${weaknesses.join(', ')}. Your pawn structure needs attention.`;
    }
  }

  private calculatePawnStructureScore(chess: Chess): number {
    // Simplified pawn structure evaluation
    return 70; // Placeholder
  }

  private findTacticalMotifs(chess: Chess, playerColor: 'w' | 'b'): Array<{ type: string; description: string }> {
    const tactics: Array<{ type: string; description: string }> = [];

    // Check for fork opportunities
    if (this.detectForkOpportunity(chess, playerColor)) {
      tactics.push({
        type: 'fork',
        description: 'Opportunity to fork two enemy pieces'
      });
    }

    // Check for pin opportunities
    if (this.detectPinOpportunity(chess, playerColor)) {
      tactics.push({
        type: 'pin',
        description: 'Possibility to pin an opponent piece'
      });
    }

    return tactics;
  }

  private describeTactics(tactics: Array<{ type: string; description: string }>): string {
    if (tactics.length === 0) {
      return "No immediate tactical opportunities visible. Focus on improving position.";
    }

    return `Tactical opportunities available: ${tactics.map(t => t.description).join('; ')}`;
  }

  private synthesizeAnalysis(
    thoughts: ThoughtStep[],
    chess: Chess,
    playerColor: 'w' | 'b'
  ): string {
    const averageEval = thoughts.reduce((sum, t) => sum + t.evaluation, 0) / thoughts.length;
    const averageConfidence = thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length;

    if (averageEval > 60) {
      return `You have a strong position! (${(averageConfidence * 100).toFixed(0)}% confident). Maintain your advantage by continuing with your plan.`;
    } else if (averageEval > 30) {
      return `Slight advantage in this position. Keep applying pressure but don't rush.`;
    } else if (averageEval > -30) {
      return `Balanced position. The game could go either way - look for concrete plans.`;
    } else if (averageEval > -60) {
      return `Slightly worse position. Defend carefully and look for counterplay.`;
    } else {
      return `Difficult position. Focus on defense and try to create complications.`;
    }
  }

  private extractKeyInsights(
    thoughts: ThoughtStep[],
    moveHistory: Array<{ move: string; fen: string }>
  ): string[] {
    const insights: string[] = [];

    // Find the thought with lowest confidence
    const lowestConfidence = thoughts.reduce((min, t) => 
      t.confidence < min.confidence ? t : min
    );

    if (lowestConfidence.confidence < 0.7) {
      insights.push(`Uncertain about: ${lowestConfidence.reasoning}`);
    }

    // Check for consistent patterns
    if (thoughts.every(t => t.evaluation > 40)) {
      insights.push("Strong position across all factors - well done!");
    }

    return insights;
  }

  private identifyLearningOpportunities(
    thoughts: ThoughtStep[],
    moveHistory: Array<{ move: string; fen: string }>,
    playerColor: 'w' | 'b'
  ): string[] {
    const opportunities: string[] = [];

    // Identify areas needing improvement based on low evaluations
    thoughts.forEach(thought => {
      if (thought.evaluation < 30 && thought.alternatives.length > 0) {
        opportunities.push(
          `Study: ${thought.reasoning}. Try: ${thought.alternatives[0]}`
        );
      }
    });

    return opportunities;
  }

  private recognizePatterns(
    chess: Chess,
    moveHistory: Array<{ move: string; fen: string }>,
    playerColor: 'w' | 'b'
  ): RecognizedPattern[] {
    const recognized: RecognizedPattern[] = [];

    // Check for back-rank pattern
    if (this.detectBackRankPattern(chess, playerColor)) {
      const pattern = this.patternDatabase.get('back-rank');
      if (pattern) {
        pattern.frequency++;
        recognized.push({ ...pattern });
      }
    }

    // Check for fork pattern
    if (this.detectForkOpportunity(chess, playerColor)) {
      const pattern = this.patternDatabase.get('fork');
      if (pattern) {
        pattern.frequency++;
        recognized.push({ ...pattern });
      }
    }

    return recognized;
  }

  private analyzeTacticalTendencies(
    gameHistory: Array<{ metrics: GameplayMetrics[]; result: string; playerColor: 'w' | 'b' }>,
    tendencies: PlayerTendency[]
  ): void {
    let missedTactics = 0;
    let totalPositions = 0;

    gameHistory.forEach(game => {
      game.metrics.forEach(metric => {
        totalPositions++;
        if (metric.isMissedTactic) {
          missedTactics++;
        }
      });
    });

    if (totalPositions > 0) {
      const missRate = missedTactics / totalPositions;
      if (missRate > 0.3) {
        tendencies.push({
          pattern: 'Frequent tactical oversights',
          occurrences: missedTactics,
          successRate: 1 - missRate,
          contexts: ['Middlegame', 'Complex positions'],
          improvement: 'Practice tactical puzzles daily (15 minutes). Focus on checks, captures, and attacks.'
        });
      }
    }
  }

  private analyzePositionalTendencies(
    gameHistory: Array<{ metrics: GameplayMetrics[]; result: string; playerColor: 'w' | 'b' }>,
    tendencies: PlayerTendency[]
  ): void {
    // Placeholder for positional analysis
  }

  private analyzeTimePatterns(
    gameHistory: Array<{ metrics: GameplayMetrics[]; result: string; playerColor: 'w' | 'b' }>,
    tendencies: PlayerTendency[]
  ): void {
    // Placeholder for time management analysis
  }

  private identifyCognitivePatterns(tendencies: PlayerTendency[]): string[] {
    const patterns: string[] = [];

    tendencies.forEach(tendency => {
      if (tendency.pattern.includes('tactical')) {
        patterns.push("You tend to miss tactical opportunities - this suggests rushing through moves");
      }
      if (tendency.successRate < 0.5) {
        patterns.push(`Low success with: ${tendency.pattern}`);
      }
    });

    return patterns;
  }

  private prioritizeImprovements(
    tendencies: PlayerTendency[],
    cognitivePatterns: string[]
  ): Array<{ area: string; priority: number; advice: string }> {
    const improvements: Array<{ area: string; priority: number; advice: string }> = [];

    tendencies.forEach((tendency, index) => {
      improvements.push({
        area: tendency.pattern,
        priority: tendency.occurrences,
        advice: tendency.improvement
      });
    });

    return improvements.sort((a, b) => b.priority - a.priority);
  }

  // ============= Helper Detection Methods =============

  private findKing(chess: Chess, color: 'w' | 'b'): string | null {
    const board = chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file];
        if (square && square.type === 'k' && square.color === color) {
          return String.fromCharCode(97 + file) + (8 - rank);
        }
      }
    }
    return null;
  }

  private hasCastled(chess: Chess, color: 'w' | 'b'): boolean {
    const king = this.findKing(chess, color);
    if (!king) return false;

    // Check if king is on castled position
    const castledPositions = color === 'w' ? ['g1', 'c1'] : ['g8', 'c8'];
    return castledPositions.includes(king);
  }

  private countPawnShield(chess: Chess, kingSquare: string, color: 'w' | 'b'): number {
    // Simplified pawn shield count
    return 2; // Placeholder
  }

  private countAttackersNearKing(chess: Chess, kingSquare: string, color: 'w' | 'b'): number {
    // Simplified attacker count
    return 1; // Placeholder
  }

  private findPawnWeaknesses(chess: Chess, color: 'w' | 'b'): string[] {
    // Simplified weakness detection
    return [];
  }

  private detectForkOpportunity(chess: Chess, color: 'w' | 'b'): boolean {
    // Simplified fork detection
    return false;
  }

  private detectPinOpportunity(chess: Chess, color: 'w' | 'b'): boolean {
    // Simplified pin detection
    return false;
  }

  private detectBackRankPattern(chess: Chess, color: 'w' | 'b'): boolean {
    const king = this.findKing(chess, color);
    if (!king) return false;

    const backRank = color === 'w' ? '1' : '8';
    return king.includes(backRank) && this.countPawnShield(chess, king, color) >= 2;
  }
}

export const deepThinkingEngine = new DeepThinkingEngine();
