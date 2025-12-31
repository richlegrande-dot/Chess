/**
 * Learning Quality Audit Layer
 * 
 * Derives quality signals from stored gameplay data to detect whether
 * Wall-E coaching is actually improving over time.
 * 
 * ALL SIGNALS ARE DERIVED METRICS - no subjective assessments.
 * 
 * Key Signals:
 * - mistakeRecurrenceRate: How often same mistakes repeat (rolling 10 games)
 * - mistakeResolutionRate: Pattern disappears over time
 * - adviceFollowThroughRate: Mistake not repeated after advice
 * - tacticalErrorDelta: Before vs after coaching
 * - gameAccuracyTrend: Exponential moving average
 * 
 * STRICT RULE: All signals computable from DB state alone, no external logs.
 */

import { PrismaClient } from '@prisma/client/edge';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LearningQualitySignals {
  userId: string;
  computedAt: Date;
  
  // Core Signals (0-100 scale where appropriate)
  mistakeRecurrenceRate: number;     // % of mistakes repeated in last 10 games
  mistakeResolutionRate: number;     // % of patterns that disappeared over time
  adviceFollowThroughRate: number;   // % of advice that led to correction
  tacticalErrorDelta: number;        // Before vs after coaching (- is improvement)
  gameAccuracyTrend: number;         // EMA of accuracy over time
  
  // Supporting Metrics
  totalGamesAnalyzed: number;
  activeMistakePatterns: number;
  resolvedMistakePatterns: number;
  avgMistakesPerGame: number;
  improvementVelocity: number;       // d/dt of accuracy
  
  // Trend Indicators
  isImproving: boolean;
  isRegressing: boolean;
  isStagnant: boolean;
  
  // Raw Data Summary
  dataQuality: 'insufficient' | 'limited' | 'sufficient' | 'excellent';
  gamesInWindow: number;
  patternsTracked: number;
}

interface GameMetrics {
  id: string;
  timestamp: Date;
  accuracy?: number;
  mistakeCount: number;
  mistakeTypes: string[];
}

interface MistakePattern {
  id: string;
  title: string;
  category: string;
  occurrenceCount: number;
  lastOccurrence: Date;
  createdAt: Date;
  confidenceScore: number;
  masteryScore: number;
}

interface AdviceOutcome {
  adviceGiven: string;
  patternKey: string;
  gameIdBefore: string;
  gameIdAfter: string;
  wasFollowed: boolean;
}

// ============================================================================
// SIGNAL COMPUTATION
// ============================================================================

/**
 * Compute all learning quality signals for a user
 */
export async function computeLearningSignals(
  userId: string,
  prisma: PrismaClient
): Promise<LearningQualitySignals> {
  // Fetch all necessary data
  const games = await fetchRecentGames(userId, prisma);
  const mistakes = await fetchMistakePatterns(userId, prisma);
  const coachingMemory = await fetchCoachingMemory(userId, prisma);
  
  // Determine data quality
  const dataQuality = assessDataQuality(games.length, mistakes.length);
  
  // Compute core signals
  const mistakeRecurrenceRate = computeMistakeRecurrence(games, mistakes);
  const mistakeResolutionRate = computeMistakeResolution(mistakes);
  const adviceFollowThroughRate = computeAdviceFollowThrough(coachingMemory, games, mistakes);
  const tacticalErrorDelta = computeTacticalErrorDelta(games);
  const gameAccuracyTrend = computeAccuracyTrend(games);
  
  // Compute supporting metrics
  const totalGamesAnalyzed = games.length;
  const activeMistakePatterns = mistakes.filter(m => 
    (Date.now() - m.lastOccurrence.getTime()) < 30 * 24 * 60 * 60 * 1000 // 30 days
  ).length;
  const resolvedMistakePatterns = mistakes.filter(m => 
    m.masteryScore > 0.8 || 
    (Date.now() - m.lastOccurrence.getTime()) > 60 * 24 * 60 * 60 * 1000 // 60 days
  ).length;
  const avgMistakesPerGame = games.length > 0 
    ? games.reduce((sum, g) => sum + g.mistakeCount, 0) / games.length 
    : 0;
  const improvementVelocity = computeImprovementVelocity(games);
  
  // Determine trend
  const isImproving = improvementVelocity > 0.5 && mistakeResolutionRate > 20;
  const isRegressing = improvementVelocity < -0.5 && mistakeRecurrenceRate > 50;
  const isStagnant = !isImproving && !isRegressing;
  
  return {
    userId,
    computedAt: new Date(),
    mistakeRecurrenceRate,
    mistakeResolutionRate,
    adviceFollowThroughRate,
    tacticalErrorDelta,
    gameAccuracyTrend,
    totalGamesAnalyzed,
    activeMistakePatterns,
    resolvedMistakePatterns,
    avgMistakesPerGame,
    improvementVelocity,
    isImproving,
    isRegressing,
    isStagnant,
    dataQuality,
    gamesInWindow: games.length,
    patternsTracked: mistakes.length,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchRecentGames(
  userId: string,
  prisma: PrismaClient
): Promise<GameMetrics[]> {
  const games = await prisma.trainingGame.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 50, // Last 50 games for trend analysis
  });
  
  return games.map(game => {
    const metrics = game.metrics ? JSON.parse(game.metrics) : {};
    const analysis = game.analysis ? JSON.parse(game.analysis) : {};
    
    return {
      id: game.id,
      timestamp: game.timestamp,
      accuracy: metrics.accuracy || analysis.accuracy,
      mistakeCount: analysis.mistakeCount || 0,
      mistakeTypes: analysis.mistakeTypes || [],
    };
  });
}

async function fetchMistakePatterns(
  userId: string,
  prisma: PrismaClient
): Promise<MistakePattern[]> {
  const patterns = await prisma.mistakeSignature.findMany({
    where: { userId },
    orderBy: { occurrenceCount: 'desc' },
  });
  
  return patterns.map(p => ({
    id: p.id,
    title: p.title,
    category: p.category,
    occurrenceCount: p.occurrenceCount,
    lastOccurrence: p.lastOccurrence,
    createdAt: p.createdAt,
    confidenceScore: p.confidenceScore,
    masteryScore: p.masteryScore,
  }));
}

async function fetchCoachingMemory(
  userId: string,
  prisma: PrismaClient
): Promise<any> {
  const memory = await prisma.coachingMemory.findUnique({
    where: { userId },
  });
  
  if (!memory) return null;
  
  return {
    adviceIssued: JSON.parse(memory.adviceIssued || '[]'),
    adviceFollowedCount: memory.adviceFollowedCount,
    adviceIgnoredCount: memory.adviceIgnoredCount,
    successfulInterventions: memory.successfulInterventions,
  };
}

// ============================================================================
// SIGNAL COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Compute mistake recurrence rate (rolling 10 games)
 * Returns percentage of mistakes that repeated in last 10 games
 */
function computeMistakeRecurrence(
  games: GameMetrics[],
  mistakes: MistakePattern[]
): number {
  if (games.length < 2) return 0;
  
  // Take last 10 games
  const recentGames = games.slice(0, 10);
  
  // Build frequency map
  const mistakeFrequency = new Map<string, number>();
  
  recentGames.forEach(game => {
    game.mistakeTypes.forEach(type => {
      mistakeFrequency.set(type, (mistakeFrequency.get(type) || 0) + 1);
    });
  });
  
  // Count how many mistakes appeared more than once
  let repeatedCount = 0;
  let totalUniqueCount = mistakeFrequency.size;
  
  mistakeFrequency.forEach(count => {
    if (count > 1) repeatedCount++;
  });
  
  if (totalUniqueCount === 0) return 0;
  
  return (repeatedCount / totalUniqueCount) * 100;
}

/**
 * Compute mistake resolution rate
 * Returns percentage of patterns that have been resolved (mastery > 0.8 or absent 60+ days)
 */
function computeMistakeResolution(mistakes: MistakePattern[]): number {
  if (mistakes.length === 0) return 0;
  
  const now = Date.now();
  const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
  
  const resolvedCount = mistakes.filter(m => 
    m.masteryScore > 0.8 || m.lastOccurrence.getTime() < sixtyDaysAgo
  ).length;
  
  return (resolvedCount / mistakes.length) * 100;
}

/**
 * Compute advice follow-through rate
 * Returns percentage of advice that led to pattern correction
 */
function computeAdviceFollowThrough(
  coachingMemory: any,
  games: GameMetrics[],
  mistakes: MistakePattern[]
): number {
  if (!coachingMemory || !coachingMemory.adviceIssued) return 0;
  
  const adviceList = coachingMemory.adviceIssued;
  if (adviceList.length === 0) return 0;
  
  // Use explicit tracking from coaching memory
  const totalAdvice = coachingMemory.adviceFollowedCount + coachingMemory.adviceIgnoredCount;
  
  if (totalAdvice === 0) {
    // Fallback: infer from successful interventions vs total advice
    if (adviceList.length === 0) return 0;
    return (coachingMemory.successfulInterventions / adviceList.length) * 100;
  }
  
  return (coachingMemory.adviceFollowedCount / totalAdvice) * 100;
}

/**
 * Compute tactical error delta (before vs after coaching)
 * Negative value indicates improvement
 */
function computeTacticalErrorDelta(games: GameMetrics[]): number {
  if (games.length < 10) return 0;
  
  // Split into before (older half) and after (recent half)
  const midpoint = Math.floor(games.length / 2);
  const recentGames = games.slice(0, midpoint);
  const olderGames = games.slice(midpoint);
  
  // Count tactical mistakes (assuming they're tagged in mistakeTypes)
  const countTacticalMistakes = (gameList: GameMetrics[]) => {
    let count = 0;
    gameList.forEach(g => {
      count += g.mistakeTypes.filter(t => 
        t.includes('tactical') || t.includes('blunder') || t.includes('hanging')
      ).length;
    });
    return count / gameList.length;
  };
  
  const olderAvg = countTacticalMistakes(olderGames);
  const recentAvg = countTacticalMistakes(recentGames);
  
  // Return delta (negative = improvement)
  return recentAvg - olderAvg;
}

/**
 * Compute game accuracy trend using exponential moving average
 * Returns current EMA value (0-100)
 */
function computeAccuracyTrend(games: GameMetrics[]): number {
  if (games.length === 0) return 0;
  
  // EMA with alpha = 0.2 (20% weight on new values)
  const alpha = 0.2;
  let ema = 0;
  let initialized = false;
  
  // Process games in reverse order (oldest to newest)
  const sortedGames = [...games].reverse();
  
  sortedGames.forEach(game => {
    if (game.accuracy !== undefined && game.accuracy !== null) {
      if (!initialized) {
        ema = game.accuracy;
        initialized = true;
      } else {
        ema = alpha * game.accuracy + (1 - alpha) * ema;
      }
    }
  });
  
  return initialized ? ema : 0;
}

/**
 * Compute improvement velocity (d/dt of accuracy)
 * Returns rate of change per game
 */
function computeImprovementVelocity(games: GameMetrics[]): number {
  if (games.length < 5) return 0;
  
  // Take last 10 games for velocity calculation
  const recentGames = games.slice(0, Math.min(10, games.length));
  
  // Filter games with accuracy data
  const gamesWithAccuracy = recentGames.filter(g => g.accuracy !== undefined);
  
  if (gamesWithAccuracy.length < 3) return 0;
  
  // Simple linear regression: y = mx + b
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
  
  return slope; // Positive = improving, negative = regressing
}

/**
 * Assess data quality based on available data
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
 * Persist learning quality signals as a snapshot in LearningMetric
 */
export async function persistLearningSignals(
  signals: LearningQualitySignals,
  prisma: PrismaClient
): Promise<void> {
  const insights = [
    `Mistake recurrence: ${signals.mistakeRecurrenceRate.toFixed(1)}%`,
    `Resolution rate: ${signals.mistakeResolutionRate.toFixed(1)}%`,
    `Advice follow-through: ${signals.adviceFollowThroughRate.toFixed(1)}%`,
    `Accuracy trend: ${signals.gameAccuracyTrend.toFixed(1)}`,
    signals.isImproving ? 'Status: IMPROVING' : 
      signals.isRegressing ? 'Status: REGRESSING' : 'Status: STAGNANT',
  ];
  
  const progress = {
    mistakeRecurrenceRate: signals.mistakeRecurrenceRate,
    mistakeResolutionRate: signals.mistakeResolutionRate,
    adviceFollowThroughRate: signals.adviceFollowThroughRate,
    tacticalErrorDelta: signals.tacticalErrorDelta,
    gameAccuracyTrend: signals.gameAccuracyTrend,
    improvementVelocity: signals.improvementVelocity,
    dataQuality: signals.dataQuality,
  };
  
  await prisma.learningMetric.create({
    data: {
      userId: signals.userId,
      sessionStart: signals.computedAt,
      sessionEnd: signals.computedAt,
      gameCount: signals.totalGamesAnalyzed,
      mistakesIdentified: signals.activeMistakePatterns,
      mistakesCorrected: signals.resolvedMistakePatterns,
      totalMoves: 0, // Not applicable for audit snapshots
      insights: JSON.stringify(insights),
      progress: JSON.stringify(progress),
    },
  });
}
