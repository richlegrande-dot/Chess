/**
 * Confidence Scoring System - Test Suite
 * 
 * Tests logarithmic growth, milestone detection, and trend analysis
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBaseConfidence,
  updateConfidenceScore,
  detectMilestone,
  detectImprovementTrend,
  calculateTeachingOpportunityScore
} from '../lib/coaching/confidenceScorer';

describe('Confidence Scoring', () => {
  describe('Base Confidence Calculation', () => {
    it('should grow logarithmically', () => {
      const conf3 = calculateBaseConfidence(3);
      const conf10 = calculateBaseConfidence(10);
      const conf20 = calculateBaseConfidence(20);
      const conf50 = calculateBaseConfidence(50);

      // Should increase but at diminishing rate
      expect(conf10).toBeGreaterThan(conf3);
      expect(conf20).toBeGreaterThan(conf10);
      
      // Growth should slow down
      const growth1 = conf10 - conf3;
      const growth2 = conf20 - conf10;
      expect(growth1).toBeGreaterThan(growth2);

      // Should stabilize around 20 observations
      expect(conf20).toBeGreaterThan(0.9);
      expect(conf50).toBeGreaterThan(conf20);
      expect(conf50 - conf20).toBeLessThan(0.1); // Minimal growth after 20
    });

    it('should return 0 for 0 observations', () => {
      expect(calculateBaseConfidence(0)).toBe(0);
    });

    it('should never exceed 1.0', () => {
      expect(calculateBaseConfidence(100)).toBeLessThanOrEqual(1.0);
      expect(calculateBaseConfidence(1000)).toBeLessThanOrEqual(1.0);
    });

    it('should reach key milestones at expected counts', () => {
      // Pattern detected (~0.4) around 3-5 observations
      expect(calculateBaseConfidence(4)).toBeGreaterThanOrEqual(0.35);
      expect(calculateBaseConfidence(4)).toBeLessThan(0.5);

      // Pattern confirmed (~0.6) around 8-12 observations
      expect(calculateBaseConfidence(10)).toBeGreaterThanOrEqual(0.55);
      expect(calculateBaseConfidence(10)).toBeLessThan(0.7);

      // Pattern stable (~0.8) around 15-20 observations
      expect(calculateBaseConfidence(18)).toBeGreaterThanOrEqual(0.75);
      expect(calculateBaseConfidence(18)).toBeLessThan(0.85);
    });
  });

  describe('Confidence Score Update', () => {
    it('should blend base confidence with EMA', () => {
      const mockSignature = {
        occurrences: 10,
        confidenceScore: 0.5,
        lastSeenGameIndex: 8,
        emaScore: 0.4
      };

      const updated = updateConfidenceScore(mockSignature, 10, 0.2);

      // Should be between base (log formula) and previous confidence
      expect(updated).toBeGreaterThan(0);
      expect(updated).toBeLessThanOrEqual(1.0);
    });

    it('should increase confidence when pattern seen again', () => {
      const mockSignature = {
        occurrences: 5,
        confidenceScore: 0.3,
        lastSeenGameIndex: 3,
        emaScore: 0.25
      };

      const updated = updateConfidenceScore(mockSignature, 5, 0.2);
      
      // Confidence should increase
      expect(updated).toBeGreaterThan(mockSignature.confidenceScore);
    });

    it('should handle first observation correctly', () => {
      const mockSignature = {
        occurrences: 1,
        confidenceScore: 0,
        lastSeenGameIndex: 0,
        emaScore: 0
      };

      const updated = updateConfidenceScore(mockSignature, 1, 0.2);
      
      expect(updated).toBeGreaterThan(0);
      expect(updated).toBeLessThan(0.3); // Low confidence for 1 observation
    });
  });

  describe('Milestone Detection', () => {
    it('should detect pattern_detected milestone at ~0.4 confidence', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.45,
        occurrences: 4,
        category: 'tactical'
      };

      const milestone = detectMilestone(mockSignature, 0.3, 4);

      expect(milestone).toBeTruthy();
      expect(milestone?.type).toBe('pattern_detected');
    });

    it('should detect pattern_confirmed milestone at ~0.6 confidence', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.65,
        occurrences: 10,
        category: 'tactical'
      };

      const milestone = detectMilestone(mockSignature, 0.5, 10);

      expect(milestone).toBeTruthy();
      expect(milestone?.type).toBe('pattern_confirmed');
    });

    it('should detect pattern_stable milestone at ~0.8 confidence', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.82,
        occurrences: 20,
        category: 'tactical'
      };

      const milestone = detectMilestone(mockSignature, 0.7, 20);

      expect(milestone).toBeTruthy();
      expect(milestone?.type).toBe('pattern_stable');
    });

    it('should detect pattern_mastered milestone at ~0.9 confidence', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.92,
        occurrences: 40,
        category: 'tactical'
      };

      const milestone = detectMilestone(mockSignature, 0.85, 40);

      expect(milestone).toBeTruthy();
      expect(milestone?.type).toBe('pattern_mastered');
    });

    it('should not trigger milestone if confidence decreases', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.5,
        occurrences: 8,
        category: 'tactical'
      };

      const milestone = detectMilestone(mockSignature, 0.7, 8);

      expect(milestone).toBeNull();
    });

    it('should not trigger same milestone twice', () => {
      const mockSignature = {
        title: 'Test Pattern',
        confidenceScore: 0.65,
        occurrences: 12,
        category: 'tactical'
      };

      // First crossing
      const milestone1 = detectMilestone(mockSignature, 0.55, 11);
      expect(milestone1?.type).toBe('pattern_confirmed');

      // Stay in same range
      const milestone2 = detectMilestone(mockSignature, 0.64, 12);
      expect(milestone2).toBeNull();
    });
  });

  describe('Improvement Trend Detection', () => {
    it('should detect improving trend', () => {
      const recentGames = [15, 16, 17, 18, 19];
      const olderGames = [5, 6, 7, 8, 9];

      const trend = detectImprovementTrend(recentGames, olderGames, 50);

      expect(trend.trend).toBe('improving');
      expect(trend.recentRate).toBeLessThan(trend.olderRate);
    });

    it('should detect worsening trend', () => {
      const recentGames = [5, 6, 7, 8, 9];
      const olderGames = [15, 16, 17, 18, 19];

      const trend = detectImprovementTrend(recentGames, olderGames, 50);

      expect(trend.trend).toBe('worsening');
      expect(trend.recentRate).toBeGreaterThan(trend.olderRate);
    });

    it('should detect stable trend', () => {
      const recentGames = [10, 11, 12, 13, 14];
      const olderGames = [10, 11, 12, 13, 14];

      const trend = detectImprovementTrend(recentGames, olderGames, 50);

      expect(trend.trend).toBe('stable');
      expect(Math.abs(trend.recentRate - trend.olderRate)).toBeLessThan(0.05);
    });

    it('should handle insufficient data', () => {
      const recentGames = [5];
      const olderGames: number[] = [];

      const trend = detectImprovementTrend(recentGames, olderGames, 10);

      expect(trend.trend).toBe('stable');
    });
  });

  describe('Teaching Opportunity Score', () => {
    it('should score high for recent, high-confidence, low-mastery patterns', () => {
      const mockSignature = {
        confidenceScore: 0.85,
        masteryScore: 30,
        lastSeenAt: Date.now(),
        occurrences: 15,
        severityWeightedImpact: 4.5
      };

      const score = calculateTeachingOpportunityScore(mockSignature);

      // Should be high (7-10)
      expect(score).toBeGreaterThan(7);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should score low for old patterns', () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const mockSignature = {
        confidenceScore: 0.85,
        masteryScore: 30,
        lastSeenAt: thirtyDaysAgo,
        occurrences: 15,
        severityWeightedImpact: 4.5
      };

      const score = calculateTeachingOpportunityScore(mockSignature);

      // Should be significantly lower
      expect(score).toBeLessThan(6);
    });

    it('should score low for high mastery', () => {
      const mockSignature = {
        confidenceScore: 0.85,
        masteryScore: 90, // Already mastered
        lastSeenAt: Date.now(),
        occurrences: 15,
        severityWeightedImpact: 4.5
      };

      const score = calculateTeachingOpportunityScore(mockSignature);

      // Low teaching value for mastered patterns
      expect(score).toBeLessThan(4);
    });

    it('should score low for low confidence', () => {
      const mockSignature = {
        confidenceScore: 0.3, // Uncertain pattern
        masteryScore: 30,
        lastSeenAt: Date.now(),
        occurrences: 3,
        severityWeightedImpact: 4.5
      };

      const score = calculateTeachingOpportunityScore(mockSignature);

      // Not confident enough to teach
      expect(score).toBeLessThan(5);
    });
  });
});
