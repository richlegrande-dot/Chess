/**
 * Coaching Heuristics v2 - Chess Pedagogy Upgrade
 * 
 * Transforms Wall-E from reactive advice to pedagogically structured coaching.
 * 
 * DESIGN PRINCIPLES:
 * - Teach ONE concept at a time
 * - Prefer pattern correction over move critique
 * - Reference cause → consequence → correction
 * - Reduce advice verbosity as mastery improves
 * 
 * HEURISTICS:
 * - mistakeFatiguePenalty: Avoid repeating same advice
 * - masteryGate: Don't introduce new concept until old stabilizes
 * - conceptSpiral: Reintroduce concept at deeper level
 * - lossAversionBias: Correction for emotional patterns
 * - tacticalStrategicProgression: Move from tactical to strategic focus
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CoachingContext {
  topMistakePatterns: MistakePattern[];
  recentGames: GameSummary[];
  learningMetrics: MetricSnapshot[];
  coachingMemory?: CoachingMemory;
  currentGame?: GameContext;
}

export interface MistakePattern {
  id: string;
  title: string;
  category: string;
  occurrenceCount: number;
  lastOccurrence: Date;
  masteryScore: number;
  confidenceScore: number;
}

export interface GameSummary {
  id: string;
  timestamp: Date;
  accuracy?: number;
  mistakeCount: number;
  mistakeTypes: string[];
  result?: string;
}

export interface MetricSnapshot {
  sessionStart: Date;
  gameCount: number;
  mistakesIdentified: number;
  mistakesCorrected: number;
  progress: any;
}

export interface CoachingMemory {
  adviceIssued: AdviceRecord[];
  recentTakeaways: string[];
  accuracyTrend: { date: Date; accuracy: number }[];
}

export interface AdviceRecord {
  patternKey: string;
  advice: string;
  timestamp: Date;
  timesRepeated: number;
}

export interface GameContext {
  pgn?: string;
  accuracy?: number;
  playerColor?: string;
  result?: string;
}

export interface CoachingStrategy {
  strategy: 'beginner' | 'intermediate' | 'advanced' | 'maintenance';
  focusArea: string;
  focusPattern: MistakePattern | null;
  teachingMethod: 'introduce' | 'reinforce' | 'deepen' | 'maintain';
  verbosityLevel: 'detailed' | 'moderate' | 'concise';
  shouldIntroduceNewConcept: boolean;
  mistakeFatigueDetected: boolean;
  adviceTemplate: string;
}

// ============================================================================
// STRATEGY SELECTION
// ============================================================================

/**
 * Select appropriate coaching strategy based on player history
 */
export function selectCoachingStrategy(context: CoachingContext): CoachingStrategy {
  // Determine player level
  const playerLevel = determinePlayerLevel(context);
  
  // Check for mistake fatigue (same advice repeated too often)
  const fatigueDetected = detectMistakeFatigue(context);
  
  // Apply mastery gate (check if ready for new concepts)
  const canIntroduceNew = applyMasteryGate(context);
  
  // Select focus pattern
  const focusPattern = selectFocusPattern(context, fatigueDetected);
  
  // Determine teaching method
  const teachingMethod = determineTeachingMethod(context, focusPattern);
  
  // Set verbosity based on mastery
  const verbosityLevel = determineVerbosity(context, focusPattern);
  
  // Generate advice template
  const adviceTemplate = generateAdviceTemplate(
    playerLevel,
    teachingMethod,
    focusPattern,
    verbosityLevel
  );
  
  return {
    strategy: playerLevel,
    focusArea: focusPattern?.category || 'fundamentals',
    focusPattern,
    teachingMethod,
    verbosityLevel,
    shouldIntroduceNewConcept: canIntroduceNew,
    mistakeFatigueDetected: fatigueDetected,
    adviceTemplate,
  };
}

// ============================================================================
// HEURISTIC: PLAYER LEVEL DETERMINATION
// ============================================================================

function determinePlayerLevel(
  context: CoachingContext
): 'beginner' | 'intermediate' | 'advanced' | 'maintenance' {
  const { recentGames, topMistakePatterns, learningMetrics } = context;
  
  // Insufficient data = beginner
  if (recentGames.length < 5) return 'beginner';
  
  // Calculate average accuracy
  const avgAccuracy = recentGames
    .filter(g => g.accuracy !== undefined)
    .reduce((sum, g) => sum + (g.accuracy || 0), 0) / recentGames.length;
  
  // Calculate mistake diversity
  const uniqueMistakeTypes = new Set(
    recentGames.flatMap(g => g.mistakeTypes)
  ).size;
  
  // Calculate mastery distribution
  const avgMastery = topMistakePatterns.length > 0
    ? topMistakePatterns.reduce((sum, p) => sum + p.masteryScore, 0) / topMistakePatterns.length
    : 0;
  
  // Decision tree
  if (avgAccuracy < 60 || uniqueMistakeTypes > 8) return 'beginner';
  if (avgAccuracy < 75 || avgMastery < 0.5) return 'intermediate';
  if (avgMastery > 0.8 && avgAccuracy > 85) return 'maintenance';
  return 'advanced';
}

// ============================================================================
// HEURISTIC: MISTAKE FATIGUE DETECTION
// ============================================================================

function detectMistakeFatigue(context: CoachingContext): boolean {
  const { coachingMemory } = context;
  
  if (!coachingMemory || !coachingMemory.adviceIssued) return false;
  
  // Check if any advice has been repeated more than 3 times in last 10 sessions
  const recentAdvice = coachingMemory.adviceIssued.slice(-10);
  const adviceFrequency = new Map<string, number>();
  
  recentAdvice.forEach(record => {
    const key = record.patternKey;
    adviceFrequency.set(key, (adviceFrequency.get(key) || 0) + 1);
  });
  
  // Fatigue threshold: same pattern addressed 3+ times
  for (const count of adviceFrequency.values()) {
    if (count >= 3) return true;
  }
  
  return false;
}

// ============================================================================
// HEURISTIC: MASTERY GATE
// ============================================================================

function applyMasteryGate(context: CoachingContext): boolean {
  const { topMistakePatterns } = context;
  
  // No patterns = can introduce concepts
  if (topMistakePatterns.length === 0) return true;
  
  // Check if top pattern has reached mastery threshold (0.6)
  const topPattern = topMistakePatterns[0];
  
  // Gate rule: Don't introduce new concept if:
  // 1. Top pattern mastery < 0.6
  // 2. Pattern occurred in last 3 games
  const recentOccurrence = 
    (Date.now() - topPattern.lastOccurrence.getTime()) < (3 * 24 * 60 * 60 * 1000);
  
  if (topPattern.masteryScore < 0.6 && recentOccurrence) {
    return false; // Gate closed
  }
  
  return true; // Gate open
}

// ============================================================================
// HEURISTIC: FOCUS PATTERN SELECTION
// ============================================================================

function selectFocusPattern(
  context: CoachingContext,
  fatigueDetected: boolean
): MistakePattern | null {
  const { topMistakePatterns } = context;
  
  if (topMistakePatterns.length === 0) return null;
  
  // If fatigue detected, skip top pattern and focus on second
  if (fatigueDetected && topMistakePatterns.length > 1) {
    return topMistakePatterns[1];
  }
  
  // Otherwise focus on top unmastered pattern
  const unmasteredPattern = topMistakePatterns.find(p => p.masteryScore < 0.8);
  
  return unmasteredPattern || topMistakePatterns[0];
}

// ============================================================================
// HEURISTIC: TEACHING METHOD (CONCEPT SPIRAL)
// ============================================================================

function determineTeachingMethod(
  context: CoachingContext,
  focusPattern: MistakePattern | null
): 'introduce' | 'reinforce' | 'deepen' | 'maintain' {
  if (!focusPattern) return 'introduce';
  
  const { masteryScore, occurrenceCount } = focusPattern;
  
  // New pattern (low occurrence) = introduce
  if (occurrenceCount <= 2) return 'introduce';
  
  // Low mastery = reinforce
  if (masteryScore < 0.5) return 'reinforce';
  
  // Moderate mastery = deepen understanding
  if (masteryScore < 0.8) return 'deepen';
  
  // High mastery = maintenance mode
  return 'maintain';
}

// ============================================================================
// HEURISTIC: VERBOSITY CONTROL
// ============================================================================

function determineVerbosity(
  context: CoachingContext,
  focusPattern: MistakePattern | null
): 'detailed' | 'moderate' | 'concise' {
  if (!focusPattern) return 'detailed'; // New players get more detail
  
  const { masteryScore } = focusPattern;
  
  // High mastery = concise reminders
  if (masteryScore > 0.7) return 'concise';
  
  // Moderate mastery = balanced
  if (masteryScore > 0.4) return 'moderate';
  
  // Low mastery = detailed explanations
  return 'detailed';
}

// ============================================================================
// HEURISTIC: TACTICAL → STRATEGIC PROGRESSION
// ============================================================================

export function applyTacticalStrategicProgression(
  context: CoachingContext
): 'tactical' | 'strategic' | 'balanced' {
  const { topMistakePatterns, recentGames } = context;
  
  // Count tactical vs strategic mistakes
  const tacticalCount = topMistakePatterns.filter(p => 
    p.category === 'tactical' || p.title.includes('blunder') || p.title.includes('hanging')
  ).length;
  
  const strategicCount = topMistakePatterns.filter(p =>
    p.category === 'positional' || p.category === 'strategic'
  ).length;
  
  // Calculate average accuracy
  const avgAccuracy = recentGames
    .filter(g => g.accuracy !== undefined)
    .reduce((sum, g) => sum + (g.accuracy || 0), 0) / (recentGames.length || 1);
  
  // Progression rule:
  // - Low accuracy (< 70) → focus on tactics
  // - High tactical errors → focus on tactics
  // - Otherwise → balanced or strategic
  
  if (avgAccuracy < 70 || tacticalCount > strategicCount * 2) {
    return 'tactical';
  }
  
  if (avgAccuracy > 80 && strategicCount > 0) {
    return 'strategic';
  }
  
  return 'balanced';
}

// ============================================================================
// HEURISTIC: LOSS AVERSION BIAS CORRECTION
// ============================================================================

export function correctForLossAversionBias(
  context: CoachingContext
): { hasBias: boolean; suggestion: string } {
  const { recentGames } = context;
  
  // Count losses vs wins
  const losses = recentGames.filter(g => 
    g.result === '0-1' || g.result === '1-0' // Depends on player color
  ).length;
  
  const totalGames = recentGames.length;
  
  // Detect if player is making overly defensive mistakes after losses
  const recentLosses = recentGames.slice(0, 3).filter(g => 
    g.result && g.result !== '1/2-1/2'
  ).length;
  
  if (recentLosses >= 2 && totalGames >= 5) {
    return {
      hasBias: true,
      suggestion: 'You may be playing too defensively after recent losses. Trust your preparation and play your normal game.',
    };
  }
  
  return { hasBias: false, suggestion: '' };
}

// ============================================================================
// ADVICE TEMPLATE GENERATION
// ============================================================================

function generateAdviceTemplate(
  playerLevel: string,
  teachingMethod: string,
  focusPattern: MistakePattern | null,
  verbosityLevel: string
): string {
  const templates = {
    beginner: {
      introduce: 'Let\'s learn about {concept}. {cause} → {consequence} → {correction}.',
      reinforce: 'Remember: {concept}. {correction}.',
      deepen: 'You understand {concept}, but {refinement}.',
      maintain: 'Keep up the good work with {concept}!',
    },
    intermediate: {
      introduce: '{concept} is key. {cause} leads to {consequence}. Try {correction}.',
      reinforce: '{concept} needs more work. Focus on {correction}.',
      deepen: 'Refine your {concept}. {refinement}.',
      maintain: '{concept} is solid. Continue applying it.',
    },
    advanced: {
      introduce: 'Consider {concept}: {refinement}.',
      reinforce: '{correction} for {concept}.',
      deepen: '{refinement}.',
      maintain: 'Maintain {concept}.',
    },
    maintenance: {
      introduce: 'Explore {concept}.',
      reinforce: '{correction}.',
      deepen: '{refinement}.',
      maintain: 'Strong on {concept}.',
    },
  };
  
  const levelTemplates = templates[playerLevel as keyof typeof templates] || templates.beginner;
  const template = levelTemplates[teachingMethod as keyof typeof levelTemplates];
  
  // Apply verbosity adjustment
  if (verbosityLevel === 'concise') {
    // Use shorter template versions
    return template.split('.')[0] + '.';
  }
  
  return template;
}

// ============================================================================
// ADVICE COMPOSITION
// ============================================================================

export function composeAdvice(
  strategy: CoachingStrategy,
  context: CoachingContext
): string {
  const { focusPattern, adviceTemplate, teachingMethod } = strategy;
  
  if (!focusPattern) {
    return 'Continue playing and I\'ll identify patterns to help you improve.';
  }
  
  // Extract concept details
  const concept = focusPattern.title;
  const category = focusPattern.category;
  
  // Generate cause → consequence → correction
  const { cause, consequence, correction, refinement } = generateCauseConsequenceCorrection(
    focusPattern,
    teachingMethod
  );
  
  // Fill template
  let advice = adviceTemplate
    .replace('{concept}', concept)
    .replace('{cause}', cause)
    .replace('{consequence}', consequence)
    .replace('{correction}', correction)
    .replace('{refinement}', refinement);
  
  return advice;
}

function generateCauseConsequenceCorrection(
  pattern: MistakePattern,
  teachingMethod: string
): { cause: string; consequence: string; correction: string; refinement: string } {
  // Simplified cause-consequence-correction logic
  // In production, this would be more sophisticated
  
  const { title, category } = pattern;
  
  let cause = `When you ${title.toLowerCase()}`;
  let consequence = `you lose material or position`;
  let correction = `Double-check before moving`;
  let refinement = `Look for counterplay even in difficult positions`;
  
  // Customize based on category
  if (category === 'tactical') {
    correction = `Calculate all forcing moves before deciding`;
    refinement = `Practice tactical puzzles daily`;
  } else if (category === 'positional') {
    correction = `Improve piece coordination before attacking`;
    refinement = `Study master games in similar positions`;
  } else if (category === 'opening') {
    correction = `Review opening principles: control center, develop pieces, castle`;
    refinement = `Focus on understanding plans, not memorizing moves`;
  } else if (category === 'endgame') {
    correction = `Activate your king and create passed pawns`;
    refinement = `Study fundamental endgames (K+P, K+R vs K)`;
  }
  
  return { cause, consequence, correction, refinement };
}

// ============================================================================
// TRACKING & UPDATES
// ============================================================================

export function trackAdviceIssued(
  pattern: MistakePattern,
  advice: string
): AdviceRecord {
  return {
    patternKey: `${pattern.category}:${pattern.title}`,
    advice: advice,
    timestamp: new Date(),
    timesRepeated: 1,
  };
}

export function shouldUpdateMastery(
  pattern: MistakePattern,
  recentGames: GameSummary[]
): { shouldUpdate: boolean; newMasteryScore: number } {
  // Check if pattern appears in recent 5 games
  const recent5 = recentGames.slice(0, 5);
  const patternKey = pattern.title.toLowerCase();
  
  const appearances = recent5.filter(g =>
    g.mistakeTypes.some(t => t.toLowerCase().includes(patternKey))
  ).length;
  
  // Mastery decay if pattern appears frequently
  if (appearances >= 2) {
    const newScore = Math.max(0, pattern.masteryScore - 0.1);
    return { shouldUpdate: true, newMasteryScore: newScore };
  }
  
  // Mastery improvement if pattern absent
  if (appearances === 0 && pattern.masteryScore < 1.0) {
    const newScore = Math.min(1.0, pattern.masteryScore + 0.05);
    return { shouldUpdate: true, newMasteryScore: newScore };
  }
  
  return { shouldUpdate: false, newMasteryScore: pattern.masteryScore };
}
