/**
 * Enhanced Learning System
 * Learns from user gameplay patterns to provide personalized coaching
 * Implements multi-game transfer learning and adaptive feedback
 * 
 * Based on research from:
 * - Transfer learning (Netguru AI model training)
 * - Gameplay analytics (Turf Network)
 * - Skill progression tracking (Newo AI chatbot training)
 */

import { GameplayMetrics } from '../coaching/types';
import { DeepAnalysis, PlayerTendency, deepThinkingEngine } from './deepThinkingEngine';
import { savePlayerProfileViaAPI } from '../api/walleApiSync';

export interface PlayerProfile {
  playerId: string;
  createdAt: number;
  gamesPlayed: number;
  
  // Skill ratings (0-100)
  tacticalRating: number;
  positionalRating: number;
  endgameRating: number;
  openingRating: number;
  
  // Learning metrics
  improvementRate: number; // Points per 10 games
  strengthAreas: string[];
  weaknessAreas: string[];
  
  // Behavioral patterns
  playStyle: 'aggressive' | 'defensive' | 'balanced' | 'positional';
  commonMistakes: string[];
  favoriteOpenings: string[];
  
  // Progress tracking
  ratingHistory: Array<{ date: number; rating: number }>;
  milestones: Array<{ achievement: string; date: number }>;
}

export interface LearningSession {
  sessionId: string;
  startTime: number;
  endTime: number;
  gamesPlayed: number;
  insights: DeepAnalysis[];
  progressMade: string[];
}

export interface AdaptiveCoachingPlan {
  focus: string[];
  exercises: Array<{ type: string; description: string; difficulty: number }>;
  timeframe: string;
  expectedImprovement: number;
}

/**
 * Enhanced Learning System
 * Tracks player progress, identifies patterns, and provides personalized coaching
 */
export class EnhancedLearningSystem {
  private playerProfile: PlayerProfile | null = null;
  private currentSession: LearningSession | null = null;
  private gameHistory: Array<{
    metrics: GameplayMetrics[];
    result: string;
    playerColor: 'w' | 'b';
    analysis: DeepAnalysis | null;
  }> = [];

  constructor() {
    this.loadPlayerProfile();
  }

  /**
   * Initialize or load player profile
   */
  private loadPlayerProfile(): void {
    try {
      const stored = localStorage.getItem('enhanced_player_profile');
      if (stored) {
        this.playerProfile = JSON.parse(stored);
        console.log('[EnhancedLearning] Loaded player profile:', this.playerProfile?.playerId);
      } else {
        this.createNewProfile();
      }
    } catch (error) {
      console.error('[EnhancedLearning] Error loading profile:', error);
      this.createNewProfile();
    }
  }

  /**
   * Create new player profile
   */
  private createNewProfile(): void {
    this.playerProfile = {
      playerId: `player_${Date.now()}`,
      createdAt: Date.now(),
      gamesPlayed: 0,
      tacticalRating: 50,
      positionalRating: 50,
      endgameRating: 50,
      openingRating: 50,
      improvementRate: 0,
      strengthAreas: [],
      weaknessAreas: [],
      playStyle: 'balanced',
      commonMistakes: [],
      favoriteOpenings: [],
      ratingHistory: [],
      milestones: []
    };
    this.savePlayerProfile();
  }

  /**
   * Save player profile to localStorage
   */
  private savePlayerProfile(): void {
    if (this.playerProfile) {
      try {
        localStorage.setItem('enhanced_player_profile', JSON.stringify(this.playerProfile));
        
        // Sync to database via API (non-blocking)
        savePlayerProfileViaAPI({
          skillRatings: this.playerProfile.skillRatings,
          playStyle: this.playerProfile.playStyle,
          improvementRate: this.playerProfile.improvementRate,
          strengthAreas: this.playerProfile.strengthAreas,
          weaknessAreas: this.playerProfile.weaknessAreas,
          commonMistakes: this.playerProfile.commonMistakes,
          favoriteOpenings: this.playerProfile.favoriteOpenings,
          ratingHistory: this.playerProfile.ratingHistory,
          milestones: this.playerProfile.milestones,
          behavioralPatterns: this.playerProfile.behavioralPatterns || {},
          gamesPlayed: this.playerProfile.gamesPlayed
        }).catch(err => console.error('[EnhancedLearning] DB write failed:', err));
      } catch (error) {
        console.error('[EnhancedLearning] Error saving profile:', error);
      }
    }
  }

  /**
   * Start a new learning session
   */
  public startSession(): void {
    this.currentSession = {
      sessionId: `session_${Date.now()}`,
      startTime: Date.now(),
      endTime: 0,
      gamesPlayed: 0,
      insights: [],
      progressMade: []
    };
    console.log('[EnhancedLearning] Started session:', this.currentSession.sessionId);
  }

  /**
   * Record a completed game for learning
   */
  public async recordGame(
    metrics: GameplayMetrics[],
    moveHistory: Array<{ move: string; fen: string }>,
    result: string,
    playerColor: 'w' | 'b'
  ): Promise<DeepAnalysis> {
    if (!this.playerProfile) {
      this.createNewProfile();
    }

    // Perform deep analysis on the game
    const lastPosition = moveHistory[moveHistory.length - 1]?.fen || 'start';
    const deepAnalysis = await deepThinkingEngine.analyzePositionDeeply(
      lastPosition,
      moveHistory,
      playerColor
    );

    // Store game in history
    this.gameHistory.push({
      metrics,
      result,
      playerColor,
      analysis: deepAnalysis
    });

    // Keep only last 50 games
    if (this.gameHistory.length > 50) {
      this.gameHistory = this.gameHistory.slice(-50);
    }

    // Update player profile
    this.updatePlayerProfile(metrics, deepAnalysis, result);

    // Add insights to current session
    if (this.currentSession) {
      this.currentSession.insights.push(deepAnalysis);
      this.currentSession.gamesPlayed++;
    }

    // Save progress
    this.savePlayerProfile();
    this.saveGameHistory();

    return deepAnalysis;
  }

  /**
   * Update player profile based on game performance
   */
  private updatePlayerProfile(
    metrics: GameplayMetrics[],
    analysis: DeepAnalysis,
    result: string
  ): void {
    if (!this.playerProfile) return;

    this.playerProfile.gamesPlayed++;

    // Update tactical rating based on missed tactics
    const missedTactics = metrics.filter(m => m.isMissedTactic).length;
    const tacticalPerformance = 100 - (missedTactics / metrics.length * 100);
    this.playerProfile.tacticalRating = this.smoothUpdate(
      this.playerProfile.tacticalRating,
      tacticalPerformance,
      0.1
    );

    // Update positional rating based on principle violations
    const violations = metrics.reduce((sum, m) => sum + (m.principleViolations?.length || 0), 0);
    const positionalPerformance = Math.max(0, 100 - violations * 5);
    this.playerProfile.positionalRating = this.smoothUpdate(
      this.playerProfile.positionalRating,
      positionalPerformance,
      0.1
    );

    // Extract common mistakes
    analysis.patternRecognition.forEach(pattern => {
      if (pattern.masteryLevel < 60) {
        if (!this.playerProfile!.commonMistakes.includes(pattern.name)) {
          this.playerProfile!.commonMistakes.push(pattern.name);
        }
      }
    });

    // Trim common mistakes to top 5
    if (this.playerProfile.commonMistakes.length > 5) {
      this.playerProfile.commonMistakes = this.playerProfile.commonMistakes.slice(0, 5);
    }

    // Update rating history
    const overallRating = this.calculateOverallRating();
    this.playerProfile.ratingHistory.push({
      date: Date.now(),
      rating: overallRating
    });

    // Keep last 100 ratings
    if (this.playerProfile.ratingHistory.length > 100) {
      this.playerProfile.ratingHistory = this.playerProfile.ratingHistory.slice(-100);
    }

    // Calculate improvement rate
    if (this.playerProfile.ratingHistory.length >= 10) {
      const recent = this.playerProfile.ratingHistory.slice(-10);
      const oldAvg = recent.slice(0, 5).reduce((sum, r) => sum + r.rating, 0) / 5;
      const newAvg = recent.slice(5).reduce((sum, r) => sum + r.rating, 0) / 5;
      this.playerProfile.improvementRate = newAvg - oldAvg;
    }

    // Check for milestones
    this.checkMilestones();
  }

  /**
   * Smooth update using exponential moving average
   */
  private smoothUpdate(current: number, newValue: number, alpha: number): number {
    return current * (1 - alpha) + newValue * alpha;
  }

  /**
   * Calculate overall chess rating (0-100)
   */
  private calculateOverallRating(): number {
    if (!this.playerProfile) return 50;

    return (
      this.playerProfile.tacticalRating * 0.35 +
      this.playerProfile.positionalRating * 0.25 +
      this.playerProfile.endgameRating * 0.20 +
      this.playerProfile.openingRating * 0.20
    );
  }

  /**
   * Check and award milestones
   */
  private checkMilestones(): void {
    if (!this.playerProfile) return;

    const milestones = [
      { games: 10, name: "First 10 Games Completed! 🎉" },
      { games: 50, name: "Half Century! 50 Games Played! 🏆" },
      { games: 100, name: "Centurion! 100 Games Milestone! 🎊" },
    ];

    const ratingMilestones = [
      { rating: 60, name: "Novice Level Reached! ⭐" },
      { rating: 70, name: "Intermediate Level Achieved! ⭐⭐" },
      { rating: 80, name: "Advanced Player! ⭐⭐⭐" },
      { rating: 90, name: "Expert Level! ⭐⭐⭐⭐" },
    ];

    const currentRating = this.calculateOverallRating();

    milestones.forEach(milestone => {
      if (
        this.playerProfile!.gamesPlayed >= milestone.games &&
        !this.playerProfile!.milestones.some(m => m.achievement === milestone.name)
      ) {
        this.playerProfile!.milestones.push({
          achievement: milestone.name,
          date: Date.now()
        });
        console.log('[EnhancedLearning] Milestone achieved:', milestone.name);
      }
    });

    ratingMilestones.forEach(milestone => {
      if (
        currentRating >= milestone.rating &&
        !this.playerProfile!.milestones.some(m => m.achievement === milestone.name)
      ) {
        this.playerProfile!.milestones.push({
          achievement: milestone.name,
          date: Date.now()
        });
        console.log('[EnhancedLearning] Rating milestone:', milestone.name);
      }
    });
  }

  /**
   * Generate adaptive coaching plan based on player history
   */
  public generateCoachingPlan(): AdaptiveCoachingPlan {
    // Check if player has enough data - use gamesPlayed from profile as it's persistent
    if (!this.playerProfile || this.playerProfile.gamesPlayed < 3) {
      return {
        focus: ['Play more games to build your profile'],
        exercises: [],
        timeframe: `${3 - (this.playerProfile?.gamesPlayed || 0)} more games needed`,
        expectedImprovement: 0
      };
    }

    // Analyze player tendencies across all games
    const analysis = deepThinkingEngine.analyzePlayerThinking(this.gameHistory);

    const focus: string[] = [];
    const exercises: Array<{ type: string; description: string; difficulty: number }> = [];

    // Determine focus areas based on weakest skills
    if (this.playerProfile.tacticalRating < 60) {
      focus.push('Tactical Pattern Recognition');
      exercises.push({
        type: 'tactics',
        description: 'Solve 10 tactical puzzles daily (forks, pins, skewers)',
        difficulty: Math.floor(this.playerProfile.tacticalRating / 10)
      });
    }

    if (this.playerProfile.positionalRating < 60) {
      focus.push('Positional Understanding');
      exercises.push({
        type: 'positional',
        description: 'Study 3 annotated master games focusing on pawn structure',
        difficulty: Math.floor(this.playerProfile.positionalRating / 10)
      });
    }

    if (this.playerProfile.openingRating < 60) {
      focus.push('Opening Principles');
      exercises.push({
        type: 'opening',
        description: 'Learn one solid opening repertoire (e4 or d4)',
        difficulty: Math.floor(this.playerProfile.openingRating / 10)
      });
    }

    // Add exercises based on common mistakes
    this.playerProfile.commonMistakes.slice(0, 2).forEach(mistake => {
      exercises.push({
        type: 'pattern',
        description: `Practice positions with ${mistake} pattern`,
        difficulty: 5
      });
    });

    // Calculate expected improvement based on current rate and focused practice
    // Use current improvement rate as baseline, add focused practice bonus
    const currentRate = this.playerProfile.improvementRate || 3;
    const focusedPracticeBonus = focus.length > 0 ? 3 : 0; // Focused practice helps
    const exerciseBonus = Math.min(exercises.length, 3); // More exercises = more improvement
    const expectedImprovement = Math.round(Math.max(3, currentRate + focusedPracticeBonus + exerciseBonus));

    return {
      focus,
      exercises,
      timeframe: '10 games (~1 week)',
      expectedImprovement
    };
  }

  /**
   * Get comprehensive player insights
   */
  public getPlayerInsights(): {
    profile: PlayerProfile | null;
    recentProgress: string[];
    nextMilestone: string | null;
    strengthsAndWeaknesses: { strengths: string[]; weaknesses: string[] };
    coachingPlan: AdaptiveCoachingPlan;
  } {
    const strengthsAndWeaknesses = this.analyzeStrengthsAndWeaknesses();
    const coachingPlan = this.generateCoachingPlan();
    const recentProgress = this.analyzeRecentProgress();
    const nextMilestone = this.findNextMilestone();

    return {
      profile: this.playerProfile,
      recentProgress,
      nextMilestone,
      strengthsAndWeaknesses,
      coachingPlan
    };
  }

  /**
   * Analyze player strengths and weaknesses
   */
  private analyzeStrengthsAndWeaknesses(): { strengths: string[]; weaknesses: string[] } {
    if (!this.playerProfile) {
      return { strengths: [], weaknesses: [] };
    }

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    const ratings = [
      { name: 'Tactical awareness', value: this.playerProfile.tacticalRating },
      { name: 'Positional play', value: this.playerProfile.positionalRating },
      { name: 'Endgame technique', value: this.playerProfile.endgameRating },
      { name: 'Opening knowledge', value: this.playerProfile.openingRating },
    ];

    ratings.forEach(rating => {
      if (rating.value >= 70) {
        strengths.push(`${rating.name} (${rating.value.toFixed(0)}/100)`);
      } else if (rating.value < 55) {
        weaknesses.push(`${rating.name} (${rating.value.toFixed(0)}/100)`);
      }
    });

    return { strengths, weaknesses };
  }

  /**
   * Analyze recent progress over last 5 games
   */
  private analyzeRecentProgress(): string[] {
    const progress: string[] = [];

    if (!this.playerProfile || this.playerProfile.ratingHistory.length < 5) {
      return ['Play more games to see progress'];
    }

    const recent5 = this.playerProfile.ratingHistory.slice(-5);
    const previous5 = this.playerProfile.ratingHistory.slice(-10, -5);

    if (previous5.length >= 5) {
      const recentAvg = recent5.reduce((sum, r) => sum + r.rating, 0) / 5;
      const previousAvg = previous5.reduce((sum, r) => sum + r.rating, 0) / 5;
      const change = recentAvg - previousAvg;

      if (change > 3) {
        progress.push(`📈 Strong improvement: +${change.toFixed(1)} points!`);
      } else if (change > 0) {
        progress.push(`📊 Steady progress: +${change.toFixed(1)} points`);
      } else if (change > -3) {
        progress.push(`📊 Maintaining level: ${change.toFixed(1)} points`);
      } else {
        progress.push(`📉 Slight decline: ${change.toFixed(1)} points - don't worry, this is normal!`);
      }
    }

    // Check improvement rate
    if (this.playerProfile.improvementRate > 5) {
      progress.push('🚀 Rapid improvement detected!');
    } else if (this.playerProfile.improvementRate > 2) {
      progress.push('✅ Good steady growth');
    }

    return progress;
  }

  /**
   * Find next milestone to achieve
   */
  private findNextMilestone(): string | null {
    if (!this.playerProfile) return null;

    const gameMilestones = [10, 25, 50, 75, 100, 200];
    const nextGameMilestone = gameMilestones.find(m => m > this.playerProfile!.gamesPlayed);

    if (nextGameMilestone) {
      const gamesLeft = nextGameMilestone - this.playerProfile.gamesPlayed;
      return `Play ${gamesLeft} more game${gamesLeft > 1 ? 's' : ''} to reach ${nextGameMilestone} games milestone!`;
    }

    const currentRating = this.calculateOverallRating();
    const ratingMilestones = [60, 70, 80, 90];
    const nextRatingMilestone = ratingMilestones.find(m => m > currentRating);

    if (nextRatingMilestone) {
      const pointsNeeded = (nextRatingMilestone - currentRating).toFixed(1);
      return `Improve ${pointsNeeded} points to reach ${nextRatingMilestone} rating level!`;
    }

    return 'Keep playing to discover new milestones!';
  }

  /**
   * Save game history to localStorage
   */
  private saveGameHistory(): void {
    try {
      const simplified = this.gameHistory.map(g => ({
        result: g.result,
        playerColor: g.playerColor,
        tacticalErrors: g.metrics.filter(m => m.isMissedTactic).length,
        positionalErrors: g.metrics.reduce((sum, m) => sum + (m.principleViolations?.length || 0), 0)
      }));
      localStorage.setItem('enhanced_game_history', JSON.stringify(simplified));
    } catch (error) {
      console.error('[EnhancedLearning] Error saving game history:', error);
    }
  }

  /**
   * Reset player profile (for testing or starting fresh)
   */
  public resetProfile(): void {
    localStorage.removeItem('enhanced_player_profile');
    localStorage.removeItem('enhanced_game_history');
    this.gameHistory = [];
    this.createNewProfile();
    console.log('[EnhancedLearning] Profile reset');
  }

  /**
   * Export player data for external analysis
   */
  public exportPlayerData(): string {
    return JSON.stringify({
      profile: this.playerProfile,
      gameHistory: this.gameHistory.map(g => ({
        result: g.result,
        metrics: g.metrics.length,
        analysis: g.analysis?.finalJudgment
      })),
      insights: this.getPlayerInsights()
    }, null, 2);
  }
}

// Singleton instance
let enhancedLearningInstance: EnhancedLearningSystem | null = null;

export function getEnhancedLearningSystem(): EnhancedLearningSystem {
  if (!enhancedLearningInstance) {
    enhancedLearningInstance = new EnhancedLearningSystem();
  }
  return enhancedLearningInstance;
}
