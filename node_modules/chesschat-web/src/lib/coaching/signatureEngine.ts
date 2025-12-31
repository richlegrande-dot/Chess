/**
 * Signature Clustering + Mastery Tracking
 * Maps mistake events to stable signatures, tracks mastery with decay
 * 
 * Phase 3 of Enhanced Learning System
 * Updated for 50-Game Learning Transformation with confidence scoring
 */

import {
  MistakeEvent,
  MistakeSignature,
  MasteryUpdate,
  MistakeCategory,
  DecisionContext,
} from './types';
import {
  updateConfidenceScore,
  calculatePredictionReliability,
  calculateSeverityWeightedImpact,
  detectImprovementTrend,
  updateTypicalContexts,
  calculateConfidenceFlags,
  calculateTeachingOpportunityScore,
  detectMilestone,
  LearningMilestone
} from './confidenceScorer';

/**
 * Generate stable signature ID from category + motif/principle
 */
function generateSignatureId(category: MistakeCategory, key: string): string {
  return `${category}__${key}`;
}

/**
 * Extract signature key from event
 */
function extractSignatureKey(event: MistakeEvent): string {
  // Prefer motif, fallback to principle, then category
  return event.motif || event.principle || event.category;
}

/**
 * Calculate exponential moving average for mastery
 * alpha = 0.1 (weight for new observation)
 */
function updateMasteryEMA(
  currentScore: number,
  newObservation: number,
  alpha: number = 0.1
): number {
  return currentScore * (1 - alpha) + newObservation * alpha;
}

/**
 * Apply time decay to mastery score
 * Decay rate: 0.95 per day if not practiced
 */
function applyTimeDecay(
  score: number,
  lastSeenAt: number,
  now: number,
  decayRate: number = 0.95
): number {
  const daysSinceLastSeen = (now - lastSeenAt) / (1000 * 60 * 60 * 24);
  if (daysSinceLastSeen < 1) return score;
  
  // Apply exponential decay
  return score * Math.pow(decayRate, daysSinceLastSeen);
}

/**
 * Generate human-readable title from signature key
 */
function generateTitle(category: MistakeCategory, key: string): string {
  const titleMap: Record<string, string> = {
    'fork': 'Missing Fork Opportunities',
    'pin': 'Overlooking Pin Tactics',
    'skewer': 'Missing Skewer Patterns',
    'hung-piece': 'Leaving Pieces Hanging',
    'back-rank-weakness': 'Back Rank Vulnerabilities',
    'mate-threat': 'Missing Mate Threats',
    'control-center': 'Weak Center Control',
    'castle-early': 'Delayed Castling',
    'develop-pieces': 'Slow Development',
    'maintain-pawn-structure': 'Pawn Structure Weaknesses',
    'time-management': 'Time Management Issues',
  };
  
  return titleMap[key] || `${category} - ${key}`;
}

/**
 * Generate description from signature
 */
function generateDescription(category: MistakeCategory, key: string, occurrences: number): string {
  const descMap: Record<string, string> = {
    'fork': 'You sometimes miss opportunities to attack two pieces at once with a fork.',
    'pin': 'Work on recognizing when enemy pieces can be pinned to more valuable pieces.',
    'hung-piece': 'Practice checking for undefended pieces before moving.',
    'castle-early': 'Remember to castle early to protect your king.',
    'control-center': 'Focus on controlling the center squares with pawns and pieces.',
  };
  
  const base = descMap[key] || `Recurring pattern in ${category}.`;
  return `${base} (${occurrences} occurrence${occurrences > 1 ? 's' : ''})`;
}

/**
 * Recommend drills based on signature
 */
function recommendDrills(key: string): string[] {
  const drillMap: Record<string, string[]> = {
    'fork': ['knight-fork-puzzles', 'tactical-vision-training'],
    'pin': ['pin-tactics-puzzles', 'pattern-recognition-pins'],
    'hung-piece': ['hanging-piece-detection', 'move-safety-check'],
    'castle-early': ['opening-principles', 'king-safety-drills'],
    'control-center': ['center-control-exercises', 'pawn-structure-basics'],
    'time-management': ['blitz-practice', 'move-time-awareness'],
  };
  
  return drillMap[key] || ['tactical-puzzles', 'position-analysis'];
}

/**
 * Signature Engine
 * Manages mistake signatures and mastery tracking
 */
export class SignatureEngine {
  private signatures: Map<string, MistakeSignature> = new Map();
  
  constructor(existingSignatures?: MistakeSignature[]) {
    if (existingSignatures) {
      existingSignatures.forEach(sig => {
        this.signatures.set(sig.signatureId, sig);
      });
    }
  }

  /**
   * Process a mistake event and update signatures
   * Returns mastery updates for debugging
   */
  processEvent(
    event: MistakeEvent,
    wasSuccess: boolean = false,
    gameIndex: number = 0,
    context?: DecisionContext
  ): MasteryUpdate[] {
    const updates: MasteryUpdate[] = [];
    const key = extractSignatureKey(event);
    const signatureId = generateSignatureId(event.category, key);
    
    let signature = this.signatures.get(signatureId);
    const now = Date.now();
    const previousConfidence = signature?.confidenceScore || 0;
    
    if (!signature) {
      // Create new signature with enhanced fields
      signature = {
        signatureId,
        category: event.category,
        title: generateTitle(event.category, key),
        description: generateDescription(event.category, key, 1),
        occurrences: 0,
        lastSeenAt: now,
        firstSeenAt: now,
        masteryScore: 50, // Start at neutral
        successRate: 0,
        decayRate: 0.95,
        exampleRefs: [],
        relatedPrinciples: event.principle ? [event.principle] : [],
        recommendedDrills: recommendDrills(key),
        
        // NEW - 50-Game Learning System fields
        confidenceScore: 0,
        firstSeenGameIndex: gameIndex,
        lastSeenGameIndex: gameIndex,
        severityWeightedImpact: 0,
        improvementTrend: 'stable',
        typicalContexts: context ? [context] : [],
        predictionReliability: 0,
        isConfirmed: false,
        isStable: false,
        isHighConfidence: false
      };
      this.signatures.set(signatureId, signature);
    }
    
    // Apply time decay before update
    const previousScore = signature.masteryScore;
    if (signature.lastSeenAt) {
      signature.masteryScore = applyTimeDecay(
        signature.masteryScore,
        signature.lastSeenAt,
        now,
        signature.decayRate
      );
      
      if (Math.abs(signature.masteryScore - previousScore) > 0.01) {
        updates.push({
          signatureId,
          previousScore,
          newScore: signature.masteryScore,
          delta: signature.masteryScore - previousScore,
          reason: 'Time decay applied',
          timestamp: now,
        });
      }
    }
    
    // Update occurrence tracking
    signature.occurrences++;
    signature.lastSeenAt = now;
    signature.lastSeenGameIndex = gameIndex;
    
    // Update example refs with enhanced data
    signature.exampleRefs.push({
      gameId: event.gameId,
      moveNumber: event.moveNumber,
      fen: event.fen,
      move: event.playedMoveSAN
    });
    
    // Keep last 10 examples
    if (signature.exampleRefs.length > 10) {
      signature.exampleRefs = signature.exampleRefs.slice(-10);
    }
    
    // Update mastery score with EMA (existing logic)
    const preUpdateScore = signature.masteryScore;
    const observation = wasSuccess ? 100 : 0; // Binary: success or mistake
    signature.masteryScore = updateMasteryEMA(signature.masteryScore, observation);
    
    // Clamp to 0-100
    signature.masteryScore = Math.max(0, Math.min(100, signature.masteryScore));
    
    updates.push({
      signatureId,
      previousScore: preUpdateScore,
      newScore: signature.masteryScore,
      delta: signature.masteryScore - preUpdateScore,
      reason: wasSuccess ? 'Successfully avoided mistake' : 'Mistake occurred',
      timestamp: now,
    });
    
    // Update success rate
    const successCount = wasSuccess ? 1 : 0;
    const totalCount = signature.occurrences;
    signature.successRate = ((signature.successRate * (totalCount - 1)) + successCount) / totalCount;
    
    // NEW - Update confidence score using advanced algorithm
    signature.confidenceScore = updateConfidenceScore(signature, !wasSuccess);
    
    // NEW - Update context clustering
    if (context) {
      signature.typicalContexts = updateTypicalContexts(
        signature.typicalContexts,
        context
      );
    }
    
    // NEW - Calculate severity weighted impact
    const severityMap: Record<string, number> = {
      'inaccuracy': 1,
      'mistake': 2,
      'blunder': 3
    };
    const severity = severityMap[event.severity] || 1;
    const totalSeverity = signature.severityWeightedImpact * (signature.occurrences - 1) + severity;
    signature.severityWeightedImpact = totalSeverity / signature.occurrences;
    
    // NEW - Update prediction reliability
    signature.predictionReliability = calculatePredictionReliability(signature);
    
    // NEW - Detect improvement trend (need game indices)
    // This would require tracking all game indices where signature occurred
    // For now, we'll update this in a separate method
    
    // NEW - Update confidence flags
    const flags = calculateConfidenceFlags(signature);
    signature.isConfirmed = flags.isConfirmed;
    signature.isStable = flags.isStable;
    signature.isHighConfidence = flags.isHighConfidence;
    
    // Update description with new occurrence count
    signature.description = generateDescription(signature.category, key, signature.occurrences);
    
    // Check for milestone crossing
    const milestone = detectMilestone(signature, previousConfidence, gameIndex);
    if (milestone) {
      console.log(`[SignatureEngine] 🎯 Milestone: ${milestone.title} - ${milestone.description}`);
    }
    
    return updates;
  }

  /**
   * Get all signatures sorted by priority
   * Priority = occurrences * severity * recency
   */
  getSortedSignatures(): MistakeSignature[] {
    const now = Date.now();
    const signatures = Array.from(this.signatures.values());
    
    // Calculate priority score
    const withScores = signatures.map(sig => {
      const recencyDays = (now - sig.lastSeenAt) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-recencyDays / 7); // Decay over 7 days
      const masteryFactor = (100 - sig.masteryScore) / 100; // Lower mastery = higher priority
      const priority = sig.occurrences * masteryFactor * recencyFactor;
      
      return { signature: sig, priority };
    });
    
    // Sort by priority descending
    withScores.sort((a, b) => b.priority - a.priority);
    
    return withScores.map(item => item.signature);
  }

  /**
   * Get signatures that need immediate focus
   * Criteria: low mastery + recent occurrences
   */
  getHighPrioritySignatures(limit: number = 3): MistakeSignature[] {
    const sorted = this.getSortedSignatures();
    return sorted.slice(0, limit).filter(sig => sig.masteryScore < 70);
  }
  
  /**
   * Get signatures suitable for teaching (high confidence, room to improve)
   * These are the patterns Wall-E should use to adapt gameplay
   */
  getTeachingOpportunities(limit: number = 5): MistakeSignature[] {
    const signatures = Array.from(this.signatures.values());
    
    // Score each for teaching potential
    const withScores = signatures
      .map(sig => ({
        signature: sig,
        teachingScore: calculateTeachingOpportunityScore(sig)
      }))
      .filter(item => item.teachingScore > 0);
    
    // Sort by teaching score
    withScores.sort((a, b) => b.teachingScore - a.teachingScore);
    
    return withScores.slice(0, limit).map(item => item.signature);
  }
  
  /**
   * Get high-confidence signatures (confidence >= threshold)
   */
  getHighConfidenceSignatures(threshold: number = 0.7): MistakeSignature[] {
    return Array.from(this.signatures.values())
      .filter(sig => sig.confidenceScore >= threshold)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Get signatures that are nearly mastered
   * Criteria: high mastery + low recent occurrence
   */
  getMasteredSignatures(): MistakeSignature[] {
    const now = Date.now();
    return Array.from(this.signatures.values())
      .filter(sig => {
        const daysSinceLastSeen = (now - sig.lastSeenAt) / (1000 * 60 * 60 * 24);
        return sig.masteryScore >= 80 && daysSinceLastSeen > 7;
      });
  }

  /**
   * Get all signatures as array
   */
  getAllSignatures(): MistakeSignature[] {
    return Array.from(this.signatures.values());
  }

  /**
   * Get signature by ID
   */
  getSignature(signatureId: string): MistakeSignature | undefined {
    return this.signatures.get(signatureId);
  }

  /**
   * Clear all signatures (for testing)
   */
  clear(): void {
    this.signatures.clear();
  }
}

// Singleton instance
let signatureEngineInstance: SignatureEngine | null = null;

export function getSignatureEngine(existingSignatures?: MistakeSignature[]): SignatureEngine {
  if (!signatureEngineInstance) {
    signatureEngineInstance = new SignatureEngine(existingSignatures);
  }
  return signatureEngineInstance;
}

/**
 * Reset singleton (for testing or when loading new data)
 */
export function resetSignatureEngine(): void {
  signatureEngineInstance = null;
}
