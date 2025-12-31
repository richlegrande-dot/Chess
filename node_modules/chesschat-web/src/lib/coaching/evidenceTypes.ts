/**
 * Evidence-Based Coaching Report Types
 * 
 * Standardized coaching output format that enforces evidence-based advice.
 * Every significant claim must be backed by concrete move/position references.
 */

export interface EvidenceRef {
  type: 'move' | 'position' | 'pattern' | 'metric';
  moveNumber?: number;
  fen?: string;
  patternId?: string;
  value?: number | string;
  description?: string;
}

export interface CoachingMistake {
  key: string;
  title: string;
  severity: number; // 0-1, where 1 = critical
  evidence: EvidenceRef[];
  advice: string;
  category: 'opening' | 'middlegame' | 'endgame' | 'tactical' | 'positional';
}

export interface CoachingStrength {
  key: string;
  title: string;
  evidence: EvidenceRef[];
  description: string;
}

export interface CoachingFocus {
  key: string;
  title: string;
  drill: string;
  expectedOutcome: string;
  priority: number; // Higher = more important
}

export interface CoachingMilestone {
  kind: 'pattern_detected' | 'pattern_confirmed' | 'pattern_reliable' | 'concept_mastered';
  text: string;
  conceptKey: string;
  progress?: number; // 0-1
}

export interface EvidenceBasedCoachingReport {
  summary: string;
  topMistakes: CoachingMistake[];
  strengths: CoachingStrength[];
  nextFocus: CoachingFocus[];
  milestones: CoachingMilestone[];
  generalTips: string[]; // For advice without specific evidence
  metadata: {
    analyzedMoves: number;
    engine: 'local' | 'server';
    engineVersion: string;
    generatedAt: number;
    computeDuration: number;
  };
}

/**
 * Validate that a coaching report meets evidence requirements
 */
export function validateCoachingReport(report: EvidenceBasedCoachingReport): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check top mistakes have evidence
  report.topMistakes.forEach((mistake, idx) => {
    if (mistake.evidence.length === 0) {
      issues.push(`Mistake #${idx + 1} "${mistake.title}" has no evidence`);
    }
    if (!mistake.advice || mistake.advice.length < 10) {
      issues.push(`Mistake #${idx + 1} "${mistake.title}" has insufficient advice`);
    }
  });
  
  // Check strengths have evidence
  report.strengths.forEach((strength, idx) => {
    if (strength.evidence.length === 0) {
      issues.push(`Strength #${idx + 1} "${strength.title}" has no evidence`);
    }
  });
  
  // Check next focus items are actionable
  report.nextFocus.forEach((focus, idx) => {
    if (!focus.drill || focus.drill.length < 10) {
      issues.push(`Focus #${idx + 1} "${focus.title}" has no actionable drill`);
    }
    if (!focus.expectedOutcome) {
      issues.push(`Focus #${idx + 1} "${focus.title}" has no expected outcome`);
    }
  });
  
  // Check metadata is complete
  if (!report.metadata.analyzedMoves) {
    issues.push('Metadata missing analyzedMoves count');
  }
  if (!report.metadata.engine) {
    issues.push('Metadata missing engine type');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Create an evidence reference from a move
 */
export function createMoveEvidence(
  moveNumber: number,
  fen: string,
  description?: string
): EvidenceRef {
  return {
    type: 'move',
    moveNumber,
    fen,
    description
  };
}

/**
 * Create an evidence reference from a pattern
 */
export function createPatternEvidence(
  patternId: string,
  description: string
): EvidenceRef {
  return {
    type: 'pattern',
    patternId,
    description
  };
}

/**
 * Create an evidence reference from a metric
 */
export function createMetricEvidence(
  value: number | string,
  description: string
): EvidenceRef {
  return {
    type: 'metric',
    value,
    description
  };
}

/**
 * Downgrade advice to general tip if evidence is missing
 */
export function downgradeToGeneralTip(
  originalAdvice: string,
  reason: string
): string {
  return `${originalAdvice} (Note: This is a general guideline as specific evidence was not available - ${reason})`;
}
