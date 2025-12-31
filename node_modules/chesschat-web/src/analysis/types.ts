/**
 * Core types for the chess analysis and coaching pipeline
 */

export interface TurnPoint {
  moveNumber: number;
  fenBefore: string;
  playedMoveSAN: string;
  bestMoveSAN: string;
  evalBefore: number;
  evalAfter: number;
  evalDelta: number;
  sideToMove: 'white' | 'black';
}

export interface ThemedTurnPoint extends TurnPoint {
  themeIds: string[]; // Coach theme IDs assigned to this turning point
  phase: GamePhase;
  openingInfo?: OpeningInfo;
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface OpeningInfo {
  name: string;
  ecoCode?: string;
  movesMatched: number;
}

export interface Takeaway {
  title: string;
  description: string;
  moveNumber: number;
  themeId: string;
  phase: GamePhase;
  priority: number;
}

export interface GameAnalysisResult {
  turnPoints: ThemedTurnPoint[];
  takeaways: Takeaway[];
  openingInfo: OpeningInfo | null;
  gamePhases: {
    opening: { start: number; end: number };
    middlegame: { start: number; end: number };
    endgame: { start: number; end: number };
  };
  playerColor: 'white' | 'black';
  result: string;
  difficultyLevel: number;
}

export interface MaterialCount {
  white: number;
  black: number;
}

export type MoveClassification = 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface EvaluatedMove {
  moveNumber: number;
  san: string;
  fen: string;
  evaluation: number;
  classification: MoveClassification;
  sideToMove: 'white' | 'black';
}