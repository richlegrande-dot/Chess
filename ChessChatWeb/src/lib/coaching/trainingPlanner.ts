/**
 * Spaced Repetition Training Planner
 * Generates coaching plans with rotation and focus management
 * 
 * Phase 4 of Enhanced Learning System
 */

import {
  MistakeSignature,
  EnhancedCoachingPlan,
  TrainingRecommendation,
  MistakeCategory,
} from './types';

/**
 * Calculate priority score for a signature
 * Higher score = more urgent to address
 */
function calculatePriority(signature: MistakeSignature, now: number): number {
  const daysSinceLastSeen = (now - signature.lastSeenAt) / (1000 * 60 * 60 * 24);
  
  // Factors:
  // 1. Low mastery = high priority
  const masteryFactor = (100 - signature.masteryScore) / 100;
  
  // 2. Recent occurrence = high priority
  const recencyFactor = Math.exp(-daysSinceLastSeen / 7); // Decay over 7 days
  
  // 3. High occurrence count = high priority
  const frequencyFactor = Math.log(1 + signature.occurrences);
  
  // 4. Low success rate = high priority
  const successFactor = 1 - signature.successRate;
  
  return (masteryFactor * 0.4 + recencyFactor * 0.3 + frequencyFactor * 0.2 + successFactor * 0.1) * 10;
}

/**
 * Generate training recommendations from signature
 */
function generateRecommendations(
  signature: MistakeSignature,
  priority: number
): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];
  
  // Category-specific exercises
  const categoryExercises: Record<MistakeCategory, TrainingRecommendation> = {
    'tactics': {
      type: 'puzzle',
      title: `${signature.title} - Tactical Puzzles`,
      description: `Solve 5-10 puzzles focusing on ${signature.title.toLowerCase()}.`,
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 15,
      category: 'tactics',
    },
    'strategy': {
      type: 'analysis',
      title: `${signature.title} - Strategic Analysis`,
      description: `Review master games emphasizing ${signature.title.toLowerCase()}.`,
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 20,
      category: 'strategy',
    },
    'opening': {
      type: 'drill',
      title: `${signature.title} - Opening Review`,
      description: `Study opening principles and common mistakes in early game.`,
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 15,
      category: 'opening',
    },
    'endgame': {
      type: 'drill',
      title: `${signature.title} - Endgame Practice`,
      description: `Practice endgame positions focusing on ${signature.title.toLowerCase()}.`,
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 20,
      category: 'endgame',
    },
    'time': {
      type: 'drill',
      title: 'Time Management Practice',
      description: 'Play blitz games to improve decision-making speed.',
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 10,
      category: 'time',
    },
    'psychology': {
      type: 'analysis',
      title: 'Mental Game Review',
      description: 'Reflect on emotional patterns and decision-making under pressure.',
      relatedSignatures: [signature.signatureId],
      priority,
      estimatedTime: 10,
      category: 'psychology',
    },
  };
  
  recommendations.push(categoryExercises[signature.category]);
  
  // Add drill-specific recommendations
  if (signature.recommendedDrills) {
    signature.recommendedDrills.forEach(drill => {
      recommendations.push({
        type: 'drill',
        title: drill.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: `Practice drill: ${drill}`,
        relatedSignatures: [signature.signatureId],
        priority,
        estimatedTime: 10,
        category: signature.category,
      });
    });
  }
  
  return recommendations;
}

/**
 * Generate objective for next game
 */
function generateNextGameObjective(primaryFocus: MistakeSignature): string {
  const objectives: Record<string, string> = {
    'fork': 'Look for fork opportunities on every move',
    'pin': 'Check for possible pins before moving pieces',
    'hung-piece': 'Always verify piece is defended before moving',
    'castle-early': 'Castle within the first 10 moves',
    'control-center': 'Occupy or control central squares (d4, d5, e4, e5)',
    'time-management': 'Keep moves under 30 seconds except for critical positions',
  };
  
  const key = primaryFocus.signatureId.split('__')[1];
  return objectives[key] || `Focus on improving: ${primaryFocus.title}`;
}

/**
 * Check if focus should be rotated based on spacing rules
 */
function shouldRotateFocus(
  primaryFocus: MistakeSignature,
  lastFocusedAt: number,
  gamesPlayed: number,
  minSpacing: number = 3
): boolean {
  // Rotate if:
  // 1. Played minimum spacing games with this focus
  // 2. OR mastery improved significantly (>10 points)
  return gamesPlayed >= minSpacing;
}

/**
 * Training Planner
 * Generates adaptive coaching plans with spaced repetition
 */
export class TrainingPlanner {
  private currentPlan: EnhancedCoachingPlan | null = null;
  private focusHistory: Array<{ signatureId: string; timestamp: number }> = [];
  
  /**
   * Generate coaching plan from signatures
   */
  generatePlan(signatures: MistakeSignature[]): EnhancedCoachingPlan {
    const now = Date.now();
    
    // Calculate priorities
    const withPriorities = signatures.map(sig => ({
      signature: sig,
      priority: calculatePriority(sig, now),
    }));
    
    // Sort by priority
    withPriorities.sort((a, b) => b.priority - a.priority);
    
    // Select primary focus (highest priority, not recently focused)
    let primaryFocus = withPriorities[0]?.signature;
    
    if (!primaryFocus) {
      // No mistakes yet, return empty plan
      return {
        primaryFocus: {
          signatureId: 'none',
          title: 'Keep playing!',
          description: 'No recurring patterns detected yet.',
          expectedGames: 5,
        },
        secondaryFocuses: [],
        recommendations: [],
        nextGameObjective: 'Play naturally and I will learn your patterns',
        rotationSchedule: [],
        streaks: [],
      };
    }
    
    // Check if we should rotate from previous focus
    const lastFocus = this.focusHistory[this.focusHistory.length - 1];
    if (lastFocus) {
      const gamesSinceLastRotation = this.focusHistory.filter(
        f => f.signatureId === lastFocus.signatureId
      ).length;
      
      if (!shouldRotateFocus(primaryFocus, lastFocus.timestamp, gamesSinceLastRotation)) {
        // Keep previous focus
        const prevSig = signatures.find(s => s.signatureId === lastFocus.signatureId);
        if (prevSig) {
          primaryFocus = prevSig;
        }
      }
    }
    
    // Record focus
    this.focusHistory.push({
      signatureId: primaryFocus.signatureId,
      timestamp: now,
    });
    
    // Keep last 20 focus records
    if (this.focusHistory.length > 20) {
      this.focusHistory = this.focusHistory.slice(-20);
    }
    
    // Select secondary focuses (next 2-3)
    const secondaryFocuses = withPriorities
      .slice(1, 4)
      .filter(item => item.signature.signatureId !== primaryFocus.signatureId)
      .map(item => ({
        signatureId: item.signature.signatureId,
        title: item.signature.title,
        description: item.signature.description,
      }));
    
    // Generate recommendations
    const primaryPriority = withPriorities[0].priority;
    const recommendations = generateRecommendations(primaryFocus, primaryPriority);
    
    // Add recommendations for secondary focuses (lower priority)
    secondaryFocuses.slice(0, 1).forEach(focus => {
      const sig = signatures.find(s => s.signatureId === focus.signatureId);
      if (sig) {
        const secondaryRecs = generateRecommendations(sig, primaryPriority * 0.7);
        recommendations.push(...secondaryRecs.slice(0, 1)); // Add 1 rec per secondary focus
      }
    });
    
    // Sort recommendations by priority
    recommendations.sort((a, b) => b.priority - a.priority);
    
    // Generate rotation schedule (next 5 games)
    const rotationSchedule = withPriorities
      .slice(0, 5)
      .map((item, index) => ({
        game: index + 1,
        focusSignatureId: item.signature.signatureId,
        objective: generateNextGameObjective(item.signature),
      }));
    
    // Track streaks (signatures with 3+ consecutive improvements)
    const streaks = signatures
      .filter(sig => {
        // Check if mastery improved in last 3 occurrences
        return sig.masteryScore > 60 && sig.occurrences >= 3;
      })
      .map(sig => ({
        signatureId: sig.signatureId,
        title: sig.title,
        count: Math.min(sig.occurrences, 5),
        lastUpdate: sig.lastSeenAt,
      }));
    
    const plan: EnhancedCoachingPlan = {
      primaryFocus: {
        signatureId: primaryFocus.signatureId,
        title: primaryFocus.title,
        description: primaryFocus.description,
        expectedGames: 3, // Focus for 3 games before rotating
      },
      secondaryFocuses,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      nextGameObjective: generateNextGameObjective(primaryFocus),
      rotationSchedule,
      streaks,
    };
    
    this.currentPlan = plan;
    return plan;
  }

  /**
   * Get current coaching plan
   */
  getCurrentPlan(): EnhancedCoachingPlan | null {
    return this.currentPlan;
  }

  /**
   * Clear focus history (for testing)
   */
  clear(): void {
    this.currentPlan = null;
    this.focusHistory = [];
  }
}

// Singleton instance
let trainingPlannerInstance: TrainingPlanner | null = null;

export function getTrainingPlanner(): TrainingPlanner {
  if (!trainingPlannerInstance) {
    trainingPlannerInstance = new TrainingPlanner();
  }
  return trainingPlannerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetTrainingPlanner(): void {
  trainingPlannerInstance = null;
}
