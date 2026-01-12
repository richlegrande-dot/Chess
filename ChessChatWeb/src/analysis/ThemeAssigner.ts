/**
 * Theme Assigner - Assigns coaching themes to turning points
 * 
 * This module takes turning points from engine analysis and assigns
 * appropriate coaching themes based on position characteristics,
 * move quality, and game phase. It forms the bridge between raw
 * analysis data and structured coaching advice.
 */

import { Chess } from 'chess.js';
import { 
  TurnPoint, 
  ThemedTurnPoint, 
  GamePhase, 
  MoveClassification,
  CoachTheme 
} from './types';
import { COACH_THEMES } from './coachThemes';
import { PhaseClassifier } from './PhaseClassifier';

/**
 * Configuration for theme assignment
 */
export interface ThemeAssignerConfig {
  maxThemesPerTurnPoint: number;  // Max themes to assign per position
  priorityThreshold: number;       // Minimum priority for theme assignment
  phaseWeighting: number;         // How much to weight phase-specific themes
  skillLevelWeighting: number;    // How much to weight skill-appropriate themes
}

export const DEFAULT_THEME_CONFIG: ThemeAssignerConfig = {
  maxThemesPerTurnPoint: 3,
  priorityThreshold: 0.6,
  phaseWeighting: 1.5,
  skillLevelWeighting: 1.2
};

/**
 * Assigns coaching themes to turning points
 */
export class ThemeAssigner {
  private config: ThemeAssignerConfig;
  private phaseClassifier: PhaseClassifier;

  constructor(
    config: Partial<ThemeAssignerConfig> = {},
    phaseClassifier?: PhaseClassifier
  ) {
    this.config = { ...DEFAULT_THEME_CONFIG, ...config };
    this.phaseClassifier = phaseClassifier || new PhaseClassifier();
  }

  /**
   * Assign themes to a collection of turn points
   */
  async assignThemes(
    turnPoints: TurnPoint[],
    skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<ThemedTurnPoint[]> {
    const themedTurnPoints: ThemedTurnPoint[] = [];

    for (const turnPoint of turnPoints) {
      const themes = await this.assignThemesToTurnPoint(turnPoint, skillLevel);
      
      themedTurnPoints.push({
        ...turnPoint,
        themes,
        gamePhase: this.phaseClassifier.classifyPhase(
          turnPoint.fenBefore, 
          turnPoint.moveNumber
        )
      });
    }

    return themedTurnPoints;
  }

  /**
   * Assign themes to a single turning point
   */
  private async assignThemesToTurnPoint(
    turnPoint: TurnPoint,
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<CoachTheme[]> {
    const chess = new Chess(turnPoint.fenBefore);
    const gamePhase = this.phaseClassifier.classifyPhase(
      turnPoint.fenBefore, 
      turnPoint.moveNumber
    );
    
    const candidateThemes: Array<{ theme: CoachTheme; score: number }> = [];

    // Evaluate each theme for relevance
    for (const theme of Object.values(COACH_THEMES)) {
      const score = this.calculateThemeRelevance(
        theme,
        turnPoint,
        gamePhase,
        chess,
        skillLevel
      );
      
      if (score >= this.config.priorityThreshold) {
        candidateThemes.push({ theme, score });
      }
    }

    // Sort by relevance score and return top themes
    return candidateThemes
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxThemesPerTurnPoint)
      .map(item => item.theme);
  }

  /**
   * Calculate how relevant a theme is to a specific turning point
   */
  private calculateThemeRelevance(
    theme: CoachTheme,
    turnPoint: TurnPoint,
    gamePhase: GamePhase,
    chess: Chess,
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
  ): number {
    let score = theme.priority;

    // Phase-specific weighting
    if (theme.gamePhases.includes(gamePhase)) {
      score *= this.config.phaseWeighting;
    }

    // Skill level weighting
    if (theme.skillLevels.includes(skillLevel)) {
      score *= this.config.skillLevelWeighting;
    }

    // Move quality specific themes
    const moveClassification = this.classifyMoveFromEvalDelta(turnPoint.evalDelta);
    score *= this.getMoveQualityWeight(theme, moveClassification);

    // Position-specific detection
    score *= this.getPositionSpecificWeight(theme, turnPoint, chess);

    return Math.min(1.0, score);
  }

  /**
   * Get weight based on move quality
   */
  private getMoveQualityWeight(
    theme: CoachTheme,
    moveClassification: MoveClassification
  ): number {
    // Theme-specific move quality preferences
    const moveQualityWeights: Record<string, Record<MoveClassification, number>> = {
      'blunder_recovery': {
        'blunder': 2.0,
        'mistake': 1.5,
        'inaccuracy': 1.0,
        'good': 0.3,
        'excellent': 0.1
      },
      'calculation_accuracy': {
        'blunder': 2.0,
        'mistake': 1.8,
        'inaccuracy': 1.3,
        'good': 0.8,
        'excellent': 0.5
      },
      'pattern_recognition': {
        'blunder': 1.8,
        'mistake': 1.5,
        'inaccuracy': 1.2,
        'good': 0.9,
        'excellent': 0.7
      }
    };

    return moveQualityWeights[theme.id]?.[moveClassification] || 1.0;
  }

  /**
   * Get weight based on position-specific characteristics
   */
  private getPositionSpecificWeight(
    theme: CoachTheme,
    turnPoint: TurnPoint,
    chess: Chess
  ): number {
    let weight = 1.0;

    // Category-specific position analysis
    switch (theme.category) {
      case 'tactics':
        weight *= this.getTacticalWeight(chess, turnPoint);
        break;
      case 'strategy':
        weight *= this.getStrategicWeight(chess);
        break;
      case 'opening':
        weight *= this.getOpeningWeight(chess, turnPoint.moveNumber);
        break;
      case 'endgame':
        weight *= this.getEndgameWeight(chess);
        break;
      case 'time_management':
        weight *= this.getTimeManagementWeight(turnPoint);
        break;
      case 'psychology':
        weight *= this.getPsychologyWeight(turnPoint);
        break;
    }

    return weight;
  }

  /**
   * Calculate tactical position weight
   */
  private getTacticalWeight(chess: Chess, turnPoint: TurnPoint): number {
    let weight = 1.0;

    // Check for tactical motifs
    if (this.hasTacticalMotifs(chess)) {
      weight *= 1.5;
    }

    // Large evaluation swing suggests tactics
    if (Math.abs(turnPoint.evalDelta) > 200) {
      weight *= 1.3;
    }

    return weight;
  }

  /**
   * Calculate strategic position weight
   */
  private getStrategicWeight(chess: Chess): number {
    let weight = 1.0;

    // Closed positions favor strategic themes
    const mobilityScore = chess.moves().length;
    if (mobilityScore < 30) {
      weight *= 1.4; // Closed position
    }

    return weight;
  }

  /**
   * Calculate opening-specific weight
   */
  private getOpeningWeight(chess: Chess, moveNumber: number): number {
    if (moveNumber > 15) return 0.3; // Late for opening themes
    if (moveNumber <= 10) return 1.5; // Perfect for opening themes
    return 1.0;
  }

  /**
   * Calculate endgame-specific weight
   */
  private getEndgameWeight(chess: Chess): number {
    const materialCount = this.calculateMaterialCount(chess);
    const totalMaterial = materialCount.white + materialCount.black;
    
    if (totalMaterial <= 12) return 1.8; // Clear endgame
    if (totalMaterial <= 20) return 1.3; // Transitioning to endgame
    return 0.4; // Too much material for endgame themes
  }

  /**
   * Calculate time management weight
   */
  private getTimeManagementWeight(turnPoint: TurnPoint): number {
    // Time management themes are more relevant for significant moves
    const evalMagnitude = Math.abs(turnPoint.evalDelta);
    return evalMagnitude > 100 ? 1.3 : 1.0;
  }

  /**
   * Calculate psychology weight
   */
  private getPsychologyWeight(turnPoint: TurnPoint): number {
    // Psychology themes are relevant for all significant turning points
    return Math.abs(turnPoint.evalDelta) > 150 ? 1.2 : 1.0;
  }

  /**
   * Check for tactical motifs in position
   */
  private hasTacticalMotifs(chess: Chess): boolean {
    // Simple heuristic: check for pieces that can capture each other
    const moves = chess.moves({ verbose: true });
    
    // Check for captures
    const captures = moves.filter(move => move.captured);
    if (captures.length > 2) return true;

    // Check for checks
    const checks = moves.filter(move => move.san.includes('+'));
    if (checks.length > 0) return true;

    return false;
  }

  /**
   * Classify move based on evaluation delta
   */
  private classifyMoveFromEvalDelta(evalDelta: number): MoveClassification {
    const abs = Math.abs(evalDelta);
    
    if (abs >= 300) return 'blunder';
    if (abs >= 150) return 'mistake';
    if (abs >= 75) return 'inaccuracy';
    if (abs <= 25) return 'excellent';
    return 'good';
  }

  /**
   * Calculate material count
   */
  private calculateMaterialCount(chess: Chess): { white: number; black: number } {
    const board = chess.board();
    const pieceValues = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    let white = 0, black = 0;
    
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = pieceValues[square.type as keyof typeof pieceValues];
          if (square.color === 'w') white += value;
          else black += value;
        }
      });
    });
    
    return { white, black };
  }

  /**
   * Get configuration
   */
  getConfig(): ThemeAssignerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ThemeAssignerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get phase classifier instance
   */
  getPhaseClassifier(): PhaseClassifier {
    return this.phaseClassifier;
  }
}"