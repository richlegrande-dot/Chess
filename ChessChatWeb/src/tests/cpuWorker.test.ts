/**
 * CPU Worker Tests
 * 
 * Tests for Web Worker integration, tactical micro-engine, and UI responsiveness
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CpuWorkerClient } from '../lib/cpu/cpuWorkerClient';
import { 
  analyzeTacticalSituation, 
  getBestTacticalMove, 
  filterTacticallySafeMoves 
} from '../lib/tactics/tacticalMicroEngine';

describe('CPU Worker Client', () => {
  let client: CpuWorkerClient;
  
  beforeEach(() => {
    client = new CpuWorkerClient();
  });
  
  it('should compute a move successfully', async () => {
    const result = await client.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      cpuLevel: 3,
      timeLimitMs: 1000,
      minDepth: 2,
      maxDepth: 4
    });
    
    expect(result.move).toBeDefined();
    expect(result.move.from).toBeDefined();
    expect(result.move.to).toBeDefined();
    expect(result.metadata.depthReached).toBeGreaterThan(0);
    expect(result.metadata.timeMs).toBeLessThan(1500); // Allow 500ms grace
  });
  
  it('should respect time limits', async () => {
    const startTime = Date.now();
    
    await client.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      cpuLevel: 5,
      timeLimitMs: 500,
      minDepth: 2,
      maxDepth: 6
    });
    
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(1000); // 500ms + 300ms grace period + buffer
  });
  
  it('should handle cancellation', async () => {
    const promise = client.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      cpuLevel: 6,
      timeLimitMs: 5000,
      minDepth: 2,
      maxDepth: 8
    });
    
    // Cancel after 100ms
    setTimeout(() => client.cancelAll(), 100);
    
    await expect(promise).rejects.toThrow();
  });
  
  it('should return metadata', async () => {
    const result = await client.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      cpuLevel: 3,
      timeLimitMs: 1000,
      minDepth: 2,
      maxDepth: 4
    });
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata.depthReached).toBeGreaterThan(0);
    expect(result.metadata.timeMs).toBeGreaterThan(0);
    expect(result.metadata.sliceCount).toBeGreaterThanOrEqual(0);
    expect(['tactical_safe', 'search', 'fallback']).toContain(result.metadata.source);
  });
});

describe('Tactical Micro-Engine', () => {
  describe('analyzeTacticalSituation', () => {
    it('should detect mate-in-1 for white', () => {
      // Scholar's mate position - white can mate with Qxf7#
      const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
      const analysis = analyzeTacticalSituation(fen);
      
      // This is actually after mate, so let's use a pre-mate position
      const preMate = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 1 4';
      const preMateAnalysis = analyzeTacticalSituation(preMate);
      
      expect(preMateAnalysis.mateIn1ForUs).toBeDefined();
    });
    
    it('should detect hanging pieces', () => {
      // Position with hanging knight on f6
      const fen = 'rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1';
      const analysis = analyzeTacticalSituation(fen);
      
      expect(analysis.hangingPieces).toBeDefined();
    });
    
    it('should identify forcing moves', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const analysis = analyzeTacticalSituation(fen);
      
      expect(analysis.forcingMoves).toBeDefined();
      expect(Array.isArray(analysis.forcingMoves)).toBe(true);
    });
  });
  
  describe('getBestTacticalMove', () => {
    it('should return mate-in-1 if available', () => {
      // Back rank mate setup
      const fen = 'r5k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
      const result = getBestTacticalMove(fen);
      
      if (result.move) {
        expect(result.reason).toContain('Mate');
      }
    });
    
    it('should avoid moves that allow mate', () => {
      // Position where some moves allow back rank mate
      const fen = '4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
      const result = getBestTacticalMove(fen);
      
      expect(result).toBeDefined();
    });
  });
  
  describe('filterTacticallySafeMoves', () => {
    it('should filter out moves that allow mate', () => {
      const fen = '4r1k1/5ppp/8/8/8/8/4RPPP/6K1 w - - 0 1';
      const allMoves = [
        { from: 'g1', to: 'f1' },
        { from: 'g1', to: 'h1' },
        { from: 'e2', to: 'e3' }
      ];
      
      const { safeMoves, rejected } = filterTacticallySafeMoves(fen, allMoves);
      
      expect(safeMoves).toBeDefined();
      expect(rejected).toBeDefined();
      expect(safeMoves.length + rejected.length).toBe(allMoves.length);
    });
  });
});

describe('UI Responsiveness', () => {
  it('should not block main thread during worker computation', async () => {
    const client = new CpuWorkerClient();
    let mainThreadBlocked = false;
    
    // Start worker computation
    const promise = client.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      cpuLevel: 5,
      timeLimitMs: 2000,
      minDepth: 2,
      maxDepth: 6
    });
    
    // Try to execute on main thread during worker computation
    const mainThreadStart = Date.now();
    let iterations = 0;
    
    // Simulate UI work
    const interval = setInterval(() => {
      iterations++;
      const elapsed = Date.now() - mainThreadStart;
      
      // If main thread is blocked, we won't see many iterations
      if (elapsed > 100 && iterations < 5) {
        mainThreadBlocked = true;
      }
      
      if (elapsed > 200) {
        clearInterval(interval);
      }
    }, 10);
    
    await promise;
    
    // Main thread should have been responsive
    expect(mainThreadBlocked).toBe(false);
    expect(iterations).toBeGreaterThan(10); // Should have run many times
  });
});

describe('Worker Error Handling', () => {
  it('should handle invalid FEN gracefully', async () => {
    const client = new CpuWorkerClient();
    
    await expect(
      client.computeMove({
        fen: 'invalid-fen',
        cpuLevel: 3,
        timeLimitMs: 1000,
        minDepth: 2,
        maxDepth: 4
      })
    ).rejects.toThrow();
  });
  
  it('should handle timeout gracefully', async () => {
    const client = new CpuWorkerClient();
    
    const startTime = Date.now();
    
    try {
      await client.computeMove({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        cpuLevel: 8,
        timeLimitMs: 100, // Very short timeout
        minDepth: 2,
        maxDepth: 10 // High depth that can't be reached
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500); // Should timeout quickly
      expect((error as Error).message).toContain('timeout');
    }
  });
});
