/**
 * Learning Ingestion - Update Concept States from Game Analysis
 * 
 * Implements closed-loop learning by updating user concept mastery based on game outcomes.
 */

import type { PrismaClient } from '@prisma/client/edge';
import type { MistakeEvent } from './learningCore';
import {
  updateMastery,
  calculateDueDate,
  loadConceptTaxonomy,
  hashString
} from './learningCore';

// ============================================================================
// TYPES
// ============================================================================

export interface GameIngestionResult {
  conceptsUpdated: string[];
  summary: {
    [conceptId: string]: {
      mastery: number;
      delta: number;
      mistakeCount: number;
    };
  };
  nextDueConcepts: string[];
}

export interface InterventionEvaluation {
  interventionId: string;
  outcome: 'success' | 'partial' | 'failure';
  measuredDelta: number;
  followUpCreated: boolean;
}

// ============================================================================
// GAME INGESTION
// ============================================================================

/**
 * Ingest game analysis and update concept states
 */
export async function ingestGame(
  prisma: any,
  userId: string,
  gameId: string,
  mistakes: MistakeEvent[]
): Promise<GameIngestionResult> {
  const conceptCounts: { [conceptId: string]: { mistakes: number; total: number } } = {};
  
  // Count concept occurrences in mistakes
  for (const mistake of mistakes) {
    for (const conceptId of mistake.concepts) {
      if (!conceptCounts[conceptId]) {
        conceptCounts[conceptId] = { mistakes: 1, total: 1 };
      } else {
        conceptCounts[conceptId].mistakes += 1;
        conceptCounts[conceptId].total += 1;
      }
    }
  }
  
  const summary: any = {};
  
  // Update each concept state
  for (const [conceptId, counts] of Object.entries(conceptCounts)) {
    const state = await prisma.userConceptState.findUnique({
      where: {
        userId_conceptId: {
          userId,
          conceptId
        }
      }
    });
    
    if (!state) {
      // Create new concept state
      const initialMastery = 0.5;
      const newState = await prisma.userConceptState.create({
        data: {
          userId,
          conceptId,
          mastery: initialMastery,
          confidence: 0.05, // Low confidence initially
          mistakeRateEMA: counts.mistakes,
          successRateEMA: 0,
          spacedRepDueAt: calculateDueDate(initialMastery),
          lastSeenAt: new Date(),
          evidenceRefs: JSON.stringify([
            {
              gameId,
              mistakes: counts.mistakes,
              timestamp: new Date().toISOString()
            }
          ])
        }
      });
      
      summary[conceptId] = {
        mastery: initialMastery,
        delta: 0,
        mistakeCount: counts.mistakes
      };
      
      // Log event
      await logLearningEvent(prisma, userId, 'CONCEPT_UPDATED', {
        conceptId,
        action: 'created',
        mastery: initialMastery,
        mistakes: counts.mistakes,
        gameId
      });
      
    } else {
      // Update existing concept state
      const outcome = counts.mistakes > 0 ? 'mistake' : 'success';
      const { mastery, confidence } = updateMastery(
        state.mastery,
        state.confidence,
        outcome
      );
      
      // Update EMA for mistake rate
      const alpha = 0.2; // EMA smoothing factor
      const newMistakeEMA = state.mistakeRateEMA * (1 - alpha) + counts.mistakes * alpha;
      
      // Calculate new due date
      const newDueAt = calculateDueDate(mastery, new Date());
      
      // Update evidence refs (keep last 10)
      const evidence = JSON.parse(state.evidenceRefs || '[]');
      evidence.push({
        gameId,
        mistakes: counts.mistakes,
        timestamp: new Date().toISOString()
      });
      const newEvidence = evidence.slice(-10);
      
      // Update in database
      const updated = await prisma.userConceptState.update({
        where: { id: state.id },
        data: {
          mastery,
          confidence,
          mistakeRateEMA: newMistakeEMA,
          spacedRepDueAt: newDueAt,
          lastSeenAt: new Date(),
          evidenceRefs: JSON.stringify(newEvidence),
          updatedAt: new Date()
        }
      });
      
      summary[conceptId] = {
        mastery,
        delta: mastery - state.mastery,
        mistakeCount: counts.mistakes
      };
      
      // Log event
      await logLearningEvent(prisma, userId, 'CONCEPT_UPDATED', {
        conceptId,
        action: 'updated',
        oldMastery: state.mastery,
        newMastery: mastery,
        delta: mastery - state.mastery,
        mistakes: counts.mistakes,
        gameId
      });
    }
  }
  
  // Get next due concepts
  const dueStates = await prisma.userConceptState.findMany({
    where: {
      userId,
      spacedRepDueAt: { lte: new Date() }
    },
    select: { conceptId: true },
    take: 5,
    orderBy: { spacedRepDueAt: 'asc' }
  });
  
  return {
    conceptsUpdated: Object.keys(conceptCounts),
    summary,
    nextDueConcepts: dueStates.map((s: any) => s.conceptId)
  };
}

// ============================================================================
// INTERVENTION EVALUATION
// ============================================================================

/**
 * Evaluate pending interventions after game
 */
export async function evaluateInterventions(
  prisma: any,
  userId: string,
  gameId: string
): Promise<InterventionEvaluation[]> {
  // Find active interventions
  const interventions = await prisma.adviceIntervention.findMany({
    where: {
      userId,
      outcome: null,
      gamesEvaluated: { lt: prisma.adviceIntervention.fields.evaluationGames || 5 }
    }
  });
  
  const results: InterventionEvaluation[] = [];
  
  for (const intervention of interventions) {
    const newCount = intervention.gamesEvaluated + 1;
    
    if (newCount >= intervention.evaluationGames) {
      // Evaluation window complete - measure outcome
      const evaluation = await measureInterventionOutcome(
        prisma,
        intervention,
        userId
      );
      
      // Update intervention
      await prisma.adviceIntervention.update({
        where: { id: intervention.id },
        data: {
          gamesEvaluated: newCount,
          outcome: evaluation.outcome,
          measuredDelta: evaluation.delta,
          followUpRequired: evaluation.outcome === 'failure',
          evaluatedAt: new Date()
        }
      });
      
      // Log event
      await logLearningEvent(prisma, userId, 'ADVICE_EVALUATED', {
        interventionId: intervention.id,
        outcome: evaluation.outcome,
        delta: evaluation.delta,
        concepts: JSON.parse(intervention.conceptsTargeted)
      });
      
      // Create follow-up if needed
      let followUpCreated = false;
      if (evaluation.outcome === 'failure') {
        await createFollowUpIntervention(prisma, userId, intervention);
        followUpCreated = true;
      }
      
      results.push({
        interventionId: intervention.id,
        outcome: evaluation.outcome,
        measuredDelta: evaluation.delta,
        followUpCreated
      });
      
    } else {
      // Still in evaluation window
      await prisma.adviceIntervention.update({
        where: { id: intervention.id },
        data: { gamesEvaluated: newCount }
      });
    }
  }
  
  return results;
}

/**
 * Measure intervention outcome by comparing baseline to actual
 */
async function measureInterventionOutcome(
  prisma: any,
  intervention: any,
  userId: string
): Promise<{ outcome: 'success' | 'partial' | 'failure'; delta: number }> {
  const criteria = JSON.parse(intervention.measurementCriteria);
  const concepts = JSON.parse(intervention.conceptsTargeted);
  
  // Get games since intervention
  const games = await prisma.gameRecord.findMany({
    where: {
      createdAt: { gte: intervention.createdAt }
    },
    take: intervention.evaluationGames,
    orderBy: { createdAt: 'asc' },
    include: {
      GameAnalysis: true
    }
  });
  
  // Count mistakes for target concepts
  let totalMistakes = 0;
  let gamesAnalyzed = 0;
  
  for (const game of games) {
    if (!game.GameAnalysis?.mistakes) continue;
    
    const mistakes = JSON.parse(game.GameAnalysis.mistakes);
    const relevantMistakes = mistakes.filter((m: any) =>
      m.concepts.some((c: string) => concepts.includes(c))
    );
    
    totalMistakes += relevantMistakes.length;
    gamesAnalyzed++;
  }
  
  const actualRate = gamesAnalyzed > 0 ? totalMistakes / gamesAnalyzed : criteria.baseline;
  const delta = criteria.baseline - actualRate;
  
  // Determine outcome
  let outcome: 'success' | 'partial' | 'failure';
  
  if (actualRate <= criteria.target) {
    outcome = 'success';
  } else if (delta > 0) {
    outcome = 'partial'; // Some improvement but didn't reach target
  } else {
    outcome = 'failure'; // No improvement or got worse
  }
  
  return { outcome, delta };
}

/**
 * Create follow-up intervention when initial advice fails
 */
async function createFollowUpIntervention(
  prisma: any,
  userId: string,
  originalIntervention: any
): Promise<void> {
  const concepts = JSON.parse(originalIntervention.conceptsTargeted);
  const criteria = JSON.parse(originalIntervention.measurementCriteria);
  
  // Create new intervention with adjusted approach
  await prisma.adviceIntervention.create({
    data: {
      userId,
      gameId: null,
      conceptsTargeted: JSON.stringify(concepts),
      adviceText: `Follow-up: ${originalIntervention.adviceText.slice(0, 150)}`,
      messageHash: hashString(`followup_${originalIntervention.id}_${Date.now()}`),
      expectedBehavior: `Continued improvement on ${concepts.join(', ')}`,
      measurementCriteria: JSON.stringify({
        ...criteria,
        target: criteria.target * 1.3, // More lenient target
        baseline: criteria.baseline
      }),
      evaluationGames: 5
    }
  });
  
  console.log(
    `[Learning] Created follow-up intervention for concepts: ${concepts.join(', ')}`
  );
}

// ============================================================================
// ADVICE CREATION
// ============================================================================

/**
 * Create advice intervention record
 */
export async function createAdviceIntervention(
  prisma: any,
  userId: string,
  gameId: string | null,
  conceptsTargeted: string[],
  adviceText: string,
  baselineMistakeRate: number
): Promise<string> {
  const intervention = await prisma.adviceIntervention.create({
    data: {
      userId,
      gameId,
      conceptsTargeted: JSON.stringify(conceptsTargeted),
      adviceText: adviceText.slice(0, 500), // Limit length
      messageHash: hashString(adviceText),
      expectedBehavior: `Reduce ${conceptsTargeted[0]} mistakes`,
      measurementCriteria: JSON.stringify({
        metric: `${conceptsTargeted[0]}_per_game`,
        baseline: baselineMistakeRate,
        target: baselineMistakeRate * 0.5 // Aim for 50% reduction
      }),
      evaluationGames: 5
    }
  });
  
  // Log event
  await logLearningEvent(prisma, userId, 'ADVICE_ISSUED', {
    interventionId: intervention.id,
    concepts: conceptsTargeted,
    gameId
  });
  
  return intervention.id;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log learning system event
 */
async function logLearningEvent(
  prisma: any,
  userId: string | null,
  eventType: string,
  payload: any
): Promise<void> {
  try {
    await prisma.learningEvent.create({
      data: {
        userId,
        eventType,
        payload: JSON.stringify(payload)
      }
    });
  } catch (error) {
    console.error('[Learning] Failed to log event:', error);
  }
}
