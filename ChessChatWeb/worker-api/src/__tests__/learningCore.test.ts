/**
 * Learning Layer V3 - Core Tests
 * 
 * Tests for concept-based mastery calculation and spaced repetition.
 */

import { describe, it, expect } from '@jest/globals';
import {
  updateMastery,
  calculateDueDate,
  calculateTeachingPriority,
  selectCoachingTargets,
  generatePracticePlan,
  hashString,
  classifyGamePhase,
  type UserConceptState
} from '../src/learningCore';

describe('Learning Core - Mastery Updates', () => {
  it('should decrease mastery on mistake', () => {
    const result = updateMastery(0.6, 0.4, 'mistake');
    
    expect(result.mastery).toBeLessThan(0.6);
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.mastery).toBeGreaterThanOrEqual(0);
    expect(result.mastery).toBeLessThanOrEqual(1);
  });
  
  it('should increase mastery on success', () => {
    const result = updateMastery(0.6, 0.4, 'success');
    
    expect(result.mastery).toBeGreaterThan(0.6);
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.mastery).toBeGreaterThanOrEqual(0);
    expect(result.mastery).toBeLessThanOrEqual(1);
  });
  
  it('should update faster when confidence is low', () => {
    const lowConf = updateMastery(0.5, 0.1, 'mistake');
    const highConf = updateMastery(0.5, 0.9, 'mistake');
    
    const lowDelta = Math.abs(0.5 - lowConf.mastery);
    const highDelta = Math.abs(0.5 - highConf.mastery);
    
    expect(lowDelta).toBeGreaterThan(highDelta);
  });
  
  it('should clamp mastery to [0, 1]', () => {
    // Try to push below 0
    const veryLow = updateMastery(0.01, 0.1, 'mistake');
    expect(veryLow.mastery).toBeGreaterThanOrEqual(0);
    
    // Try to push above 1
    const veryHigh = updateMastery(0.99, 0.1, 'success');
    expect(veryHigh.mastery).toBeLessThanOrEqual(1);
  });
  
  it('should increase confidence asymptotically', () => {
    let state = { mastery: 0.5, confidence: 0.0 };
    
    for (let i = 0; i < 20; i++) {
      state = updateMastery(state.mastery, state.confidence, 'success');
    }
    
    expect(state.confidence).toBeGreaterThan(0.8);
    expect(state.confidence).toBeLessThanOrEqual(1.0);
  });
});

describe('Learning Core - Spaced Repetition', () => {
  it('should set shorter interval for low mastery', () => {
    const now = new Date();
    const low = calculateDueDate(0.3, now);
    const high = calculateDueDate(0.9, now);
    
    expect(low.getTime()).toBeLessThan(high.getTime());
  });
  
  it('should return future date', () => {
    const now = new Date();
    const due = calculateDueDate(0.5, now);
    
    expect(due.getTime()).toBeGreaterThan(now.getTime());
  });
  
  it('should increase interval with mastery', () => {
    const now = new Date();
    
    const intervals = [0.2, 0.4, 0.6, 0.8].map(mastery => {
      const due = calculateDueDate(mastery, now);
      return due.getTime() - now.getTime();
    });
    
    // Each interval should be longer than the previous
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
  });
});

describe('Learning Core - Teaching Priority', () => {
  it('should prioritize low mastery concepts', () => {
    const now = new Date();
    const lowMastery: UserConceptState = createMockState({
      mastery: 0.3,
      confidence: 0.5,
      spacedRepDueAt: now
    });
    
    const highMastery: UserConceptState = createMockState({
      mastery: 0.9,
      confidence: 0.5,
      spacedRepDueAt: now
    });
    
    const lowPriority = calculateTeachingPriority(lowMastery, now);
    const highPriority = calculateTeachingPriority(highMastery, now);
    
    expect(lowPriority).toBeGreaterThan(highPriority);
  });
  
  it('should prioritize overdue concepts', () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    
    const overdue: UserConceptState = createMockState({
      mastery: 0.5,
      spacedRepDueAt: weekAgo
    });
    
    const notDue: UserConceptState = createMockState({
      mastery: 0.5,
      spacedRepDueAt: now
    });
    
    const overduePriority = calculateTeachingPriority(overdue, now);
    const notDuePriority = calculateTeachingPriority(notDue, now);
    
    expect(overduePriority).toBeGreaterThan(notDuePriority);
  });
});

describe('Learning Core - Coaching Selection', () => {
  it('should select top N concepts by priority', () => {
    const states: UserConceptState[] = [
      createMockState({ conceptId: 'concept_a', mastery: 0.3 }),
      createMockState({ conceptId: 'concept_b', mastery: 0.8 }),
      createMockState({ conceptId: 'concept_c', mastery: 0.5 }),
      createMockState({ conceptId: 'concept_d', mastery: 0.2 }),
      createMockState({ conceptId: 'concept_e', mastery: 0.9 }),
    ];
    
    const targets = selectCoachingTargets(states, 3);
    
    expect(targets.length).toBe(3);
    
    // Should prioritize low mastery
    expect(targets[0].mastery).toBeLessThanOrEqual(targets[1].mastery);
    expect(targets[1].mastery).toBeLessThanOrEqual(targets[2].mastery);
  });
  
  it('should include reason text', () => {
    const states: UserConceptState[] = [
      createMockState({ conceptId: 'hanging_pieces', mastery: 0.3 })
    ];
    
    const targets = selectCoachingTargets(states, 1);
    
    expect(targets[0].reason).toBeTruthy();
    expect(typeof targets[0].reason).toBe('string');
  });
});

describe('Learning Core - Practice Plan Generation', () => {
  it('should generate plan with target concepts', () => {
    const states: UserConceptState[] = [
      createMockState({ conceptId: 'hanging_pieces', mastery: 0.3 }),
      createMockState({ conceptId: 'tactical_awareness', mastery: 0.5 }),
      createMockState({ conceptId: 'back_rank_mate', mastery: 0.7 })
    ];
    
    const plan = generatePracticePlan(states, 7);
    
    expect(plan.targetConcepts.length).toBeGreaterThan(0);
    expect(plan.suggestedDrills.length).toBeGreaterThan(0);
    expect(plan.rationale).toBeTruthy();
  });
  
  it('should suggest category-appropriate drills', () => {
    const states: UserConceptState[] = [
      createMockState({ conceptId: 'hanging_pieces', mastery: 0.3 })
    ];
    
    const plan = generatePracticePlan(states, 7);
    
    // Should mention puzzles or practice for tactical concepts
    const drillsText = plan.suggestedDrills.join(' ');
    expect(drillsText.toLowerCase()).toContain('practice');
  });
});

describe('Learning Core - Utilities', () => {
  it('should hash strings consistently', () => {
    const str = 'test string';
    const hash1 = hashString(str);
    const hash2 = hashString(str);
    
    expect(hash1).toBe(hash2);
  });
  
  it('should hash different strings differently', () => {
    const hash1 = hashString('string 1');
    const hash2 = hashString('string 2');
    
    expect(hash1).not.toBe(hash2);
  });
  
  it('should classify game phase correctly', () => {
    expect(classifyGamePhase(5, 32)).toBe('opening');
    expect(classifyGamePhase(15, 24)).toBe('middlegame');
    expect(classifyGamePhase(30, 10)).toBe('endgame');
  });
});

// Helper function to create mock UserConceptState
function createMockState(overrides: Partial<UserConceptState> = {}): UserConceptState {
  const now = new Date();
  
  return {
    id: overrides.id || crypto.randomUUID(),
    userId: overrides.userId || 'test_user',
    conceptId: overrides.conceptId || 'test_concept',
    mastery: overrides.mastery ?? 0.5,
    confidence: overrides.confidence ?? 0.5,
    mistakeRateEMA: overrides.mistakeRateEMA ?? 0.0,
    successRateEMA: overrides.successRateEMA ?? 0.0,
    spacedRepDueAt: overrides.spacedRepDueAt || now,
    lastSeenAt: overrides.lastSeenAt || now,
    lastPracticedAt: overrides.lastPracticedAt || now,
    evidenceRefs: overrides.evidenceRefs || [],
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now
  };
}
