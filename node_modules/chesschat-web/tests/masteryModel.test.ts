/**
 * Mastery Model Tests
 * 
 * Unit tests for evidence-weighted learning system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as masteryModel from '../src/lib/coaching/masteryModel';

describe('MasteryModel', () => {
  beforeEach(() => {
    masteryModel.clearAllMastery();
  });

  describe('updateMastery', () => {
    it('should initialize mastery for new concepts', () => {
      const result = masteryModel.updateMastery({
        conceptKey: 'tactics-fork',
        wasMistake: true,
        severity: 0.8,
        evidenceId: 'game1-move15',
        timestamp: Date.now()
      });

      expect(result.mastery).toBeLessThan(0.5);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.totalSeen).toBe(1);
      expect(result.evidenceIds).toContain('game1-move15');
    });

    it('should reduce mastery on mistakes', () => {
      const timestamp = Date.now();
      
      // Initial success
      const initial = masteryModel.updateMastery({
        conceptKey: 'endgame-opposition',
        wasMistake: false,
        severity: 0,
        evidenceId: 'game1-move30',
        timestamp
      });

      // Mistake should reduce mastery
      const afterMistake = masteryModel.updateMastery({
        conceptKey: 'endgame-opposition',
        wasMistake: true,
        severity: 0.7,
        evidenceId: 'game2-move35',
        timestamp: timestamp + 1000
      });

      expect(afterMistake.mastery).toBeLessThan(initial.mastery);
      expect(afterMistake.streak).toBe(0);
    });

    it('should increase mastery on successes', () => {
      const timestamp = Date.now();
      
      let current = masteryModel.updateMastery({
        conceptKey: 'opening-development',
        wasMistake: false,
        severity: 0,
        evidenceId: 'game1',
        timestamp
      });

      const initialMastery = current.mastery;

      // Multiple successes should increase mastery
      for (let i = 0; i < 5; i++) {
        current = masteryModel.updateMastery({
          conceptKey: 'opening-development',
          wasMistake: false,
          severity: 0,
          evidenceId: `game${i+2}`,
          timestamp: timestamp + (i + 1) * 1000
        });
      }

      expect(current.mastery).toBeGreaterThan(initialMastery);
      expect(current.streak).toBe(6);
    });

    it('should maintain evidence references with size limit', () => {
      const timestamp = Date.now();
      
      // Add more than max evidence refs
      for (let i = 0; i < 15; i++) {
        masteryModel.updateMastery({
          conceptKey: 'tactics-pin',
          wasMistake: i % 2 === 0,
          severity: 0.5,
          evidenceId: `evidence${i}`,
          timestamp: timestamp + i * 1000
        });
      }

      const final = masteryModel.getMastery('tactics-pin');
      expect(final?.evidenceIds.length).toBeLessThanOrEqual(10);
      expect(final?.evidenceIds[0]).toBe('evidence14'); // Most recent first
    });
  });

  describe('getPracticePriorities', () => {
    it('should prioritize low-mastery high-confidence concepts', () => {
      const timestamp = Date.now();
      
      // Low mastery, high confidence (many mistakes)
      for (let i = 0; i < 5; i++) {
        masteryModel.updateMastery({
          conceptKey: 'priority-high',
          wasMistake: true,
          severity: 0.8,
          evidenceId: `ev${i}`,
          timestamp: timestamp + i * 1000
        });
      }
      
      // High mastery, low confidence (few successes)
      masteryModel.updateMastery({
        conceptKey: 'priority-low',
        wasMistake: false,
        severity: 0,
        evidenceId: 'ev1',
        timestamp
      });

      const priorities = masteryModel.getPracticePriorities();
      expect(priorities.length).toBeGreaterThan(0);
      expect(priorities[0].conceptKey).toBe('priority-high');
    });

    it('should boost overdue concepts', () => {
      const pastTimestamp = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      masteryModel.updateMastery({
        conceptKey: 'overdue-concept',
        wasMistake: false,
        severity: 0,
        evidenceId: 'old',
        timestamp: pastTimestamp
      });

      const priorities = masteryModel.getPracticePriorities();
      const overdue = priorities.find(p => p.conceptKey === 'overdue-concept');
      
      expect(overdue).toBeTruthy();
      expect(overdue?.priority).toBeGreaterThan(0);
    });
  });

  describe('getLearningStats', () => {
    it('should calculate learning statistics correctly', () => {
      const timestamp = Date.now();
      
      // Add mastered concept
      for (let i = 0; i < 10; i++) {
        masteryModel.updateMastery({
          conceptKey: 'mastered',
          wasMistake: false,
          severity: 0,
          evidenceId: `ev${i}`,
          timestamp: timestamp + i * 1000
        });
      }
      
      // Add in-progress concept
      masteryModel.updateMastery({
        conceptKey: 'in-progress',
        wasMistake: false,
        severity: 0,
        evidenceId: 'ev1',
        timestamp
      });
      masteryModel.updateMastery({
        conceptKey: 'in-progress',
        wasMistake: true,
        severity: 0.5,
        evidenceId: 'ev2',
        timestamp: timestamp + 1000
      });

      const stats = masteryModel.getLearningStats();
      
      expect(stats.totalConcepts).toBe(2);
      expect(stats.masteredConcepts).toBeGreaterThanOrEqual(0);
      expect(stats.averageMastery).toBeGreaterThan(0);
      expect(stats.averageMastery).toBeLessThanOrEqual(1);
    });
  });

  describe('applyRecencyDecay', () => {
    it('should reduce confidence for old concepts', () => {
      const oldTimestamp = Date.now() - (60 * 24 * 60 * 60 * 1000); // 60 days ago
      
      const initial = masteryModel.updateMastery({
        conceptKey: 'old-concept',
        wasMistake: false,
        severity: 0,
        evidenceId: 'ev1',
        timestamp: oldTimestamp
      });

      masteryModel.applyRecencyDecay();
      
      const after = masteryModel.getMastery('old-concept');
      expect(after?.confidence).toBeLessThan(initial.confidence);
    });
  });
});
