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
  // === e4 OPENINGS ===
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
    id: 'ruy-lopez-berlin',
    name: 'Ruy Lopez - Berlin Defense',
    eco: 'C67',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'],
    description: 'A solid defense popularized by Vladimir Kramnik.',
  },
  {
    id: 'scotch-game',
    name: 'Scotch Game',
    eco: 'C45',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'],
    description: 'An aggressive opening seeking quick development and central control.',
  },
  {
    id: 'vienna-game',
    name: 'Vienna Game',
    eco: 'C25',
    movesSAN: ['e4', 'e5', 'Nc3', 'Nf6', 'f4'],
    description: 'A flexible opening leading to both tactical and positional play.',
  },
  {
    id: 'kings-gambit',
    name: "King's Gambit",
    eco: 'C30',
    movesSAN: ['e4', 'e5', 'f4'],
    description: 'A romantic opening sacrificing a pawn for quick development.',
  },
  {
    id: 'petroff-defense',
    name: 'Petroff Defense',
    eco: 'C42',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4'],
    description: 'A solid symmetrical defense favored by defensive players.',
  },
  {
    id: 'philidor-defense',
    name: 'Philidor Defense',
    eco: 'C41',
    movesSAN: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6'],
    description: 'A solid but passive defense emphasizing piece development.',
  },
  
  // === SICILIAN DEFENSES ===
  {
    id: 'sicilian-najdorf',
    name: 'Sicilian Defense - Najdorf',
    eco: 'B90',
    movesSAN: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    description: 'A sharp, fighting opening popular at all levels.',
  },
  {
    id: 'sicilian-dragon',
    name: 'Sicilian Defense - Dragon',
    eco: 'B70',
    movesSAN: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
    description: 'A highly tactical variation with kingside fianchetto.',
  },
  {
    id: 'sicilian-sveshnikov',
    name: 'Sicilian Defense - Sveshnikov',
    eco: 'B33',
    movesSAN: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'],
    description: 'A modern aggressive system accepting structural weaknesses.',
  },
  {
    id: 'sicilian-classical',
    name: 'Sicilian Defense - Classical',
    eco: 'B56',
    movesSAN: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'Nc6'],
    description: 'A traditional approach to the Sicilian with solid development.',
  },
  {
    id: 'sicilian-closed',
    name: 'Sicilian Defense - Closed',
    eco: 'B23',
    movesSAN: ['e4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7'],
    description: 'A quieter positional approach avoiding open lines.',
  },
  
  // === FRENCH & CARO-KANN ===
  {
    id: 'french-defense',
    name: 'French Defense',
    eco: 'C00',
    movesSAN: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'],
    description: 'A solid defense that leads to strategic battles.',
  },
  {
    id: 'french-winawer',
    name: 'French Defense - Winawer',
    eco: 'C15',
    movesSAN: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3'],
    description: 'A sharp tactical variation of the French.',
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann Defense',
    eco: 'B10',
    movesSAN: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
    description: 'A solid defense leading to safe positions for Black.',
  },
  {
    id: 'caro-kann-advanced',
    name: 'Caro-Kann Defense - Advanced',
    eco: 'B12',
    movesSAN: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6'],
    description: 'White gains space while Black seeks counterplay.',
  },
  
  // === OTHER e4 DEFENSES ===
  {
    id: 'pirc-defense',
    name: 'Pirc Defense',
    eco: 'B07',
    movesSAN: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
    description: 'A hypermodern defense with flexible pawn structure.',
  },
  {
    id: 'modern-defense',
    name: 'Modern Defense',
    eco: 'B06',
    movesSAN: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6'],
    description: 'A flexible system delaying central pawn moves.',
  },
  {
    id: 'alekhine-defense',
    name: 'Alekhine Defense',
    eco: 'B02',
    movesSAN: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'Bg4'],
    description: 'A provocative defense inviting White to overextend.',
  },
  {
    id: 'scandinavian-defense',
    name: 'Scandinavian Defense',
    eco: 'B01',
    movesSAN: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'],
    description: 'An active defense with early queen development.',
  },
  
  // === d4 OPENINGS - QUEEN'S GAMBIT ===
  {
    id: 'queens-gambit',
    name: "Queen's Gambit Declined",
    eco: 'D06',
    movesSAN: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],
    description: 'A timeless opening that offers White a small advantage.',
  },
  {
    id: 'queens-gambit-accepted',
    name: "Queen's Gambit Accepted",
    eco: 'D20',
    movesSAN: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3', 'e6'],
    description: 'Black accepts the gambit pawn seeking quick development.',
  },
  {
    id: 'slav-defense',
    name: 'Slav Defense',
    eco: 'D10',
    movesSAN: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4'],
    description: 'A solid defense maintaining central control.',
  },
  {
    id: 'semi-slav',
    name: 'Semi-Slav Defense',
    eco: 'D43',
    movesSAN: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6'],
    description: 'A complex defense combining ideas from QGD and Slav.',
  },
  {
    id: 'queens-gambit-tarrasch',
    name: "Queen's Gambit - Tarrasch Defense",
    eco: 'D32',
    movesSAN: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5'],
    description: 'An active defense seeking quick counterplay.',
  },
  {
    id: 'catalan',
    name: 'Catalan Opening',
    eco: 'E00',
    movesSAN: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'],
    description: 'A sophisticated system combining QGD with fianchetto.',
  },
  
  // === INDIAN DEFENSES ===
  {
    id: 'kings-indian',
    name: "King's Indian Defense",
    eco: 'E60',
    movesSAN: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'],
    description: 'A hypermodern defense leading to attacking chances.',
  },
  {
    id: 'nimzo-indian',
    name: 'Nimzo-Indian Defense',
    eco: 'E20',
    movesSAN: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    description: 'A flexible defense controlling the center from afar.',
  },
  {
    id: 'queens-indian',
    name: "Queen's Indian Defense",
    eco: 'E12',
    movesSAN: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Bb7'],
    description: 'A solid hypermodern defense with fianchetto.',
  },
  {
    id: 'grunfeld-defense',
    name: 'Grünfeld Defense',
    eco: 'D70',
    movesSAN: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
    description: 'A dynamic defense striking at the center immediately.',
  },
  {
    id: 'benoni-defense',
    name: 'Benoni Defense',
    eco: 'A56',
    movesSAN: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6', 'Nc3', 'exd5'],
    description: 'An asymmetric defense seeking active piece play.',
  },
  {
    id: 'benko-gambit',
    name: 'Benko Gambit',
    eco: 'A57',
    movesSAN: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'],
    description: 'A positional gambit offering long-term compensation.',
  },
  {
    id: 'dutch-defense',
    name: 'Dutch Defense',
    eco: 'A80',
    movesSAN: ['d4', 'f5', 'g3', 'Nf6', 'Bg2', 'e6', 'Nf3', 'Be7'],
    description: 'An aggressive defense fighting for kingside control.',
  },
  {
    id: 'budapest-gambit',
    name: 'Budapest Gambit',
    eco: 'A51',
    movesSAN: ['d4', 'Nf6', 'c4', 'e5', 'dxe5', 'Ng4'],
    description: 'A sharp gambit seeking rapid development.',
  },
  
  // === d4 OTHER SYSTEMS ===
  {
    id: 'london-system',
    name: 'London System',
    eco: 'D02',
    movesSAN: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'e6', 'e3', 'Bd6'],
    description: 'A solid system for White with reliable setup.',
  },
  {
    id: 'trompowsky',
    name: 'Trompowsky Attack',
    eco: 'A45',
    movesSAN: ['d4', 'Nf6', 'Bg5', 'e6', 'e4'],
    description: 'An aggressive system disrupting Black\'s development.',
  },
  {
    id: 'torre-attack',
    name: 'Torre Attack',
    eco: 'A46',
    movesSAN: ['d4', 'Nf6', 'Nf3', 'e6', 'Bg5', 'c5', 'e3'],
    description: 'A flexible system with early bishop development.',
  },
  {
    id: 'colle-system',
    name: 'Colle System',
    eco: 'D05',
    movesSAN: ['d4', 'd5', 'Nf3', 'Nf6', 'e3', 'e6', 'Bd3', 'c5'],
    description: 'A quiet system building a solid center.',
  },
  
  // === FLANK OPENINGS ===
  {
    id: 'english-opening',
    name: 'English Opening',
    eco: 'A10',
    movesSAN: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6'],
    description: 'A flexible opening controlling the center from the flank.',
  },
  {
    id: 'english-symmetrical',
    name: 'English Opening - Symmetrical',
    eco: 'A30',
    movesSAN: ['c4', 'c5', 'Nf3', 'Nf6', 'Nc3', 'Nc6', 'g3', 'g6'],
    description: 'A balanced variation with symmetrical pawn structure.',
  },
  {
    id: 'reti-opening',
    name: 'Réti Opening',
    eco: 'A09',
    movesSAN: ['Nf3', 'd5', 'c4', 'd4', 'e3', 'Nf6', 'exd4', 'Nxd4'],
    description: 'A hypermodern opening delaying central pawn moves.',
  },
  {
    id: 'birds-opening',
    name: "Bird's Opening",
    eco: 'A02',
    movesSAN: ['f4', 'd5', 'Nf3', 'Nf6', 'e3', 'g6'],
    description: 'An aggressive flank opening controlling e5.',
  },
  {
    id: 'kings-indian-attack',
    name: "King's Indian Attack",
    eco: 'A07',
    movesSAN: ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'e6', 'O-O', 'Be7'],
    description: 'A flexible system adaptable to various responses.',
  },
  
  // === IRREGULAR & GAMBITS ===
  {
    id: 'evans-gambit',
    name: 'Evans Gambit',
    eco: 'C51',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    description: 'A romantic gambit sacrificing a pawn for initiative.',
  },
  {
    id: 'danish-gambit',
    name: 'Danish Gambit',
    eco: 'C21',
    movesSAN: ['e4', 'e5', 'd4', 'exd4', 'c3', 'dxc3', 'Bc4'],
    description: 'A sharp gambit sacrificing two pawns for development.',
  },
  {
    id: 'smith-morra',
    name: 'Smith-Morra Gambit',
    eco: 'B21',
    movesSAN: ['e4', 'c5', 'd4', 'cxd4', 'c3'],
    description: 'A popular gambit against the Sicilian Defense.',
  },
  {
    id: 'blackmar-diemer',
    name: 'Blackmar-Diemer Gambit',
    eco: 'D00',
    movesSAN: ['d4', 'd5', 'e4', 'dxe4', 'Nc3', 'Nf6', 'f3'],
    description: 'An aggressive gambit seeking quick attacks.',
  },
  {
    id: 'four-knights',
    name: 'Four Knights Game',
    eco: 'C47',
    movesSAN: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'],
    description: 'A symmetrical opening with solid development.',
  },
  {
    id: 'stonewall-attack',
    name: 'Stonewall Attack',
    eco: 'D00',
    movesSAN: ['d4', 'd5', 'e3', 'Nf6', 'Bd3', 'c5', 'c3', 'Nc6', 'f4'],
    description: 'A solid system with a characteristic pawn structure.',
  },
];
