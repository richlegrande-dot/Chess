/**
 * Learning Progress Metrics
 * Derives progression signals from 50-game training window
 * 
 * Metrics:
 * - confidenceScore: 0-100 (EMA + logistic clamp)
 * - improvementVelocity: Slope of recent accuracy trend
 * - conceptStabilityScore: Pattern consistency over time
 * - regressionRiskScore: Recent pattern spike detection
 * 
 * All metrics computed ONLY from stored data (no hallucination)
 */

import { PrismaClient } from '@prisma/client/edge';

export interface ProgressionMetrics {
  confidenceScore: number;        // 0-100: Overall confidence in player's improvement
  improvementVelocity: number;    // -100 to +100: Rate of accuracy change
  conceptStabilityScore: number;  // 0-100: Consistency in avoiding past mistakes
  regressionRiskScore: number;    // 0-100: Risk of recent performance decline
  top3Patterns: TopMistakePattern[];
  gamesAnalyzed: number;
  lastUpdated: Date;
}

export interface TopMistakePattern {
  id: string;
  title: string;
  category: string;
  occurrenceCount: number;
  severity: 'blunder' | 'mistake' | 'inaccuracy';
  recency: number; // 0-1: How recent (1 = very recent)
  repetitionScore: number; // 0-1: How often repeated
}

/**
 * Compute progression metrics from training games and mistake patterns
 */
export async function computeProgressionMetrics(
  prisma: PrismaClient,
  userId: string
): Promise<ProgressionMetrics> {
  // Fetch training games (up to 50, most recent first)
  const games = await prisma.trainingGame.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  // Fetch mistake patterns
  const mistakes = await prisma.mistakeSignature.findMany({
    where: { userId },
    orderBy: { occurrenceCount: 'desc' },
    take: 10,
  });

  if (games.length === 0) {
    // No data yet
    return {
      confidenceScore: 0,
      improvementVelocity: 0,
      conceptStabilityScore: 0,
      regressionRiskScore: 0,
      top3Patterns: [],
      gamesAnalyzed: 0,
      lastUpdated: new Date(),
    };
  }

  // Extract accuracy series
  const accuracySeries = games.map(g => ({
    accuracy: g.metrics?.accuracy || 0,
    timestamp: g.timestamp,
  })).reverse(); // Oldest to newest

  // 1. Confidence Score (EMA with logistic clamp)
  const confidenceScore = computeConfidenceScore(accuracySeries, mistakes);

  // 2. Improvement Velocity (linear regression slope)
  const improvementVelocity = computeImprovementVelocity(accuracySeries);

  // 3. Concept Stability Score (pattern consistency)
  const conceptStabilityScore = computeConceptStability(mistakes, games);

  // 4. Regression Risk Score (recent pattern spike)
  const regressionRiskScore = computeRegressionRisk(accuracySeries, mistakes);

  // 5. Top 3 Patterns (severity + recency + repetition)
  const top3Patterns = computeTop3Patterns(mistakes, games);

  return {
    confidenceScore,
    improvementVelocity,
    conceptStabilityScore,
    regressionRiskScore,
    top3Patterns,
    gamesAnalyzed: games.length,
    lastUpdated: new Date(),
  };
}

/**
 * Confidence Score: EMA of accuracy with logistic clamp
 * Formula: logistic(EMA(accuracy)) scaled to 0-100
 */
function computeConfidenceScore(
  accuracySeries: Array<{ accuracy: number; timestamp: Date }>,
  mistakes: any[]
): number {
  if (accuracySeries.length === 0) return 0;

  // Compute EMA with alpha = 0.2
  const alpha = 0.2;
  let ema = accuracySeries[0].accuracy;
  
  for (let i = 1; i < accuracySeries.length; i++) {
    ema = alpha * accuracySeries[i].accuracy + (1 - alpha) * ema;
  }

  // Adjust for mistake count (more mistakes = lower confidence)
  const mistakePenalty = Math.min(mistakes.length * 2, 20); // Max -20
  const adjustedEma = Math.max(0, ema - mistakePenalty);

  // Logistic clamp: sigmoid(x) scaled to 0-100
  const normalized = adjustedEma / 100; // Assume accuracy is 0-100
  const sigmoid = 1 / (1 + Math.exp(-10 * (normalized - 0.5)));
  
  return Math.round(sigmoid * 100);
}

/**
 * Improvement Velocity: Linear regression slope of accuracy over time
 * Returns -100 to +100 (normalized)
 */
function computeImprovementVelocity(
  accuracySeries: Array<{ accuracy: number; timestamp: Date }>
): number {
  if (accuracySeries.length < 2) return 0;

  // Use last 10 games for velocity
  const recentSeries = accuracySeries.slice(-10);
  const n = recentSeries.length;

  // Simple linear regression: y = mx + b
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i; // Time index
    const y = recentSeries[i].accuracy;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Normalize slope to -100 to +100
  // Slope of +5 per game = +100, -5 per game = -100
  const normalizedSlope = Math.max(-100, Math.min(100, slope * 20));
  
  return Math.round(normalizedSlope);
}

/**
 * Concept Stability: How consistently player avoids past mistakes
 * Higher = fewer repeated mistakes
 */
function computeConceptStability(mistakes: any[], games: any[]): number {
  if (mistakes.length === 0 || games.length < 5) return 50; // Neutral

  // Check if top mistakes are decreasing over time
  const recentGames = games.slice(0, 10); // Last 10 games
  const olderGames = games.slice(10, 20); // Games 11-20

  let recentMistakeCount = 0;
  let olderMistakeCount = 0;

  // Count mistakes in recent vs older games
  recentGames.forEach(g => {
    recentMistakeCount += g.analysis?.mistakeCount || 0;
  });

  olderGames.forEach(g => {
    olderMistakeCount += g.analysis?.mistakeCount || 0;
  });

  if (olderGames.length === 0) return 50;

  const recentAvg = recentMistakeCount / recentGames.length;
  const olderAvg = olderMistakeCount / olderGames.length;

  // If recent mistakes are lower, stability is high
  const improvementRatio = olderAvg > 0 ? (olderAvg - recentAvg) / olderAvg : 0;
  const stability = 50 + improvementRatio * 50;

  return Math.round(Math.max(0, Math.min(100, stability)));
}

/**
 * Regression Risk: Detects recent spike in mistake patterns
 * Higher = more risk of performance decline
 */
function computeRegressionRisk(
  accuracySeries: Array<{ accuracy: number; timestamp: Date }>,
  mistakes: any[]
): number {
  if (accuracySeries.length < 5) return 0;

  // Compare last 3 games to previous 7
  const lastThree = accuracySeries.slice(-3);
  const previousSeven = accuracySeries.slice(-10, -3);

  if (previousSeven.length === 0) return 0;

  const lastThreeAvg = lastThree.reduce((sum, s) => sum + s.accuracy, 0) / lastThree.length;
  const previousSevenAvg = previousSeven.reduce((sum, s) => sum + s.accuracy, 0) / previousSeven.length;

  // If recent accuracy dropped significantly, risk is high
  const drop = previousSevenAvg - lastThreeAvg;
  
  if (drop > 10) {
    // Significant drop
    return Math.round(Math.min(100, (drop / 30) * 100));
  }

  // Check for recent mistake spike
  const recentMistakes = mistakes.filter(m => {
    const daysSinceLastOccurrence = m.lastOccurrence ? 
      (Date.now() - new Date(m.lastOccurrence).getTime()) / (1000 * 60 * 60 * 24) : 999;
    return daysSinceLastOccurrence < 7; // Last week
  });

  if (recentMistakes.length >= 3) {
    return Math.round(Math.min(100, 30 + recentMistakes.length * 10));
  }

  return 0;
}

/**
 * Top 3 Patterns: Rank by severity, recency, and repetition
 */
function computeTop3Patterns(mistakes: any[], games: any[]): TopMistakePattern[] {
  if (mistakes.length === 0) return [];

  const now = Date.now();

  const scoredPatterns = mistakes.map(m => {
    // Severity weight
    const severityWeight = m.severity === 'blunder' ? 3 : m.severity === 'mistake' ? 2 : 1;

    // Recency score (0-1)
    const daysSince = m.lastOccurrence ? 
      (now - new Date(m.lastOccurrence).getTime()) / (1000 * 60 * 60 * 24) : 999;
    const recency = Math.max(0, 1 - daysSince / 30); // Decay over 30 days

    // Repetition score (log scale)
    const repetitionScore = Math.log(m.occurrenceCount + 1) / Math.log(10);

    // Combined score
    const score = severityWeight * 100 + recency * 50 + repetitionScore * 30;

    return {
      id: m.id,
      title: m.title,
      category: m.category,
      occurrenceCount: m.occurrenceCount,
      severity: m.severity || 'mistake',
      recency,
      repetitionScore,
      score,
    };
  });

  // Sort by score and take top 3
  scoredPatterns.sort((a, b) => b.score - a.score);

  return scoredPatterns.slice(0, 3);
}

/**
 * Enforce 50-game window: delete oldest games if >50
 */
export async function enforce50GameWindow(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const games = await prisma.trainingGame.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    select: { id: true },
  });

  if (games.length > 50) {
    const toDelete = games.slice(50); // Keep first 50 (most recent)
    const idsToDelete = toDelete.map(g => g.id);

    await prisma.trainingGame.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    console.log(`[Learning] Enforced 50-game window: deleted ${idsToDelete.length} old games for user ${userId}`);
  }
}
