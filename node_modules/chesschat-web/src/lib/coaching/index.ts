/**
 * Coaching System - Main Export
 * Provides easy access to all coaching functionality
 */

export { RuleBasedCoachingEngine, coachingEngine } from './ruleBasedCoachingEngine';
export { TacticalAnalyzer } from './tacticalAnalyzer';
export { StrategicAnalyzer } from './strategicAnalyzer';
export { FeedbackGenerator } from './feedbackGenerator';
export { TrainingDataCollector, trainingCollector } from './trainingDataCollector';
export type { TrainingExample } from './trainingDataCollector';

export type {
  GameplayMetrics,
  TacticalMistake,
  TacticalPattern,
  StrategicViolation,
  GamePhase,
  ChessPrinciple,
  Improvement,
  CoachingReport,
  AnalysisContext,
  MistakeType,
} from './types';
