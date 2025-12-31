/**
 * Learning Audit System - Track all Learning V3 operations
 * 
 * Ensures every operation is logged for debugging, compliance, and analytics.
 */

import type { LearningV3Config } from './featureFlags';

export interface LearningEventData {
  requestId: string;
  userId: string;
  gameId: string | null;
  operation: 'ingest' | 'plan' | 'feedback' | 'postgame' | 'health';
  conceptKeysDetected: string[];
  evalDeltaSummary: {
    inaccuracies: number;
    mistakes: number;
    blunders: number;
    avgDelta: number;
  } | null;
  flagsSnapshot: {
    enabled: boolean;
    readonly: boolean;
    shadowMode: boolean;
    reason: string;
  };
  durationMs: number;
  result: 'success' | 'partial' | 'failed';
  error: string | null;
  metadata: Record<string, any>;
}

/**
 * Create a LearningEvent in the database
 */
export async function createLearningEvent(
  prisma: any,
  eventData: LearningEventData
): Promise<void> {
  try {
    await prisma.learningEvent.create({
      data: {
        requestId: eventData.requestId,
        userId: eventData.userId,
        gameId: eventData.gameId,
        operation: eventData.operation,
        conceptKeysDetected: eventData.conceptKeysDetected,
        evalDeltaSummary: eventData.evalDeltaSummary,
        flagsSnapshot: eventData.flagsSnapshot,
        durationMs: eventData.durationMs,
        result: eventData.result,
        error: eventData.error,
        metadata: eventData.metadata,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    // Critical: log event creation failure but don't throw
    console.error('[LearningAudit] Failed to create LearningEvent:', error);
  }
}

/**
 * Create audit context for a request
 */
export function createAuditContext(
  requestId: string,
  userId: string,
  operation: LearningEventData['operation'],
  config: LearningV3Config,
  reason: string
): Omit<LearningEventData, 'durationMs' | 'result' | 'error'> {
  return {
    requestId,
    userId,
    gameId: null,
    operation,
    conceptKeysDetected: [],
    evalDeltaSummary: null,
    flagsSnapshot: {
      enabled: config.enabled,
      readonly: config.readonly,
      shadowMode: config.shadowMode,
      reason,
    },
    metadata: {},
  };
}

/**
 * Finalize and write audit event
 */
export async function finalizeAuditEvent(
  prisma: any,
  context: Omit<LearningEventData, 'durationMs' | 'result' | 'error'>,
  startTime: number,
  result: 'success' | 'partial' | 'failed',
  error: string | null = null,
  additionalData: Partial<LearningEventData> = {}
): Promise<void> {
  const eventData: LearningEventData = {
    ...context,
    ...additionalData,
    durationMs: Date.now() - startTime,
    result,
    error,
  };
  
  await createLearningEvent(prisma, eventData);
}

/**
 * Create audit event for read-only block
 */
export async function auditReadOnlyBlock(
  prisma: any,
  requestId: string,
  userId: string,
  operation: LearningEventData['operation'],
  config: LearningV3Config
): Promise<void> {
  await createLearningEvent(prisma, {
    requestId,
    userId,
    gameId: null,
    operation,
    conceptKeysDetected: [],
    evalDeltaSummary: null,
    flagsSnapshot: {
      enabled: config.enabled,
      readonly: config.readonly,
      shadowMode: config.shadowMode,
      reason: 'readonly-blocked',
    },
    durationMs: 0,
    result: 'failed',
    error: 'WRITE_BLOCKED',
    metadata: { blockedBy: 'readonly-mode' },
  });
}
