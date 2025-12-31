/**
 * CPU Fallback Behavior Tests
 * 
 * Validates the single-move fallback policy:
 * 1. Worker is attempted on EVERY CPU turn
 * 2. Fallback is used for EXACTLY ONE move when Worker fails
 * 3. Next CPU turn MUST retry Worker
 * 4. Sticky fallback is IMPOSSIBLE
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cpuTelemetry } from '../lib/cpu/cpuTelemetry';
import type { CPUMoveTelemetry } from '../types/cpuTelemetry';
import { WorkerErrorType, validateNoStickyFallback, classifyWorkerError } from '../types/cpuTelemetry';

describe('CPU Fallback Policy - Single Move Contract', () => {
  beforeEach(() => {
    cpuTelemetry.reset();
  });

  it('should allow Worker success followed by another Worker success', () => {
    const move1 = cpuTelemetry.createWorkerSuccess({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 4,
      workerTimeMs: 500,
      totalTimeMs: 520,
    });

    const move2 = cpuTelemetry.createWorkerSuccess({
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 4,
      workerTimeMs: 450,
      totalTimeMs: 470,
    });

    cpuTelemetry.logMove(move1);
    cpuTelemetry.logMove(move2);

    const stats = cpuTelemetry.getStats();
    expect(stats.totalMoves).toBe(2);
    expect(stats.workerSuccesses).toBe(2);
    expect(stats.fallbackUses).toBe(0);
    expect(stats.consecutiveFallbacks).toBe(0);
  });

  it('should allow Worker failure + fallback followed by Worker success', () => {
    // Move 1: Worker fails, fallback used
    const move1 = cpuTelemetry.createWorkerFailureWithFallback({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 3,
      error: new Error('Worker timeout after 2750ms'),
      statusCode: undefined,
      workerTimeMs: 2750,
      fallbackTimeMs: 1200,
      totalTimeMs: 3950,
    });

    // Move 2: Worker retried and succeeds
    const move2 = cpuTelemetry.createWorkerSuccess({
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 4,
      workerTimeMs: 500,
      totalTimeMs: 520,
    });

    cpuTelemetry.logMove(move1);
    cpuTelemetry.logMove(move2);

    const stats = cpuTelemetry.getStats();
    expect(stats.totalMoves).toBe(2);
    expect(stats.workerAttempts).toBe(2); // Worker attempted on BOTH moves
    expect(stats.workerSuccesses).toBe(1); // Only move 2 succeeded
    expect(stats.fallbackUses).toBe(1); // Only move 1 used fallback
    expect(stats.consecutiveFallbacks).toBe(0); // Reset after move 2 success
  });

  it('should REJECT two consecutive fallbacks (sticky fallback violation)', () => {
    // Move 1: Worker fails, fallback used
    const move1 = cpuTelemetry.createWorkerFailureWithFallback({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 3,
      error: new Error('Service unavailable'),
      statusCode: 503,
      workerTimeMs: 100,
      fallbackTimeMs: 1200,
      totalTimeMs: 1300,
    });

    // Move 2: Worker fails AGAIN, fallback used AGAIN
    const move2 = cpuTelemetry.createWorkerFailureWithFallback({
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 3,
      error: new Error('Service unavailable'),
      statusCode: 503,
      workerTimeMs: 100,
      fallbackTimeMs: 1150,
      totalTimeMs: 1250,
    });

    cpuTelemetry.logMove(move1);

    // This should THROW because two consecutive fallbacks violates policy
    expect(() => {
      cpuTelemetry.logMove(move2);
    }).toThrow(/STICKY FALLBACK DETECTED/);
  });

  it('should track consecutive fallback counter correctly', () => {
    // Move 1: Worker success
    const move1 = cpuTelemetry.createWorkerSuccess({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 4,
      workerTimeMs: 500,
      totalTimeMs: 520,
    });

    cpuTelemetry.logMove(move1);
    expect(cpuTelemetry.getStats().consecutiveFallbacks).toBe(0);

    // Move 2: Worker fails, fallback used
    const move2 = cpuTelemetry.createWorkerFailureWithFallback({
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 3,
      error: new Error('Worker timeout'),
      workerTimeMs: 2750,
      fallbackTimeMs: 1200,
      totalTimeMs: 3950,
    });

    cpuTelemetry.logMove(move2);
    expect(cpuTelemetry.getStats().consecutiveFallbacks).toBe(1);

    // Move 3: Worker succeeds (resets counter)
    const move3 = cpuTelemetry.createWorkerSuccess({
      moveNumber: 3,
      cpuLevel: 5,
      requestId: 'req-3',
      moveFrom: 'd7',
      moveTo: 'd5',
      depthReached: 4,
      workerTimeMs: 450,
      totalTimeMs: 470,
    });

    cpuTelemetry.logMove(move3);
    expect(cpuTelemetry.getStats().consecutiveFallbacks).toBe(0);
  });

  it('should allow local computation (no Worker attempt) to not count as fallback', () => {
    // Move 1: Local computation (level 1-2 or 7-8)
    const move1 = cpuTelemetry.createLocalComputation({
      moveNumber: 1,
      cpuLevel: 2,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 2,
      totalTimeMs: 800,
    });

    // Move 2: Another local computation
    const move2 = cpuTelemetry.createLocalComputation({
      moveNumber: 2,
      cpuLevel: 2,
      requestId: 'req-2',
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 2,
      totalTimeMs: 750,
    });

    cpuTelemetry.logMove(move1);
    cpuTelemetry.logMove(move2);

    const stats = cpuTelemetry.getStats();
    expect(stats.totalMoves).toBe(2);
    expect(stats.workerAttempts).toBe(0); // Worker never attempted
    expect(stats.fallbackUses).toBe(0); // Not counted as fallback
    expect(stats.consecutiveFallbacks).toBe(0); // No fallback used
  });

  it('should validate telemetry fields are correct for Worker success', () => {
    const telemetry = cpuTelemetry.createWorkerSuccess({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 4,
      workerTimeMs: 500,
      totalTimeMs: 520,
    });

    expect(telemetry.apiAttempted).toBe(true);
    expect(telemetry.apiSucceeded).toBe(true);
    expect(telemetry.fallbackUsedThisMove).toBe(false);
    expect(telemetry.fallbackStickyState).toBe(false); // MUST ALWAYS BE FALSE
    expect(telemetry.source).toBe('worker');
    expect(telemetry.workerTimeMs).toBe(500);
    expect(telemetry.fallbackTimeMs).toBeUndefined();
  });

  it('should validate telemetry fields are correct for Worker failure + fallback', () => {
    const telemetry = cpuTelemetry.createWorkerFailureWithFallback({
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 3,
      error: new Error('Service unavailable'),
      statusCode: 503,
      workerTimeMs: 100,
      fallbackTimeMs: 1200,
      totalTimeMs: 1300,
    });

    expect(telemetry.apiAttempted).toBe(true);
    expect(telemetry.apiSucceeded).toBe(false);
    expect(telemetry.fallbackUsedThisMove).toBe(true);
    expect(telemetry.fallbackStickyState).toBe(false); // MUST ALWAYS BE FALSE
    expect(telemetry.source).toBe('fallback');
    expect(telemetry.workerTimeMs).toBe(100);
    expect(telemetry.fallbackTimeMs).toBe(1200);
    expect(telemetry.apiErrorCode).toBe(WorkerErrorType.WORKER_CPU_LIMIT);
  });

  it('should validate telemetry fields are correct for local computation', () => {
    const telemetry = cpuTelemetry.createLocalComputation({
      moveNumber: 1,
      cpuLevel: 2,
      requestId: 'req-1',
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 2,
      totalTimeMs: 800,
    });

    expect(telemetry.apiAttempted).toBe(false);
    expect(telemetry.apiSucceeded).toBe(false);
    expect(telemetry.fallbackUsedThisMove).toBe(false);
    expect(telemetry.fallbackStickyState).toBe(false); // MUST ALWAYS BE FALSE
    expect(telemetry.source).toBe('local');
    expect(telemetry.workerTimeMs).toBeUndefined();
    expect(telemetry.fallbackTimeMs).toBeUndefined();
  });
});

describe('Error Classification', () => {
  it('should classify worker timeout as WORKER_TIMEOUT', () => {
    const error = new Error('Worker timeout after 2750ms');
    const type = classifyWorkerError(error);
    expect(type).toBe(WorkerErrorType.WORKER_TIMEOUT);
  });

  it('should classify 503 as WORKER_CPU_LIMIT', () => {
    const error = new Error('Service unavailable');
    const type = classifyWorkerError(error, 503);
    expect(type).toBe(WorkerErrorType.WORKER_CPU_LIMIT);
  });

  it('should classify network errors as NETWORK_ERROR', () => {
    const error = new Error('Network request failed');
    const type = classifyWorkerError(error, 502);
    expect(type).toBe(WorkerErrorType.NETWORK_ERROR);
  });

  it('should classify parse errors as INVALID_RESPONSE', () => {
    const error = new Error('Could not parse SAN move "Qx99" - not in legal moves list');
    const type = classifyWorkerError(error);
    expect(type).toBe(WorkerErrorType.INVALID_RESPONSE);
  });

  it('should return null for non-transient errors (should fail hard)', () => {
    const error = new Error('Database connection failed');
    const type = classifyWorkerError(error);
    expect(type).toBeNull(); // Should NOT trigger fallback
  });

  it('should reject fallback for non-transient errors', () => {
    const error = new Error('Internal server error');
    
    expect(() => {
      cpuTelemetry.createWorkerFailureWithFallback({
        moveNumber: 1,
        cpuLevel: 5,
        requestId: 'req-1',
        moveFrom: 'e2',
        moveTo: 'e4',
        depthReached: 3,
        error,
        statusCode: 500,
        workerTimeMs: 100,
        fallbackTimeMs: 1200,
        totalTimeMs: 1300,
      });
    }).toThrow(/Non-transient error should not trigger fallback/);
  });
});

describe('Fallback State Validation', () => {
  it('should reject stats with consecutiveFallbacks > 1', () => {
    const stats = {
      totalMoves: 2,
      workerAttempts: 2,
      workerSuccesses: 0,
      fallbackUses: 2,
      consecutiveFallbacks: 2, // VIOLATION
      avgWorkerTimeMs: 0,
      avgFallbackTimeMs: 1200,
      recentMoves: [],
    };

    expect(() => {
      validateNoStickyFallback(stats);
    }).toThrow(/STICKY FALLBACK DETECTED.*consecutive fallbacks/);
  });

  it('should reject two consecutive fallback moves in recent history', () => {
    const move1: CPUMoveTelemetry = {
      timestamp: Date.now() - 5000,
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      apiAttempted: true,
      apiSucceeded: false,
      apiErrorCode: WorkerErrorType.WORKER_CPU_LIMIT,
      fallbackUsedThisMove: true,
      fallbackStickyState: false,
      timeMs: 1300,
      workerTimeMs: 100,
      fallbackTimeMs: 1200,
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 3,
      source: 'fallback',
    };

    const move2: CPUMoveTelemetry = {
      timestamp: Date.now(),
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      apiAttempted: true,
      apiSucceeded: false,
      apiErrorCode: WorkerErrorType.WORKER_CPU_LIMIT,
      fallbackUsedThisMove: true,
      fallbackStickyState: false,
      timeMs: 1250,
      workerTimeMs: 100,
      fallbackTimeMs: 1150,
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 3,
      source: 'fallback',
    };

    const stats = {
      totalMoves: 2,
      workerAttempts: 2,
      workerSuccesses: 0,
      fallbackUses: 2,
      consecutiveFallbacks: 2,
      avgWorkerTimeMs: 100,
      avgFallbackTimeMs: 1175,
      recentMoves: [move2, move1],
    };

    expect(() => {
      validateNoStickyFallback(stats);
    }).toThrow(/STICKY FALLBACK DETECTED.*Two consecutive moves/);
  });

  it('should accept fallback followed by Worker success', () => {
    const move1: CPUMoveTelemetry = {
      timestamp: Date.now() - 5000,
      moveNumber: 1,
      cpuLevel: 5,
      requestId: 'req-1',
      apiAttempted: true,
      apiSucceeded: false,
      apiErrorCode: WorkerErrorType.WORKER_TIMEOUT,
      fallbackUsedThisMove: true,
      fallbackStickyState: false,
      timeMs: 3950,
      workerTimeMs: 2750,
      fallbackTimeMs: 1200,
      moveFrom: 'e2',
      moveTo: 'e4',
      depthReached: 3,
      source: 'fallback',
    };

    const move2: CPUMoveTelemetry = {
      timestamp: Date.now(),
      moveNumber: 2,
      cpuLevel: 5,
      requestId: 'req-2',
      apiAttempted: true,
      apiSucceeded: true,
      fallbackUsedThisMove: false,
      fallbackStickyState: false,
      timeMs: 520,
      workerTimeMs: 500,
      moveFrom: 'e7',
      moveTo: 'e5',
      depthReached: 4,
      source: 'worker',
    };

    const stats = {
      totalMoves: 2,
      workerAttempts: 2,
      workerSuccesses: 1,
      fallbackUses: 1,
      consecutiveFallbacks: 0, // Reset after success
      avgWorkerTimeMs: 500,
      avgFallbackTimeMs: 1200,
      recentMoves: [move2, move1],
    };

    // Should NOT throw
    expect(() => {
      validateNoStickyFallback(stats);
    }).not.toThrow();
  });
});
