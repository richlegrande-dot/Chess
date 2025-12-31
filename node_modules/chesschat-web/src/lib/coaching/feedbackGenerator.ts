/**
 * Feedback Template Generator
 * Combines tactical and strategic analysis into human-readable coaching
 */

import {
  TacticalMistake,
  StrategicViolation,
  GameplayMetrics,
  CoachingReport,
  Improvement,
  AnalysisContext,
} from './types';

interface FeedbackTemplate {
  condition: (context: AnalysisContext) => boolean;
  generate: (context: AnalysisContext) => string;
  priority: number; // Higher = more important
}

export class FeedbackGenerator {
  private templates: Map<string, FeedbackTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate complete coaching report
   */
  generateReport(
    mistakes: TacticalMistake[],
    violations: StrategicViolation[],
    metrics: GameplayMetrics[]
  ): CoachingReport {
    const startTime = Date.now();
    const context: AnalysisContext = { mistakes, violations, metrics };

    // Generate specific improvements (top 3 critical issues)
    const improvements = this.selectTopImprovements(context);

    // Generate phase-specific analysis
    const gamePhaseAnalysis = this.analyzeGamePhases(context);

    // Generate strategic and tactical focus
    const strategicFocus = this.generateStrategicFocus(violations);
    const tacticalFocus = this.generateTacticalFocus(mistakes);

    // Generate encouragement
    const encouragement = this.generateEncouragement(context);

    // Calculate statistics
    const statistics = this.calculateStatistics(mistakes, violations, metrics);

    return {
      improvements,
      strategicFocus,
      tacticalFocus,
      encouragement,
      gamePhaseAnalysis,
      statistics,
      metadata: {
        source: 'rule-based',
        analysisTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Initialize all feedback templates
   */
  private initializeTemplates(): void {
    // Tactical Feedback Templates
    this.templates.set('many_blunders', {
      condition: (ctx) => ctx.mistakes.filter((m) => m.type === 'blunder').length >= 3,
      generate: (ctx) => {
        const blunders = ctx.mistakes.filter((m) => m.type === 'blunder');
        const firstBlunder = blunders[0];
        return `🤖 Wall-E noticed ${blunders.length} blunders - but that's okay, we all make mistakes! ${
          firstBlunder.moveNumber <= 10
            ? '💡 Try slowing down in the opening. Before each move, Wall-E asks: "Is my piece safe here?"'
            : '⏰ Take a deep breath on critical positions. Wall-E counts to 3 before important moves!'
        } Remember: Even the best players started as beginners! 🌟`;
      },
      priority: 10,
    });

    this.templates.set('hanging_pieces', {
      condition: (ctx) =>
        ctx.mistakes.filter((m) => m.explanation.includes('undefended')).length >= 2,
      generate: (ctx) => {
        const hangingMistakes = ctx.mistakes.filter((m) => m.explanation.includes('undefended'));
        return `🛡️ Wall-E spotted ${hangingMistakes.length} undefended pieces - let's protect our friends! 💙 Before moving, Wall-E always asks: "Will my piece buddy have protection?" Count who's guarding what - it's like making sure everyone has a teammate! 🤝`;
      },
      priority: 9,
    });

    this.templates.set('missed_tactics', {
      condition: (ctx) => ctx.mistakes.filter((m) => m.type === 'missed_win').length >= 2,
      generate: (ctx) => {
        const missed = ctx.mistakes.filter((m) => m.type === 'missed_win');
        const patterns = missed.map((m) => m.pattern).filter(Boolean);
        const patternList = [...new Set(patterns)].join(', ');
        return `✨ Wall-E found ${missed.length} hidden treasures you could have captured${
          patternList ? ` (${patternList})` : ''
        }! 🔍 Let's play detective together: look for checks (⚡), captures (🎯), and attacks (⚔️). Practice puzzles with Wall-E to spot these faster! 🧩`;
      },
      priority: 8,
    });

    this.templates.set('back_rank_mate', {
      condition: (ctx) => ctx.mistakes.some((m) => m.explanation.includes('back-rank')),
      generate: () =>
        `🚨 Wall-E detected a back-rank danger zone! Your king needs a little air to breathe, friend! 😮 Give him an escape square (like h3/h6 or a3/a6) - Wall-E calls it a "safety window"! 🪟 Kings get claustrophobic too! 👑`,
      priority: 9,
    });

    this.templates.set('fork_vulnerability', {
      condition: (ctx) => ctx.mistakes.some((m) => m.explanation.includes('fork')),
      generate: () =>
        `🍴 Oops! A sneaky fork caught us (one piece attacking two friends)! Wall-E learned to watch for jumpy knights 🐴 and powerful queens 👸. Before moving, imagine where enemy pieces could hop next! 🦘 Prevention is Wall-E's favorite superpower! 💪`,
      priority: 8,
    });

    // Strategic Feedback Templates
    this.templates.set('poor_development', {
      condition: (ctx) =>
        ctx.violations.filter((v) => v.principle === 'piece_development').length >= 3,
      generate: () =>
        `🎭 Wall-E noticed some pieces sitting on the bench! Everyone wants to join the party! 🎉 Wall-E's team rule: "Knights first 🐴, then bishops 🔺, everyone toward center! ⭐" No piece left behind - get the whole crew together before the big battle! 🤜🤛`,
      priority: 8,
    });

    this.templates.set('weak_king_safety', {
      condition: (ctx) => ctx.violations.some((v) => v.principle === 'king_safety'),
      generate: (ctx) => {
        const castleViolation = ctx.violations.find((v) => v.principle === 'king_safety');
        return `🏰 Wall-E thinks the king needs a safe castle home${
          castleViolation ? ` (we waited until move ${castleViolation.moveNumber}!)` : ''
        }! 👑 The center is like a busy street - castling by move 10 moves the king to a cozy fortress! 🛡️ Wall-E always protects the king first - safety matters! 💚`;
      },
      priority: 9,
    });

    this.templates.set('no_center_control', {
      condition: (ctx) => ctx.violations.some((v) => v.principle === 'center_control'),
      generate: () =>
        `🎯 Wall-E wants to claim the center treasure (d4, e4, d5, e5)! It's the most important real estate on the board! 🏆 Plant your pawn flags there early (moves 1-10) - it's like owning the high ground! ⛰️ Center = Power! 💫`,
      priority: 7,
    });

    this.templates.set('passive_pieces', {
      condition: (ctx) =>
        ctx.violations.filter((v) => v.principle === 'piece_activity').length >= 2,
      generate: () =>
        `Your pieces were passive with limited mobility. Place pieces on active squares: knights on central outposts, bishops on long diagonals, rooks on open files.`,
      priority: 6,
    });

    this.templates.set('weak_pawns', {
      condition: (ctx) => ctx.violations.some((v) => v.principle === 'pawn_structure'),
      generate: () =>
        `You created weak pawns (isolated, doubled, or backward). Pawns can't move backward! Think twice before pushing them - every pawn move creates permanent strengths or weaknesses.`,
      priority: 6,
    });

    this.templates.set('passive_king_endgame', {
      condition: (ctx) =>
        ctx.violations.filter((v) => v.principle === 'king_activity' && v.phase === 'endgame')
          .length >= 2,
      generate: () =>
        `Your king was too passive in the endgame. In endgames, the king is a strong piece! Bring it to the center to support pawns and attack opponent's weaknesses.`,
      priority: 8,
    });

    this.templates.set('no_passed_pawns', {
      condition: (ctx) =>
        ctx.violations.filter((v) => v.principle === 'passed_pawns').length >= 2,
      generate: () =>
        `You missed opportunities to create passed pawns in the endgame. Passed pawns are the most powerful endgame weapon - create them and push them forward with king support.`,
      priority: 7,
    });

    // Encouraging Feedback Templates
    this.templates.set('strong_opening', {
      condition: (ctx) => {
        const earlyMistakes = ctx.mistakes.filter((m) => m.moveNumber <= 10);
        const openingViolations = ctx.violations.filter((v) => v.moveNumber <= 10 && v.phase === 'opening');
        return earlyMistakes.length === 0 && openingViolations.length <= 1;
      },
      generate: () =>
        `Excellent opening play! You controlled the center, developed pieces efficiently, and castled early. This solid foundation gave you a great position for the middlegame.`,
      priority: 5,
    });

    this.templates.set('good_endgame', {
      condition: (ctx) => {
        const endgameMoves = ctx.metrics.filter((m) => m.moveNumber >= 30);
        const endgameMistakes = ctx.mistakes.filter((m) => m.moveNumber >= 30);
        return endgameMoves.length >= 10 && endgameMistakes.length <= 1;
      },
      generate: () =>
        `Great endgame technique! You activated your king, handled pawn promotion well, and converted your advantage smoothly. Endgame mastery separates strong players from average ones.`,
      priority: 5,
    });

    this.templates.set('few_mistakes', {
      condition: (ctx) => ctx.mistakes.filter((m) => m.type !== 'inaccuracy').length <= 2,
      generate: (ctx) => {
        const significantMistakes = ctx.mistakes.filter((m) => m.type !== 'inaccuracy').length;
        return `Very accurate play with only ${significantMistakes} significant mistake(s)! Your calculation and pattern recognition are improving. Keep practicing tactical puzzles to maintain this level.`;
      },
      priority: 5,
    });
  }

  /**
   * Select top 3 improvements based on severity and priority
   */
  private selectTopImprovements(context: AnalysisContext): Improvement[] {
    const improvements: Improvement[] = [];

    // Find applicable templates
    for (const [key, template] of this.templates.entries()) {
      if (template.condition(context)) {
        const feedback = template.generate(context);
        const relatedMove = this.findRelatedMove(key, context);

        improvements.push({
          title: this.getImprovementTitle(key),
          description: feedback,
          moveNumber: relatedMove?.moveNumber,
          severity: template.priority,
          category: this.getCategory(key),
        });
      }
    }

    // Sort by severity (priority) and return top 3
    return improvements.sort((a, b) => b.severity - a.severity).slice(0, 3);
  }

  /**
   * Analyze performance by game phase
   */
  private analyzeGamePhases(context: AnalysisContext): {
    opening: string;
    middlegame: string;
    endgame: string;
  } {
    const openingMoves = context.metrics.filter((m) => m.moveNumber <= 15);
    const middlegameMoves = context.metrics.filter((m) => m.moveNumber > 15 && m.moveNumber <= 30);
    const endgameMoves = context.metrics.filter((m) => m.moveNumber > 30);

    const openingMistakes = context.mistakes.filter((m) => m.moveNumber <= 15);
    const middlegameMistakes = context.mistakes.filter((m) => m.moveNumber > 15 && m.moveNumber <= 30);
    const endgameMistakes = context.mistakes.filter((m) => m.moveNumber > 30);

    return {
      opening:
        openingMoves.length > 0
          ? this.evaluatePhase('Opening', openingMoves.length, openingMistakes.length)
          : 'Game did not reach opening phase.',
      middlegame:
        middlegameMoves.length > 0
          ? this.evaluatePhase('Middlegame', middlegameMoves.length, middlegameMistakes.length)
          : 'Game did not reach middlegame phase.',
      endgame:
        endgameMoves.length > 0
          ? this.evaluatePhase('Endgame', endgameMoves.length, endgameMistakes.length)
          : 'Game did not reach endgame phase.',
    };
  }

  /**
   * Evaluate performance in a specific phase
   */
  private evaluatePhase(phaseName: string, totalMoves: number, mistakes: number): string {
    const accuracy = totalMoves > 0 ? ((totalMoves - mistakes) / totalMoves) * 100 : 0;

    if (accuracy >= 90) {
      return `${phaseName}: Excellent (${Math.round(accuracy)}% accuracy). Strong play throughout this phase.`;
    } else if (accuracy >= 75) {
      return `${phaseName}: Good (${Math.round(accuracy)}% accuracy). Some room for improvement.`;
    } else if (accuracy >= 60) {
      return `${phaseName}: Fair (${Math.round(accuracy)}% accuracy). Focus on this phase in future games.`;
    } else {
      return `${phaseName}: Needs work (${Math.round(accuracy)}% accuracy). Study ${phaseName.toLowerCase()} principles.`;
    }
  }

  /**
   * Generate strategic focus summary
   */
  private generateStrategicFocus(violations: StrategicViolation[]): string {
    if (violations.length === 0) {
      return 'Your strategic play was solid. You followed the key principles well.';
    }

    const principleCount = new Map<string, number>();
    for (const violation of violations) {
      principleCount.set(violation.principle, (principleCount.get(violation.principle) || 0) + 1);
    }

    const topPrinciple = [...principleCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const principleName = this.getPrincipleDisplayName(topPrinciple[0]);

    return `Your main strategic weakness was **${principleName}** (${topPrinciple[1]} violations). Focus on this in your next games.`;
  }

  /**
   * Generate tactical focus summary
   */
  private generateTacticalFocus(mistakes: TacticalMistake[]): string {
    const blunders = mistakes.filter((m) => m.type === 'blunder').length;
    const missed = mistakes.filter((m) => m.type === 'missed_win').length;

    if (blunders === 0 && missed === 0) {
      return 'Excellent tactical awareness! You avoided major blunders and found key tactics.';
    }

    if (blunders > missed) {
      return `Focus on **preventing blunders** (${blunders} in this game). Slow down and check for hanging pieces before moving.`;
    } else {
      return `Focus on **finding tactical shots** (missed ${missed} opportunities). Practice tactical puzzles to recognize patterns faster.`;
    }
  }

  /**
   * Generate encouraging feedback with Wall-E's supportive personality
   */
  private generateEncouragement(context: AnalysisContext): string {
    // Check for strong performance in any area
    const strongTemplates = ['strong_opening', 'good_endgame', 'few_mistakes'];
    for (const key of strongTemplates) {
      const template = this.templates.get(key);
      if (template && template.condition(context)) {
        return template.generate(context);
      }
    }

    // Wall-E's encouraging messages based on effort
    const movesPlayed = context.metrics.length;
    const totalMistakes = context.mistakes.length;

    if (movesPlayed >= 40) {
      return `🌟 Wow! You played ${movesPlayed} moves - Wall-E is impressed by your determination! 💪 Every long game teaches us so much! Wall-E believes in you - keep going! 🚀`;
    }

    if (totalMistakes <= 5) {
      return `✨ Amazing! Only ${totalMistakes} mistake(s)! Wall-E does a happy dance! 🎉 Your calculation skills are leveling up! Keep practicing and Wall-E will be here cheering you on! 📈`;
    }

    return `💚 Wall-E sees you're making progress, friend! Every game is a treasure chest of lessons! 📦 Focus on these improvements, and Wall-E promises you'll see results soon! Together we'll get better! 🤝`;
  }

  /**
   * Calculate game statistics
   */
  private calculateStatistics(
    mistakes: TacticalMistake[],
    violations: StrategicViolation[],
    metrics: GameplayMetrics[]
  ) {
    return {
      totalMoves: metrics.length,
      blunders: mistakes.filter((m) => m.type === 'blunder').length,
      mistakes: mistakes.filter((m) => m.type === 'mistake').length,
      inaccuracies: mistakes.filter((m) => m.type === 'inaccuracy').length,
      missedWins: mistakes.filter((m) => m.type === 'missed_win').length,
      principleViolations: violations.length,
      averageThinkTime: metrics
        .filter((m) => m.thinkTime)
        .reduce((sum, m) => sum + (m.thinkTime || 0), 0) / metrics.length || undefined,
    };
  }

  /**
   * Find the move related to a specific issue
   */
  private findRelatedMove(templateKey: string, context: AnalysisContext): { moveNumber: number } | null {
    // Map template keys to their related mistakes/violations
    if (templateKey.includes('blunder') || templateKey.includes('hanging') || templateKey.includes('fork') || templateKey.includes('back_rank')) {
      const relatedMistake = context.mistakes.find((m) =>
        templateKey === 'many_blunders' ? m.type === 'blunder' :
        templateKey === 'hanging_pieces' ? m.explanation.includes('undefended') :
        templateKey === 'fork_vulnerability' ? m.explanation.includes('fork') :
        templateKey === 'back_rank_mate' ? m.explanation.includes('back-rank') :
        false
      );
      return relatedMistake ? { moveNumber: relatedMistake.moveNumber } : null;
    }

    if (templateKey.includes('development') || templateKey.includes('king_safety') || templateKey.includes('center')) {
      const relatedViolation = context.violations.find((v) =>
        templateKey === 'poor_development' ? v.principle === 'piece_development' :
        templateKey === 'weak_king_safety' ? v.principle === 'king_safety' :
        templateKey === 'no_center_control' ? v.principle === 'center_control' :
        false
      );
      return relatedViolation ? { moveNumber: relatedViolation.moveNumber } : null;
    }

    return null;
  }

  /**
   * Get human-readable title for improvement
   */
  private getImprovementTitle(key: string): string {
    const titles: Record<string, string> = {
      many_blunders: 'Reduce Blunders',
      hanging_pieces: 'Protect Your Pieces',
      missed_tactics: 'Find Tactical Opportunities',
      back_rank_mate: 'Prevent Back-Rank Mates',
      fork_vulnerability: 'Watch for Forks',
      poor_development: 'Develop Pieces Faster',
      weak_king_safety: 'Castle Earlier',
      no_center_control: 'Control the Center',
      passive_pieces: 'Activate Your Pieces',
      weak_pawns: 'Maintain Pawn Structure',
      passive_king_endgame: 'Activate King in Endgame',
      no_passed_pawns: 'Create Passed Pawns',
    };
    return titles[key] || 'General Improvement';
  }

  /**
   * Get category for improvement
   */
  private getCategory(key: string): 'tactical' | 'strategic' | 'time_management' {
    if (key.includes('blunder') || key.includes('tactic') || key.includes('hanging') || key.includes('fork') || key.includes('back_rank')) {
      return 'tactical';
    }
    return 'strategic';
  }

  /**
   * Get display name for principle
   */
  private getPrincipleDisplayName(principle: string): string {
    const names: Record<string, string> = {
      center_control: 'Center Control',
      piece_development: 'Piece Development',
      king_safety: 'King Safety',
      pawn_structure: 'Pawn Structure',
      piece_activity: 'Piece Activity',
      king_activity: 'King Activity',
      passed_pawns: 'Passed Pawns',
      piece_coordination: 'Piece Coordination',
    };
    return names[principle] || principle;
  }
}
