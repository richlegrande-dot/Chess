/**
 * Openings Seed Data for Preview Modal
 * Simple structure with SAN move lists for board preview
 */

export type Opening = {
  id: string;
  name: string;
  eco?: string;
  movesSAN: string[];   // e.g., ["e4", "e5", "Nf3", "Nc6", ...]
  description?: string; // short human description
};

export const OPENINGS_SEED: Opening[] = [
  {
    id: 'italian-game',
    name: 'Italian Game',
    eco: 'C50',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    description: 'A classical opening that develops pieces quickly and fights for the center.',
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    eco: 'C60',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'],
    description: 'One of the oldest chess openings, putting pressure on the center.',
  },
  {
    id: 'sicilian-najdorf',
    name: 'Sicilian Defense - Najdorf',
    eco: 'B90',
    movesSAN: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    description: 'A sharp, fighting opening popular at all levels.',
  },
  {
    id: 'french-defense',
    name: 'French Defense',
    eco: 'C00',
    movesSAN: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'],
    description: 'A solid defense that leads to strategic battles.',
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    eco: 'D06',
    movesSAN: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],
    description: 'A timeless opening that offers White a small advantage.',
  },
];
