/**
 * Unified Difficulty Mapping
 * 
 * Maps CPU levels (1-8) to difficulty strings consistently across the application
 */

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';

/**
 * Map CPU level (1-8) to difficulty string
 * This mapping is used by:
 * - Frontend (CoachingMode, GameView)
 * - API (/api/chess-move)
 * - Worker (worker-assistant)
 */
export function mapCpuLevelToDifficulty(cpuLevel: number): DifficultyLevel {
  if (cpuLevel <= 2) return 'beginner';
  if (cpuLevel <= 4) return 'intermediate';
  if (cpuLevel <= 6) return 'advanced';
  return 'master';
}

/**
 * Map difficulty string to human-readable description
 */
export function getDifficultyDescription(difficulty: DifficultyLevel): string {
  const descriptions: Record<DifficultyLevel, string> = {
    beginner: 'Beginner (Levels 1-2)',
    intermediate: 'Intermediate (Levels 3-4)',
    advanced: 'Advanced (Levels 5-6)',
    master: 'Master (Levels 7-8)'
  };
  return descriptions[difficulty];
}

/**
 * Get CPU level label for UI
 */
export function getCpuLevelLabel(level: number): string {
  const labels: Record<number, string> = {
    1: '1 - Beginner',
    2: '2 - Easy',
    3: '3 - Novice',
    4: '4 - Casual',
    5: '5 - Intermediate',
    6: '6 - Advanced',
    7: '7 - Expert',
    8: '8 - Master'
  };
  return labels[level] || `${level} - Unknown`;
}

/**
 * Get diagnostic info for a CPU level
 */
export function getCpuLevelDiagnostics(cpuLevel: number): {
  level: number;
  label: string;
  difficulty: DifficultyLevel;
  description: string;
} {
  const difficulty = mapCpuLevelToDifficulty(cpuLevel);
  return {
    level: cpuLevel,
    label: getCpuLevelLabel(cpuLevel),
    difficulty,
    description: getDifficultyDescription(difficulty)
  };
}
