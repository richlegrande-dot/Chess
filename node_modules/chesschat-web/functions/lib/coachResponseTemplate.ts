/**
 * Structured Coaching Response Template
 * Ensures consistent, actionable, human-readable coaching
 * 
 * Format:
 * 1. What happened (1-2 lines)
 * 2. Why it matters (1-2 lines)
 * 3. Your pattern (MUST include ≥2 personalized references)
 * 4. One fix for next game (one drill + one rule)
 * 5. Try this now (one actionable move/idea)
 */

import type { PersonalizedReference } from './personalizedReferences';

export interface CoachingAdvice {
  adviceType: 'tactics' | 'strategy' | 'endgame' | 'opening' | 'general';
  referencedPatterns: string[];
  referencedGames: string[];
  recommendedDrill: 'tactical_puzzles' | 'endgame_practice' | 'opening_study' | 'positional_play' | 'calculation_training';
}

export interface StructuredCoachingResponse {
  whatHappened: string;
  whyItMatters: string;
  yourPattern: string; // MUST include personalizedReferences
  oneFix: {
    drill: string;
    rule: string;
  };
  tryThisNow: string;
  advice: CoachingAdvice;
}

/**
 * Build structured coaching response from components
 */
export function buildStructuredResponse(
  situation: string,
  impact: string,
  personalizedRefs: PersonalizedReference[],
  drillSuggestion: string,
  ruleSuggestion: string,
  immediateAction: string,
  advice: CoachingAdvice
): StructuredCoachingResponse {
  // Format personalized references into pattern section
  const patternText = formatPersonalizedPattern(personalizedRefs);

  return {
    whatHappened: situation,
    whyItMatters: impact,
    yourPattern: patternText,
    oneFix: {
      drill: drillSuggestion,
      rule: ruleSuggestion,
    },
    tryThisNow: immediateAction,
    advice,
  };
}

/**
 * Format personalized references into readable pattern description
 */
function formatPersonalizedPattern(refs: PersonalizedReference[]): string {
  if (refs.length === 0) {
    return "I need more games to identify your specific patterns. Keep playing!";
  }

  const lines: string[] = [];
  
  for (const ref of refs) {
    lines.push(ref.text);
  }

  return lines.join(' ');
}

/**
 * Convert structured response to plain text format
 */
export function renderStructuredResponse(response: StructuredCoachingResponse): string {
  return `**What happened:** ${response.whatHappened}

**Why it matters:** ${response.whyItMatters}

**Your pattern:** ${response.yourPattern}

**One fix for next game:**
- Drill: ${response.oneFix.drill}
- Rule: ${response.oneFix.rule}

**Try this now:** ${response.tryThisNow}`;
}

/**
 * Validate structured response has all required components
 */
export function validateStructuredResponse(response: StructuredCoachingResponse): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!response.whatHappened || response.whatHappened.length < 10) {
    errors.push("whatHappened must be at least 10 characters");
  }

  if (!response.whyItMatters || response.whyItMatters.length < 10) {
    errors.push("whyItMatters must be at least 10 characters");
  }

  if (!response.yourPattern || response.yourPattern.length < 20) {
    errors.push("yourPattern must be at least 20 characters");
  }

  if (!response.oneFix.drill || response.oneFix.drill.length < 10) {
    errors.push("oneFix.drill must be at least 10 characters");
  }

  if (!response.oneFix.rule || response.oneFix.rule.length < 10) {
    errors.push("oneFix.rule must be at least 10 characters");
  }

  if (!response.tryThisNow || response.tryThisNow.length < 10) {
    errors.push("tryThisNow must be at least 10 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Runtime guard: throws if response doesn't meet quality bar
 */
export function enforceStructuredResponse(response: StructuredCoachingResponse): void {
  const validation = validateStructuredResponse(response);
  if (!validation.valid) {
    throw new Error(`Structured response validation failed: ${validation.errors.join(', ')}`);
  }
}
