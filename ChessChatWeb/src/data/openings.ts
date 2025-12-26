/**
 * Chess Openings Database for Tutorial Mode
 */

export interface OpeningMove {
  move: string;
  explanation: string;
  concept?: string;
}

export interface ChessOpening {
  id: string;
  name: string;
  ecoCode: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  moves: OpeningMove[];
  keyThemes: string[];
  typicalContinuations: string[];
}

export const CHESS_OPENINGS: Record<string, ChessOpening> = {
  'italian-game': {
    id: 'italian-game',
    name: 'Italian Game',
    ecoCode: 'C50',
    description: 'A classical opening that develops pieces quickly and fights for the center.',
    difficulty: 'beginner',
    moves: [
      {
        move: 'e4',
        explanation: 'Control the center with the king pawn.',
        concept: 'Center Control'
      },
      {
        move: 'e5',
        explanation: 'Black mirrors the central control.',
        concept: 'Center Control'
      },
      {
        move: 'Nf3',
        explanation: 'Develop the knight and attack the e5 pawn.',
        concept: 'Development'
      },
      {
        move: 'Nc6',
        explanation: 'Defend the e5 pawn with the knight.',
        concept: 'Development'
      },
      {
        move: 'Bc4',
        explanation: 'Develop the bishop to an active square.',
        concept: 'Development'
      }
    ],
    keyThemes: ['Development', 'Center Control', 'King Safety'],
    typicalContinuations: ['d3', 'O-O', 'Re1']
  },

  'ruy-lopez': {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    ecoCode: 'C60',
    description: 'One of the oldest chess openings, putting pressure on the center.',
    difficulty: 'beginner',
    moves: [
      {
        move: 'e4',
        explanation: 'Open with the king pawn.',
        concept: 'Center Control'
      },
      {
        move: 'e5',
        explanation: 'Black responds symmetrically.',
        concept: 'Center Control'
      },
      {
        move: 'Nf3',
        explanation: 'Develop and attack e5.',
        concept: 'Development'
      },
      {
        move: 'Nc6',
        explanation: 'Defend the e5 pawn.',
        concept: 'Development'
      },
      {
        move: 'Bb5',
        explanation: 'Pin the knight to the king.',
        concept: 'Pins'
      }
    ],
    keyThemes: ['Pin', 'Pressure', 'Development'],
    typicalContinuations: ['O-O', 'Re1', 'd3']
  },

  'london-system': {
    id: 'london-system',
    name: 'London System',
    ecoCode: 'D02',
    description: 'A solid system opening for White.',
    difficulty: 'beginner',
    moves: [
      {
        move: 'd4',
        explanation: 'Control the center with the queen pawn.',
        concept: 'Center Control'
      },
      {
        move: 'Nf6',
        explanation: 'Black develops the knight.',
        concept: 'Development'
      },
      {
        move: 'Bf4',
        explanation: 'The key London System move.',
        concept: 'System Development'
      }
    ],
    keyThemes: ['System Play', 'Solid Development'],
    typicalContinuations: ['e3', 'Bd3', 'Nf3']
  },

  'sicilian-defense': {
    id: 'sicilian-defense',
    name: 'Sicilian Defense',
    ecoCode: 'B20',
    description: 'Black\'s most popular response to e4.',
    difficulty: 'intermediate',
    moves: [
      {
        move: 'e4',
        explanation: 'White opens with e4.',
        concept: 'Center Control'
      },
      {
        move: 'c5',
        explanation: 'The Sicilian! Fight for the center asymmetrically.',
        concept: 'Asymmetrical Play'
      },
      {
        move: 'Nf3',
        explanation: 'Develop and prepare d4.',
        concept: 'Development'
      }
    ],
    keyThemes: ['Imbalanced', 'Sharp Play', 'Tactical'],
    typicalContinuations: ['d4', 'Nc3', 'Be2']
  }
};

export function getOpeningsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): ChessOpening[] {
  return Object.values(CHESS_OPENINGS).filter(opening => opening.difficulty === difficulty);
}

export function getAllOpenings(): ChessOpening[] {
  return Object.values(CHESS_OPENINGS);
}

export function getOpeningById(id: string): ChessOpening | null {
  return CHESS_OPENINGS[id] || null;
}

export function getBeginnerOpenings(): ChessOpening[] {
  return getOpeningsByDifficulty('beginner');
}

export function getOpeningByEco(ecoCode: string): ChessOpening | null {
  return Object.values(CHESS_OPENINGS).find(opening => opening.ecoCode === ecoCode) || null;
}