/**
 * Learning Layer V3 - Core Learning System
 * 
 * Implements concept-based mastery tracking with closed-loop learning.
 */

import conceptsData from './concepts.json';

// ============================================================================
// TYPES
// ============================================================================

export interface ChessConcept {
  id: string;
  name: string;
  category: 'tactical' | 'positional' | 'opening' | 'endgame' | 'strategic' | 'practical';
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  description: string;
}

export interface UserConceptState {
  id: string;
  userId: string;
  conceptId: string;
  mastery: number;        // 0.0 to 1.0
  confidence: number;     // 0.0 to 1.0
  mistakeRateEMA: number;
  successRateEMA: number;
  spacedRepDueAt: Date;
  lastSeenAt: Date | null;
  lastPracticedAt: Date | null;
  evidenceRefs: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MistakeEvent {
  moveNumber: number;
  side: 'white' | 'black';
  moveUCI: string;
  moveSAN: string;
  fen: string;
  evalBefore: number;
  evalAfter: number;
  delta: number;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  concepts: string[];
  phase: 'opening' | 'middlegame' | 'endgame';
  moveType: string;
}

export interface AdviceIntervention {
  id: string;
  userId: string;
  gameId: string | null;
  conceptsTargeted: string[];
  adviceText: string;
  messageHash: string;
  expectedBehavior: string;
  measurementCriteria: any;
  evaluationGames: number;
  gamesEvaluated: number;
  outcome: 'success' | 'partial' | 'failure' | 'unknown' | null;
  measuredDelta: number | null;
  followUpRequired: boolean;
  createdAt: Date;
  evaluatedAt: Date | null;
}

// ============================================================================
// CONCEPT TAXONOMY
// ============================================================================

export function loadConceptTaxonomy(): ChessConcept[] {
  return conceptsData.concepts as ChessConcept[];
}

export function getConceptById(conceptId: string): ChessConcept | undefined {
  return loadConceptTaxonomy().find(c => c.id === conceptId);
}

export function getConceptsByCategory(category: string): ChessConcept[] {
  return loadConceptTaxonomy().filter(c => c.category === category);
}

// ============================================================================
// MASTERY CALCULATION
// ============================================================================

/**
 * Update mastery score based on outcome
 */
export function updateMastery(
  currentMastery: number,
  currentConfidence: number,
  outcome: 'mistake' | 'success'
): { mastery: number; confidence: number } {
  // Learning rate inversely proportional to confidence
  const learningRate = Math.max(0.1, 1 - currentConfidence);
  
  // Delta based on outcome
  const baseDelta = outcome === 'mistake' ? -0.15 : +0.10;
  const adjustedDelta = baseDelta * learningRate;
  
  // Update mastery (clamped to [0, 1])
  const newMastery = Math.max(0, Math.min(1, currentMastery + adjustedDelta));
  
  // Increase confidence (approaches 1 asymptotically)
  const newConfidence = Math.min(1, currentConfidence + 0.05);
  
  return {
    mastery: newMastery,
    confidence: newConfidence
  };
}

/**
 * Calculate when concept should be reviewed next (spaced repetition)
 */
export function calculateDueDate(
  mastery: number,
  lastPracticedAt: Date = new Date()
): Date {
  // Base interval in days
  let baseDays: number;
  
  if (mastery < 0.3) {
    baseDays = 2;  // Very low mastery: review in 2 days
  } else if (mastery < 0.5) {
    baseDays = 3;  // Low mastery: review in 3 days
  } else if (mastery < 0.75) {
    baseDays = 7;  // Medium mastery: review in 1 week
  } else if (mastery < 0.9) {
    baseDays = 14; // High mastery: review in 2 weeks
  } else {
    baseDays = 28; // Very high mastery: review in 4 weeks
  }
  
  // Add jitter (±20% variation)
  const jitter = (Math.random() - 0.5) * baseDays * 0.4;
  const totalDays = baseDays + jitter;
  
  // Calculate due date
  const dueDate = new Date(lastPracticedAt.getTime() + totalDays * 86400000);
  
  return dueDate;
}

/**
 * Calculate teaching priority score for concept selection
 */
export function calculateTeachingPriority(
  state: UserConceptState,
  now: Date = new Date()
): number {
  // Factor 1: Low mastery = higher priority
  const masteryWeight = (1 - state.mastery) * 3;
  
  // Factor 2: Overdue = higher priority
  const daysOverdue = Math.max(0, (now.getTime() - state.spacedRepDueAt.getTime()) / 86400000);
  const overdueWeight = Math.min(2, daysOverdue / 7); // Max 2 points for 1 week overdue
  
  // Factor 3: High confidence = reliable data
  const confidenceWeight = state.confidence * 0.5;
  
  // Factor 4: Recent activity = more relevant
  const daysSinceLastSeen = state.lastSeenAt
    ? (now.getTime() - state.lastSeenAt.getTime()) / 86400000
    : 999;
  const recencyWeight = Math.max(0, 1 - daysSinceLastSeen / 30);
  
  return masteryWeight + overdueWeight + confidenceWeight + recencyWeight;
}

// ============================================================================
// CONCEPT SELECTION
// ============================================================================

/**
 * Select top concepts for coaching focus
 */
export function selectCoachingTargets(
  conceptStates: UserConceptState[],
  maxTargets: number = 3
): Array<{
  conceptId: string;
  name: string;
  mastery: number;
  priority: number;
  reason: string;
  evidence: any[];
}> {
  const now = new Date();
  const concepts = loadConceptTaxonomy();
  
  // Calculate priority for each concept
  const scored = conceptStates.map(state => ({
    state,
    priority: calculateTeachingPriority(state, now)
  }));
  
  // Sort by priority (highest first)
  scored.sort((a, b) => b.priority - a.priority);
  
  // Take top N
  const topStates = scored.slice(0, maxTargets);
  
  // Format results
  return topStates.map(({ state, priority }) => {
    const concept = concepts.find(c => c.id === state.conceptId);
    const evidence = typeof state.evidenceRefs === 'string'
      ? JSON.parse(state.evidenceRefs)
      : state.evidenceRefs;
    
    return {
      conceptId: state.conceptId,
      name: concept?.name || state.conceptId,
      mastery: state.mastery,
      priority,
      reason: generateReasonText(state, evidence, now),
      evidence: evidence.slice(-3) // Last 3 pieces of evidence
    };
  });
}

/**
 * Generate human-readable reason for why concept needs focus
 */
function generateReasonText(
  state: UserConceptState,
  evidence: any[],
  now: Date
): string {
  const daysSinceLastSeen = state.lastSeenAt
    ? (now.getTime() - state.lastSeenAt.getTime()) / 86400000
    : 999;
  
  const recentMistakes = evidence.slice(-3).reduce((sum, e) => sum + (e.mistakes || 0), 0);
  
  const daysOverdue = Math.max(0, (now.getTime() - state.spacedRepDueAt.getTime()) / 86400000);
  
  // Priority: high frequency > low mastery > overdue > recent
  if (recentMistakes >= 3) {
    return `High mistake frequency: ${recentMistakes} in last 3 games`;
  } else if (state.mastery < 0.4) {
    return `Low mastery (${Math.round(state.mastery * 100)}%) - needs focused practice`;
  } else if (daysOverdue > 7) {
    return `Overdue for review by ${Math.round(daysOverdue)} days`;
  } else if (daysSinceLastSeen < 2) {
    return `Recent mistake detected ${Math.round(daysSinceLastSeen)} days ago`;
  } else if (daysOverdue > 0) {
    return `Due for review - last practiced ${Math.round(daysSinceLastSeen)} days ago`;
  } else {
    return `Mastery ${Math.round(state.mastery * 100)}% - room for improvement`;
  }
}

// ============================================================================
// PRACTICE PLAN GENERATION
// ============================================================================

export interface PracticePlan {
  targetConcepts: Array<{
    conceptId: string;
    name: string;
    priority: number;
    reason: string;
    currentMastery: number;
  }>;
  suggestedDrills: string[];
  rationale: string;
}

/**
 * Generate practice plan for user
 */
export function generatePracticePlan(
  conceptStates: UserConceptState[],
  windowDays: number = 7
): PracticePlan {
  const targets = selectCoachingTargets(conceptStates, 5);
  const concepts = loadConceptTaxonomy();
  
  // Handle empty concept states (new user)
  if (targets.length === 0) {
    return {
      targetConcepts: [],
      suggestedDrills: [
        'Play at least 3 games to establish your baseline',
        'Focus on making deliberate moves and thinking through each position',
        'Review your games after playing to identify patterns'
      ],
      rationale: 'Welcome! Play a few games first so we can analyze your play and create a personalized practice plan.'
    };
  }
  
  // Generate drills for each target
  const drills: string[] = [];
  
  for (const target of targets.slice(0, 3)) {
    const concept = concepts.find(c => c.id === target.conceptId);
    if (!concept) continue;
    
    // Category-specific drill suggestions
    if (concept.category === 'tactical') {
      drills.push(`Practice ${target.name.toLowerCase()} puzzles (10-15 problems)`);
    } else if (concept.category === 'opening') {
      drills.push(`Review ${target.name.toLowerCase()} in your recent games`);
    } else if (concept.category === 'endgame') {
      drills.push(`Study ${target.name.toLowerCase()} positions (5-10 examples)`);
    } else if (concept.category === 'positional') {
      drills.push(`Play 2-3 games focusing on ${target.name.toLowerCase()}`);
    } else if (concept.category === 'strategic') {
      drills.push(`Analyze a master game demonstrating ${target.name.toLowerCase()}`);
    }
  }
  
  // Add general drill
  drills.push('Play at least 3 games this week and review them');
  
  // Generate rationale
  const topConcept = targets[0];
  const rationale = `Focus on ${topConcept.name} (mastery: ${Math.round(topConcept.mastery * 100)}%). ${topConcept.reason}. Practice consistently over the next ${windowDays} days.`;
  
  return {
    targetConcepts: targets.map(t => ({
      conceptId: t.conceptId,
      name: t.name,
      priority: Math.round(t.priority * 10) / 10,
      reason: t.reason,
      currentMastery: Math.round(t.mastery * 100) / 100
    })),
    suggestedDrills: drills,
    rationale
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Hash string for intervention deduplication
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Classify game phase based on move number and material
 */
export function classifyGamePhase(moveNumber: number, materialCount: number): 'opening' | 'middlegame' | 'endgame' {
  if (moveNumber <= 10) return 'opening';
  if (materialCount <= 16) return 'endgame'; // Rough heuristic: few pieces left
  return 'middlegame';
}
