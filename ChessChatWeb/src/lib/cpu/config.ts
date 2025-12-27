/**
 * CPU Move Budget Configuration
 * Single constant across ALL difficulty levels for Cloudflare Workers
 * 
 * Difficulty variation achieved through:
 * - Candidate selection randomness
 * - Evaluation feature toggles
 * - Tactical micro-checks (always ON)
 */

export const CPU_MOVE_BUDGET_MS = 750;

export const DIFFICULTY_SETTINGS = {
  beginner: {
    candidatePoolSize: 10,
    useTacticalChecks: true,
    useBlunderGate: true,
    usePositionalHeuristics: false,
  },
  intermediate: {
    candidatePoolSize: 5,
    useTacticalChecks: true,
    useBlunderGate: true,
    usePositionalHeuristics: true,
  },
  advanced: {
    candidatePoolSize: 3,
    useTacticalChecks: true,
    useBlunderGate: true,
    usePositionalHeuristics: true,
  },
  master: {
    candidatePoolSize: 1,
    useTacticalChecks: true,
    useBlunderGate: true,
    usePositionalHeuristics: true,
  },
} as const;
