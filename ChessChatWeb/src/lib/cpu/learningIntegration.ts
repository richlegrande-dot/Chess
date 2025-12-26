/**
 * Learning Integration for CPU
 * 
 * Connects Wall-E's learned patterns to CPU move selection.
 * This makes Wall-E a teaching coach that adapts to player weaknesses.
 */

import { ChessGame } from '../ChessGame';
import { getProtectedTrainingCore } from '../coaching/protectedTrainingCore';
import { getSignatureEngine } from '../coaching/signatureEngine';
import { MoveBiasContext } from './moveBiasing';

// ============================================================================
// LEARNING INTEGRATION
// ============================================================================

/**
 * Get teaching opportunities for current game state
 * Returns high-confidence patterns that should influence CPU play
 */
export function getTeachingOpportunities(
  position: ChessGame,
  difficultyLevel: number
): MoveBiasContext {
  
  try {
    // Get protected training core
    const trainingCore = getProtectedTrainingCore();
    
    // Only apply learning if we have enough games
    const gamesPlayed = trainingCore.getTotalGamesPlayed();
    
    if (gamesPlayed < 10) {
      // Not enough data yet - no biasing
      return {
        userSignatures: [],
        currentPosition: position,
        difficultyLevel
      };
    }
    
    // Get high-confidence signatures from training
    const signatures = trainingCore.getSignatures();
    const teachableSignatures = signatures.filter(sig => 
      sig.confidenceScore >= 0.7 && 
      sig.masteryScore < 85  // Room for improvement
    );
    
    // Sort by teaching opportunity score
    teachableSignatures.sort((a, b) => {
      const scoreA = calculateTeachingPriority(a, gamesPlayed);
      const scoreB = calculateTeachingPriority(b, gamesPlayed);
      return scoreB - scoreA;
    });
    
    // Take top 3 teaching opportunities
    const topOpportunities = teachableSignatures.slice(0, 3);
    
    if (topOpportunities.length > 0) {
      console.log(
        `[LearningIntegration] Teaching ${topOpportunities.length} patterns: ` +
        topOpportunities.map(s => s.title).join(', ')
      );
    }
    
    return {
      userSignatures: topOpportunities,
      currentPosition: position,
      difficultyLevel
    };
    
  } catch (error) {
    console.error('[LearningIntegration] Error getting teaching opportunities:', error);
    return {
      userSignatures: [],
      currentPosition: position,
      difficultyLevel
    };
  }
}

/**
 * Calculate teaching priority for a signature
 */
function calculateTeachingPriority(
  signature: any,  // MistakeSignature
  totalGames: number
): number {
  // Factor 1: Confidence (must be high)
  const confidenceWeight = signature.confidenceScore * 3;
  
  // Factor 2: Room for improvement (lower mastery = higher priority)
  const improvementRoom = (100 - signature.masteryScore) / 100 * 2;
  
  // Factor 3: Recency (recent patterns are more relevant)
  const daysSinceLastSeen = (Date.now() - signature.lastSeenAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysSinceLastSeen / 30);
  
  // Factor 4: Impact (severe patterns deserve focus)
  const impactScore = Math.min(1, signature.severityWeightedImpact / 5);
  
  return confidenceWeight + improvementRoom + recencyScore + impactScore;
}

/**
 * Check if learning integration is available
 */
export function isLearningAvailable(): boolean {
  try {
    const trainingCore = getProtectedTrainingCore();
    return trainingCore.getTotalGamesPlayed() >= 10;
  } catch {
    return false;
  }
}

/**
 * Get learning statistics for display
 */
export function getLearningStatistics(): {
  available: boolean;
  gamesPlayed: number;
  confirmedPatterns: number;
  teachablePatterns: number;
  readyForTeaching: boolean;
} {
  try {
    const trainingCore = getProtectedTrainingCore();
    const gamesPlayed = trainingCore.getTotalGamesPlayed();
    const signatures = trainingCore.getSignatures();
    
    const confirmedPatterns = signatures.filter(s => s.isConfirmed).length;
    const teachablePatterns = signatures.filter(s => 
      s.confidenceScore >= 0.7 && s.masteryScore < 85
    ).length;
    
    return {
      available: gamesPlayed >= 10,
      gamesPlayed,
      confirmedPatterns,
      teachablePatterns,
      readyForTeaching: teachablePatterns > 0
    };
  } catch {
    return {
      available: false,
      gamesPlayed: 0,
      confirmedPatterns: 0,
      teachablePatterns: 0,
      readyForTeaching: false
    };
  }
}

/**
 * Log learning influence on move selection
 */
export function logLearningInfluence(
  moveStr: string,
  wasInfluenced: boolean,
  reason?: string
): void {
  if (wasInfluenced && reason) {
    console.log(
      `[Wall-E Teaching] 🎓 Chose ${moveStr} to teach: ${reason}`
    );
  }
}
