/**
 * CPU Configuration for Cloudflare Workers Chess Engine
 * 
 * CRITICAL: Single constant budget across ALL difficulty levels
 * Difficulty variation achieved ONLY through:
 * - Candidate pool selection
 * - Feature toggles (tactical checks, positional heuristics)
 * - Weighted randomness in move selection
 * 
 * DO NOT add per-level timeouts - it breaks the optimization architecture.
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

export type Difficulty = keyof typeof DIFFICULTY_SETTINGS;
