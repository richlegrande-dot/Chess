/**
 * Learning Progression Metrics
 * 
 * Quantifies improvement with confidence scores and improvement curves.
 * 
 * METRICS:
 * - confidenceScore: 0-100, EMA-based, reflects consistency
 * - improvementVelocity: d/dt of accuracy
 * - conceptStabilityScore: per mistake pattern
 * - regressionRiskScore: likelihood of performance drop
 * 
 * RULES:
 * - Metrics must be monotonic where appropriate
 * - Confidence DECREASES after regression
 * - No metric inferred without data
 */

import { PrismaClient } from '@prisma/client/edge';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProgressionMetrics {
  userId: string;
  computedAt: Date;
  
  // Core Metrics
  confidenceScore: number;         // 0-100, overall confidence in skill
  improvementVelocity: number;     // Points per game
  regressionRiskScore: number;     // 0-100, higher = more risk
  
  // Per-Pattern Stability
  conceptStabilityScores: ConceptStability[];
  
  // Trend Data
  accuracyCurve: DataPoint[];
  confidenceCurve: DataPoint[];
  
  // Metadata
  dataQuality: 'insufficient' | 'limited' | 'sufficient' | 'excellent';
  gamesAnalyzed: number;
}

export interface ConceptStability {
  patternKey: string;
  patternTitle: string;
  stabilityScore: number;  // 0-100
  trend: 'improving' | 'stable' | 'regressing' | 'volatile';
  lastSeen: Date;
  occurrences: number;
}

export interface DataPoint {
  gameIndex: number;
  value: number;
  timestamp: Date;
}

interface GameData {
  id: string;
  timestamp: Date;
  accuracy?: number;
  mistakeCount: number;
  mistakeTypes: string[];
}

interface PatternData {
  id: string;
  title: string;
  category: string;
  occurrenceCount: number;
  lastOccurrence: Date;
  createdAt: Date;
  masteryScore: number;
}

// ============================================================================
// COMPUTE PROGRESSION METRICS
// ============================================================================

/**
 * Compute all progression metrics for a user
 */
export async function computeProgressionMetrics(
  userId: string,
  prisma: PrismaClient
): Promise<ProgressionMetrics> {
  // Fetch game data
  const games = await fetchGameData(userId, prisma);
  const patterns = await fetchPatternData(userId, prisma);
  
  // Assess data quality
  const dataQuality = assessDataQuality(games.length, patterns.length);
  
  // Compute core metrics
  const confidenceScore = computeConfidenceScore(games);
  const improvementVelocity = computeImprovementVelocity(games);
  const regressionRiskScore = computeRegressionRisk(games, confidenceScore);
  
  // Compute per-pattern stability
  const conceptStabilityScores = computeConceptStability(patterns, games);
  
  // Build curves
  const accuracyCurve = buildAccuracyCurve(games);
  const confidenceCurve = buildConfidenceCurve(games);
  
  return {
    userId,
    computedAt: new Date(),
    confidenceScore,
    improvementVelocity,
    regressionRiskScore,
    conceptStabilityScores,
    accuracyCurve,
    confidenceCurve,
    dataQuality,
    gamesAnalyzed: games.length,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchGameData(
  userId: string,
  prisma: PrismaClient
): Promise<GameData[]> {
  const games = await prisma.trainingGame.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });
  
  return games.map(g => {
    const metrics = g.metrics ? JSON.parse(g.metrics) : {};
    const analysis = g.analysis ? JSON.parse(g.analysis) : {};
    
    return {
      id: g.id,
      timestamp: g.timestamp,
      accuracy: metrics.accuracy || analysis.accuracy,
      mistakeCount: analysis.mistakeCount || 0,
      mistakeTypes: analysis.mistakeTypes || [],
    };
  });
}

async function fetchPatternData(
  userId: string,
  prisma: PrismaClient
): Promise<PatternData[]> {
  const patterns = await prisma.mistakeSignature.findMany({
    where: { userId },
  });
  
  return patterns.map(p => ({
    id: p.id,
    title: p.title,
    category: p.category,
    occurrenceCount: p.occurrenceCount,
    lastOccurrence: p.lastOccurrence,
    createdAt: p.createdAt,
    masteryScore: p.masteryScore,
  }));
}

// ============================================================================
// METRIC COMPUTATION
// ============================================================================

/**
 * Compute confidence score (0-100)
 * Based on consistency and trend stability
 */
function computeConfidenceScore(games: GameData[]): number {
  if (games.length < 3) return 0;
  
  const gamesWithAccuracy = games.filter(g => g.accuracy !== undefined);
  if (gamesWithAccuracy.length < 3) return 0;
  
  // Calculate variance
  const mean = gamesWithAccuracy.reduce((sum, g) => sum + (g.accuracy || 0), 0) / gamesWithAccuracy.length;
  const variance = gamesWithAccuracy.reduce((sum, g) => {
    const diff = (g.accuracy || 0) - mean;
    return sum + diff * diff;
  }, 0) / gamesWithAccuracy.length;
  
  const stdDev = Math.sqrt(variance);
  
  // Lower variance = higher confidence
  // Normalize: assume stdDev of 20 = 0 confidence, stdDev of 0 = 100 confidence
  const consistencyScore = Math.max(0, 100 - (stdDev * 5));
  
  // Factor in improvement trend
  const recentGames = gamesWithAccuracy.slice(0, 5);
  const olderGames = gamesWithAccuracy.slice(5, 10);
  
  let trendBonus = 0;
  if (olderGames.length > 0) {
    const recentAvg = recentGames.reduce((sum, g) => sum + (g.accuracy || 0), 0) / recentGames.length;
    const olderAvg = olderGames.reduce((sum, g) => sum + (g.accuracy || 0), 0) / olderGames.length;
    
    if (recentAvg > olderAvg) {
      trendBonus = 10; // Bonus for improving
    } else if (recentAvg < olderAvg - 5) {
      trendBonus = -15; // Penalty for regressing
    }
  }
  
  const finalScore = Math.max(0, Math.min(100, consistencyScore + trendBonus));
  
  return finalScore;
}

/**
 * Compute improvement velocity (points per game)
 */
function computeImprovementVelocity(games: GameData[]): number {
  if (games.length < 5) return 0;
  
  const gamesWithAccuracy = games.slice(0, 20).filter(g => g.accuracy !== undefined);
  if (gamesWithAccuracy.length < 3) return 0;
  
  // Linear regression
  const n = gamesWithAccuracy.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  gamesWithAccuracy.forEach((game, index) => {
    const x = index;
    const y = game.accuracy!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return slope; // Positive = improving
}

/**
 * Compute regression risk score (0-100)
 * Higher score = more risk of performance drop
 */
function computeRegressionRisk(games: GameData[], confidenceScore: number): number {
  if (games.length < 5) return 50; // Unknown risk
  
  const recentGames = games.slice(0, 5);
  const gamesWithAccuracy = recentGames.filter(g => g.accuracy !== undefined);
  
  if (gamesWithAccuracy.length < 3) return 50;
  
  // Risk factors:
  // 1. Low confidence
  // 2. Recent downward trend
  // 3. High mistake volatility
  
  let riskScore = 0;
  
  // Factor 1: Low confidence = higher risk
  riskScore += (100 - confidenceScore) * 0.3;
  
  // Factor 2: Downward trend in last 5 games
  const velocityShort = computeImprovementVelocity(games.slice(0, 5));
  if (velocityShort < -0.5) {
    riskScore += 30;
  }
  
  // Factor 3: Mistake volatility
  const mistakeStdDev = computeMistakeVolatility(recentGames);
  riskScore += Math.min(40, mistakeStdDev * 2);
  
  return Math.max(0, Math.min(100, riskScore));
}

function computeMistakeVolatility(games: GameData[]): number {
  if (games.length < 2) return 0;
  
  const mistakeCounts = games.map(g => g.mistakeCount);
  const mean = mistakeCounts.reduce((sum, c) => sum + c, 0) / mistakeCounts.length;
  const variance = mistakeCounts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / mistakeCounts.length;
  
  return Math.sqrt(variance);
}

/**
 * Compute concept stability per pattern
 */
function computeConceptStability(
  patterns: PatternData[],
  games: GameData[]
): ConceptStability[] {
  return patterns.map(pattern => {
    const patternKey = pattern.title.toLowerCase();
    
    // Find occurrences in games
    const occurrences = games.filter(g =>
      g.mistakeTypes.some(t => t.toLowerCase().includes(patternKey))
    );
    
    // Determine trend
    const recent5 = games.slice(0, 5);
    const older5 = games.slice(5, 10);
    
    const recentOccurrences = recent5.filter(g =>
      g.mistakeTypes.some(t => t.toLowerCase().includes(patternKey))
    ).length;
    
    const olderOccurrences = older5.length > 0 ? older5.filter(g =>
      g.mistakeTypes.some(t => t.toLowerCase().includes(patternKey))
    ).length : 0;
    
    let trend: 'improving' | 'stable' | 'regressing' | 'volatile';
    
    if (recentOccurrences === 0 && pattern.masteryScore > 0.7) {
      trend = 'improving';
    } else if (recentOccurrences > olderOccurrences) {
      trend = 'regressing';
    } else if (recentOccurrences < olderOccurrences) {
      trend = 'improving';
    } else if (recentOccurrences === olderOccurrences && recentOccurrences > 0) {
      trend = 'volatile';
    } else {
      trend = 'stable';
    }
    
    // Stability score based on mastery and consistency
    const masteryComponent = pattern.masteryScore * 50;
    const trendComponent = trend === 'improving' ? 50 : 
                            trend === 'stable' ? 30 : 
                            trend === 'regressing' ? 10 : 20;
    
    const stabilityScore = masteryComponent + trendComponent;
    
    return {
      patternKey: `${pattern.category}:${pattern.title}`,
      patternTitle: pattern.title,
      stabilityScore: Math.min(100, stabilityScore),
      trend,
      lastSeen: pattern.lastOccurrence,
      occurrences: pattern.occurrenceCount,
    };
  });
}

/**
 * Build accuracy curve (data points over time)
 */
function buildAccuracyCurve(games: GameData[]): DataPoint[] {
  return games
    .filter(g => g.accuracy !== undefined)
    .map((g, index) => ({
      gameIndex: games.length - index - 1, // Reverse for chronological
      value: g.accuracy!,
      timestamp: g.timestamp,
    }))
    .reverse();
}

/**
 * Build confidence curve using EMA
 */
function buildConfidenceCurve(games: GameData[]): DataPoint[] {
  const alpha = 0.2;
  const curve: DataPoint[] = [];
  
  const gamesWithAccuracy = games
    .filter(g => g.accuracy !== undefined)
    .reverse(); // Chronological order
  
  let ema = 0;
  let initialized = false;
  
  gamesWithAccuracy.forEach((game, index) => {
    if (!initialized) {
      ema = game.accuracy!;
      initialized = true;
    } else {
      ema = alpha * game.accuracy! + (1 - alpha) * ema;
    }
    
    // Map EMA to confidence score (0-100)
    // Higher accuracy = higher confidence
    const confidenceValue = Math.max(0, Math.min(100, ema));
    
    curve.push({
      gameIndex: index,
      value: confidenceValue,
      timestamp: game.timestamp,
    });
  });
  
  return curve;
}

/**
 * Assess data quality
 */
function assessDataQuality(
  gameCount: number,
  patternCount: number
): 'insufficient' | 'limited' | 'sufficient' | 'excellent' {
  if (gameCount < 5 || patternCount < 2) return 'insufficient';
  if (gameCount < 10 || patternCount < 3) return 'limited';
  if (gameCount < 25 || patternCount < 5) return 'sufficient';
  return 'excellent';
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Persist progression metrics to database
 */
export async function persistProgressionMetrics(
  metrics: ProgressionMetrics,
  prisma: PrismaClient
): Promise<void> {
  const insights = [
    `Confidence: ${metrics.confidenceScore.toFixed(1)}/100`,
    `Improvement velocity: ${metrics.improvementVelocity.toFixed(2)} pts/game`,
    `Regression risk: ${metrics.regressionRiskScore.toFixed(1)}/100`,
    `Stable concepts: ${metrics.conceptStabilityScores.filter(c => c.stabilityScore > 70).length}`,
  ];
  
  const progress = {
    confidenceScore: metrics.confidenceScore,
    improvementVelocity: metrics.improvementVelocity,
    regressionRiskScore: metrics.regressionRiskScore,
    conceptStability: metrics.conceptStabilityScores,
    dataQuality: metrics.dataQuality,
  };
  
  await prisma.learningMetric.create({
    data: {
      userId: metrics.userId,
      sessionStart: metrics.computedAt,
      sessionEnd: metrics.computedAt,
      gameCount: metrics.gamesAnalyzed,
      mistakesIdentified: metrics.conceptStabilityScores.length,
      mistakesCorrected: metrics.conceptStabilityScores.filter(c => c.trend === 'improving').length,
      totalMoves: 0,
      insights: JSON.stringify(insights),
      progress: JSON.stringify(progress),
    },
  });
}
