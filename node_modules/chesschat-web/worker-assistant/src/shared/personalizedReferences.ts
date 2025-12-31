/**
 * Personalized Reference System
 * 
 * Enforces that Wall-E coaching responses include provable references
 * to the user's stored gameplay history.
 * 
 * REQUIREMENT: Every coaching response must include ≥2 personalized references
 * sourced from:
 * - User's last 10 games
 * - User's top 3 mistake patterns
 */

export type PersonalizedReferenceKind = 'last10games' | 'topMistakePattern';

export interface PersonalizedReference {
  kind: PersonalizedReferenceKind;
  text: string;
  source: {
    gameId?: string;
    patternKey?: string;
    gameIds?: string[]; // For aggregated references
  };
}

export interface HistoryEvidence {
  lastGamesUsed: number;
  gameIdsUsed: string[];
  topMistakePatternsUsed: string[];
  personalizedReferenceCount: number;
  insufficientHistory: boolean;
  insufficientReason?: string;
}

export interface PersonalizationContext {
  recentGames: Array<{
    id: string;
    fen?: string;
    moveHistory?: string[];
    result?: string;
    createdAt?: Date;
    mistakes?: Array<{
      type: string;
      move: string;
    }>;
  }>;
  topMistakePatterns: Array<{
    key: string;
    name: string;
    occurrences: number;
    description?: string;
    examples?: string[];
  }>;
}

/**
 * Build personalized references from stored history
 */
export function buildPersonalizedReferences(
  context: PersonalizationContext
): {
  references: PersonalizedReference[];
  evidence: HistoryEvidence;
} {
  const references: PersonalizedReference[] = [];
  const gameIdsUsed: string[] = [];
  const mistakePatternsUsed: string[] = [];

  // Extract references from last 10 games
  const recentGames = context.recentGames.slice(0, 10);
  
  if (recentGames.length > 0) {
    // Aggregate mistake types across recent games
    const mistakeTypeCounts = new Map<string, { count: number; gameIds: string[] }>();
    
    recentGames.forEach(game => {
      if (game.mistakes && game.mistakes.length > 0) {
        game.mistakes.forEach(mistake => {
          const current = mistakeTypeCounts.get(mistake.type) || { count: 0, gameIds: [] };
          current.count++;
          if (!current.gameIds.includes(game.id)) {
            current.gameIds.push(game.id);
          }
          mistakeTypeCounts.set(mistake.type, current);
        });
      }
    });

    // Create reference for recurring mistakes
    const sortedMistakes = Array.from(mistakeTypeCounts.entries())
      .sort((a, b) => b[1].count - a[1].count);

    if (sortedMistakes.length > 0) {
      const [mistakeType, data] = sortedMistakes[0];
      references.push({
        kind: 'last10games',
        text: `In ${data.count} of your last ${recentGames.length} games, you struggled with ${mistakeType.toLowerCase().replace(/_/g, ' ')}.`,
        source: { gameIds: data.gameIds }
      });
      gameIdsUsed.push(...data.gameIds);
    }

    // Create reference for game results
    const results = recentGames
      .filter(g => g.result)
      .map(g => g.result);
    
    if (results.length >= 3) {
      const wins = results.filter(r => r === 'win').length;
      const losses = results.filter(r => r === 'loss').length;
      const draws = results.filter(r => r === 'draw').length;
      
      references.push({
        kind: 'last10games',
        text: `In your last ${results.length} completed games: ${wins} wins, ${losses} losses, ${draws} draws.`,
        source: { gameIds: recentGames.slice(0, results.length).map(g => g.id) }
      });
      gameIdsUsed.push(...recentGames.slice(0, results.length).map(g => g.id));
    }
  }

  // Extract references from top mistake patterns
  const topPatterns = context.topMistakePatterns.slice(0, 3);
  
  topPatterns.forEach((pattern, index) => {
    if (pattern.occurrences > 0) {
      const rank = index === 0 ? '#1' : index === 1 ? '#2' : '#3';
      references.push({
        kind: 'topMistakePattern',
        text: `Your ${rank} recurring mistake pattern is "${pattern.name}" (seen ${pattern.occurrences} times${pattern.description ? `: ${pattern.description}` : ''}).`,
        source: { patternKey: pattern.key }
      });
      mistakePatternsUsed.push(pattern.key);
    }
  });

  // Check if we have sufficient history
  const insufficientHistory = references.length < 2;
  let insufficientReason: string | undefined;

  if (insufficientHistory) {
    const reasons: string[] = [];
    if (recentGames.length < 2) {
      reasons.push(`only ${recentGames.length} game(s) recorded`);
    }
    if (topPatterns.length === 0 || topPatterns.every(p => p.occurrences === 0)) {
      reasons.push('no mistake patterns identified yet');
    }
    insufficientReason = reasons.join(', ');
  }

  const evidence: HistoryEvidence = {
    lastGamesUsed: recentGames.length,
    gameIdsUsed: Array.from(new Set(gameIdsUsed)),
    topMistakePatternsUsed: mistakePatternsUsed,
    personalizedReferenceCount: references.length,
    insufficientHistory,
    insufficientReason
  };

  return { references, evidence };
}

/**
 * Format references into human-readable text
 */
export function formatReferences(references: PersonalizedReference[]): string {
  if (references.length === 0) {
    return '';
  }

  return references.map(ref => ref.text).join(' ');
}

/**
 * Validate that a response meets personalization requirements
 */
export function validatePersonalization(
  response: string,
  evidence: HistoryEvidence
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // If insufficient history, validation passes with explanation
  if (evidence.insufficientHistory) {
    if (!response.includes('history') && !response.includes('game')) {
      errors.push('Response should acknowledge limited history');
    }
    return { valid: errors.length === 0, errors };
  }

  // Otherwise, require ≥2 personalized references
  if (evidence.personalizedReferenceCount < 2) {
    errors.push(`Only ${evidence.personalizedReferenceCount} personalized reference(s) found, need at least 2`);
  }

  // Verify references appear in response text
  const hasGameReference = evidence.lastGamesUsed > 0 && (
    response.includes('last') || 
    response.includes('recent') || 
    response.includes('previous')
  );
  
  const hasPatternReference = evidence.topMistakePatternsUsed.length > 0 && (
    response.includes('pattern') || 
    response.includes('recurring') || 
    response.includes('#1') ||
    response.includes('#2') ||
    response.includes('#3')
  );

  if (!hasGameReference && !hasPatternReference) {
    errors.push('Response does not appear to reference stored history');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Augment a response to include personalized references
 * Use this as a fallback when original response lacks sufficient personalization
 */
export function augmentWithPersonalization(
  baseResponse: string,
  references: PersonalizedReference[],
  evidence: HistoryEvidence
): string {
  if (evidence.insufficientHistory) {
    const reason = evidence.insufficientReason || 'limited gameplay history';
    return `${baseResponse}\n\n*Note: I currently have ${reason}, so my coaching is based on general chess principles. Play more games so I can provide increasingly personalized advice!*`;
  }

  if (references.length === 0) {
    return baseResponse;
  }

  // Add personalized context section
  const personalizedContext = formatReferences(references);
  
  // Insert personalization early in response
  const lines = baseResponse.split('\n');
  const insertIndex = Math.min(2, lines.length);
  
  lines.splice(insertIndex, 0, '', `**Based on your history:** ${personalizedContext}`, '');
  
  return lines.join('\n');
}
