/**
 * Unit Tests for Adaptive Analysis Tiers
 */

import { describe, it, expect } from 'vitest';
import {
  selectAnalysisTier,
  calculateDynamicPositionLimit,
  estimateStockfishLatency,
  adjustForColdStart,
  TIER_A,
  TIER_B,
  TIER_C
} from '../analysisTiers';

describe('Adaptive Analysis Tiers', () => {
  describe('selectAnalysisTier', () => {
    it('should select Tier A when time budget is low', () => {
      const result = selectAnalysisTier({
        totalMoves: 30,
        stockfishLatencyMs: 100,
        remainingBudgetMs: 1500, // Low budget
        userPriority: 'normal',
        smartSamplingEnabled: true
      });
      
      expect(result.tier.name).toBe('A');
      expect(result.reason).toBe('low-time-budget');
    });
    
    it('should select Tier A when Stockfish is slow', () => {
      const result = selectAnalysisTier({
        totalMoves: 30,
        stockfishLatencyMs: 400, // High latency
        remainingBudgetMs: 5000,
        userPriority: 'normal',
        smartSamplingEnabled: true
      });
      
      expect(result.tier.name).toBe('A');
      expect(result.reason).toBe('stockfish-latency-high');
    });
    
    it('should select Tier C for high priority with optimal conditions', () => {
      const result = selectAnalysisTier({
        totalMoves: 30,
        stockfishLatencyMs: 100, // Good latency
        remainingBudgetMs: 6000, // Good budget
        userPriority: 'high',
        smartSamplingEnabled: true
      });
      
      expect(result.tier.name).toBe('C');
      expect(result.reason).toBe('high-priority-optimal-conditions');
    });
    
    it('should select Tier C for short games with good conditions', () => {
      const result = selectAnalysisTier({
        totalMoves: 15, // Short game
        stockfishLatencyMs: 100,
        remainingBudgetMs: 6000,
        userPriority: 'normal',
        smartSamplingEnabled: false
      });
      
      expect(result.tier.name).toBe('C');
      expect(result.reason).toBe('short-game-deep-analysis');
    });
    
    it('should select Tier B for balanced conditions with smart sampling', () => {
      const result = selectAnalysisTier({
        totalMoves: 40,
        stockfishLatencyMs: 120,
        remainingBudgetMs: 3000,
        userPriority: 'normal',
        smartSamplingEnabled: true
      });
      
      expect(result.tier.name).toBe('B');
      expect(result.reason).toBe('balanced-smart-sampling');
    });
    
    it('should use Tier B as reasonable default', () => {
      const result = selectAnalysisTier({
        totalMoves: 40,
        remainingBudgetMs: 3000,
        userPriority: 'normal',
        smartSamplingEnabled: false
      });
      
      expect(result.tier.name).toBe('B');
      expect(result.reason).toBe('default-balanced');
    });
    
    it('should fallback to Tier A conservatively', () => {
      const result = selectAnalysisTier({
        totalMoves: 50,
        stockfishLatencyMs: 200,
        remainingBudgetMs: 2200, // Slightly above Tier B estimate but not enough
        userPriority: 'low',
        smartSamplingEnabled: false
      });
      
      // Should pick conservatively
      expect(['A', 'B']).toContain(result.tier.name);
    });
  });
  
  describe('calculateDynamicPositionLimit', () => {
    it('should respect tier maximum', () => {
      const limit = calculateDynamicPositionLimit(
        TIER_B, // max 4 positions
        10000, // Large budget
        500 // avg time per position
      );
      
      expect(limit).toBeLessThanOrEqual(TIER_B.maxPositions);
    });
    
    it('should scale down when budget is limited', () => {
      const limit = calculateDynamicPositionLimit(
        TIER_B, // max 4 positions
        1500, // Limited budget (1500 * 0.8 = 1200ms usable)
        600 // avg time per position
      );
      
      // 1200ms / 600ms = 2 positions
      expect(limit).toBe(2);
    });
    
    it('should never return less than 1 position', () => {
      const limit = calculateDynamicPositionLimit(
        TIER_A,
        100, // Very low budget
        1000
      );
      
      expect(limit).toBeGreaterThanOrEqual(1);
    });
    
    it('should use 20% safety buffer', () => {
      const limit = calculateDynamicPositionLimit(
        TIER_C, // max 6
        3600, // 3600 * 0.8 = 2880ms usable
        600 // avg time
      );
      
      // 2880 / 600 = 4.8 -> 4 positions
      expect(limit).toBe(4);
    });
  });
  
  describe('estimateStockfishLatency', () => {
    it('should return default when no measurements', () => {
      const estimate = estimateStockfishLatency([]);
      
      expect(estimate).toBe(200);
    });
    
    it('should return P90 value for conservative estimate', () => {
      const latencies = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550];
      const estimate = estimateStockfishLatency(latencies);
      
      // P90 of 10 values = 9th value (index 9)
      expect(estimate).toBe(550);
    });
    
    it('should handle single measurement', () => {
      const estimate = estimateStockfishLatency([300]);
      
      expect(estimate).toBe(300);
    });
    
    it('should handle unsorted latencies', () => {
      const latencies = [500, 100, 300, 200, 400];
      const estimate = estimateStockfishLatency(latencies);
      
      // Should sort first, then take P90
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(500);
    });
  });
  
  describe('adjustForColdStart', () => {
    it('should downgrade Tier C to Tier B on cold start', () => {
      const adjusted = adjustForColdStart(TIER_C, true);
      
      expect(adjusted.name).toBe('B');
    });
    
    it('should downgrade Tier B to Tier A on cold start', () => {
      const adjusted = adjustForColdStart(TIER_B, true);
      
      expect(adjusted.name).toBe('A');
    });
    
    it('should keep Tier A on cold start', () => {
      const adjusted = adjustForColdStart(TIER_A, true);
      
      expect(adjusted.name).toBe('A');
    });
    
    it('should not change tier when not cold start', () => {
      const adjusted = adjustForColdStart(TIER_C, false);
      
      expect(adjusted.name).toBe('C');
    });
  });
  
  describe('Tier configuration validation', () => {
    it('should have ordered depths', () => {
      expect(TIER_A.depth).toBeLessThan(TIER_B.depth);
      expect(TIER_B.depth).toBeLessThan(TIER_C.depth);
    });
    
    it('should have ordered max positions', () => {
      expect(TIER_A.maxPositions).toBeLessThan(TIER_B.maxPositions);
      expect(TIER_B.maxPositions).toBeLessThan(TIER_C.maxPositions);
    });
    
    it('should have ordered estimated times', () => {
      expect(TIER_A.estimatedTimeMs).toBeLessThan(TIER_B.estimatedTimeMs);
      expect(TIER_B.estimatedTimeMs).toBeLessThan(TIER_C.estimatedTimeMs);
    });
  });
});
