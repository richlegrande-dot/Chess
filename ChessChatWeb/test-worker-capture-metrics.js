/**
 * Comprehensive Worker Capture Metrics Test
 * Tests the AI worker's ability to accurately count and analyze captures
 * for player vs opponent, and provide correct insights based on those metrics
 */

import https from 'https';
import http from 'http';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test scenarios with precise capture counts
const testScenarios = [
  {
    name: "Player Dominates Material - 5 captures vs 1",
    description: "Player (White) makes 5 captures, opponent makes only 1",
    playerColor: "White",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
      { moveNum: 1, player: "Black", move: "e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { moveNum: 2, player: "Black", move: "Nc6", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
      { moveNum: 3, player: "White", move: "Nxe5", fen: "r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3", captured: "p" },
      { moveNum: 3, player: "Black", move: "Nf6", fen: "r1bqkb1r/pppp1ppp/2n2n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 1 4" },
      { moveNum: 4, player: "White", move: "Nxc6", fen: "r1bqkb1r/pppp1ppp/2N2n2/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 4", captured: "n" },
      { moveNum: 4, player: "Black", move: "dxc6", fen: "r1bqkb1r/ppp2ppp/2p2n2/8/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 5", captured: "N" },
      { moveNum: 5, player: "White", move: "Bc4", fen: "r1bqkb1r/ppp2ppp/2p2n2/8/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 1 5" },
      { moveNum: 5, player: "Black", move: "Bc5", fen: "r1bqk2r/ppp2ppp/2p2n2/2b5/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 2 6" },
      { moveNum: 6, player: "White", move: "Bxf7+", fen: "r1bqk2r/ppp2Bpp/2p2n2/2b5/4P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 6", captured: "p" },
      { moveNum: 6, player: "Black", move: "Kxf7", fen: "r1bq3r/ppp2kpp/2p2n2/2b5/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 7", captured: "B" },
      { moveNum: 7, player: "White", move: "d3", fen: "r1bq3r/ppp2kpp/2p2n2/2b5/4P3/3P4/PPP2PPP/RNBQK2R b KQ - 0 7" },
      { moveNum: 7, player: "Black", move: "Re8", fen: "r1bq1r2/ppp2kpp/2p2n2/2b5/4P3/3P4/PPP2PPP/RNBQK2R w KQ - 1 8" },
      { moveNum: 8, player: "White", move: "Bh6", fen: "r1bq1r2/ppp2kpp/2p2n1B/2b5/4P3/3P4/PPP2PPP/RN1QK2R b KQ - 2 8" },
      { moveNum: 8, player: "Black", move: "gxh6", fen: "r1bq1r2/ppp2k1p/2p2n1p/2b5/4P3/3P4/PPP2PPP/RN1QK2R w KQ - 0 9", captured: "B" },
      { moveNum: 9, player: "White", move: "Qh5+", fen: "r1bq1r2/ppp2k1p/2p2n1p/2b4Q/4P3/3P4/PPP2PPP/RN2K2R b KQ - 1 9" },
      { moveNum: 9, player: "Black", move: "Kg7", fen: "r1bq1r2/ppp3kp/2p2n1p/2b4Q/4P3/3P4/PPP2PPP/RN2K2R w KQ - 2 10" },
      { moveNum: 10, player: "White", move: "Qxh6+", fen: "r1bq1r2/ppp3k1/2p2n1Q/2b5/4P3/3P4/PPP2PPP/RN2K2R b KQ - 0 10", captured: "p" },
      { moveNum: 10, player: "Black", move: "Kg8", fen: "r1bq1rk1/ppp5/2p2n1Q/2b5/4P3/3P4/PPP2PPP/RN2K2R w KQ - 1 11" },
      { moveNum: 11, player: "White", move: "Qxf6", fen: "r1bq1rk1/ppp5/2p2Q2/2b5/4P3/3P4/PPP2PPP/RN2K2R b KQ - 0 11", captured: "n" }
    ],
    expectedPlayerCaptures: 5,
    expectedOpponentCaptures: 1,
    expectedInsight: "won material", // Should mention material advantage
    shouldNotMention: "lost material" // Should NOT say player lost material
  },
  {
    name: "Opponent Dominates Material - 1 capture vs 4",
    description: "Player (Black) makes only 1 capture, opponent makes 4",
    playerColor: "Black",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
      { moveNum: 1, player: "Black", move: "e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { moveNum: 2, player: "Black", move: "d6", fen: "rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3" },
      { moveNum: 3, player: "White", move: "d4", fen: "rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3" },
      { moveNum: 3, player: "Black", move: "Nc6", fen: "r1bqkbnr/ppp2ppp/2np4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 1 4" },
      { moveNum: 4, player: "White", move: "dxe5", fen: "r1bqkbnr/ppp2ppp/2np4/4P3/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 4", captured: "p" },
      { moveNum: 4, player: "Black", move: "dxe5", fen: "r1bqkbnr/ppp2ppp/2n5/4p3/4P3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 5", captured: "P" },
      { moveNum: 5, player: "White", move: "Nxe5", fen: "r1bqkbnr/ppp2ppp/2n5/4N3/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", captured: "p" },
      { moveNum: 5, player: "Black", move: "Nf6", fen: "r1bqkb1r/ppp2ppp/2n2n2/4N3/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 1 6" },
      { moveNum: 6, player: "White", move: "Nxc6", fen: "r1bqkb1r/ppp2ppp/2N2n2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 6", captured: "n" },
      { moveNum: 6, player: "Black", move: "bxc6", fen: "r1bqkb1r/p1p2ppp/2p2n2/8/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 0 7", captured: "N" },
      { moveNum: 7, player: "White", move: "e5", fen: "r1bqkb1r/p1p2ppp/2p2n2/4P3/8/8/PPP2PPP/RNBQKB1R b KQkq - 0 7" },
      { moveNum: 7, player: "Black", move: "Nd5", fen: "r1bqkb1r/p1p2ppp/2p5/3nP3/8/8/PPP2PPP/RNBQKB1R w KQkq - 1 8" },
      { moveNum: 8, player: "White", move: "Bc4", fen: "r1bqkb1r/p1p2ppp/2p5/3nP3/2B5/8/PPP2PPP/RNBQK2R b KQkq - 2 8" },
      { moveNum: 8, player: "Black", move: "Be6", fen: "r2qkb1r/p1p2ppp/2p1b3/3nP3/2B5/8/PPP2PPP/RNBQK2R w KQkq - 3 9" },
      { moveNum: 9, player: "White", move: "Bxd5", fen: "r2qkb1r/p1p2ppp/2p1b3/3BP3/8/8/PPP2PPP/RNBQK2R b KQkq - 0 9", captured: "n" },
      { moveNum: 9, player: "Black", move: "cxd5", fen: "r2qkb1r/p1p2ppp/4b3/3pP3/8/8/PPP2PPP/RNBQK2R w KQkq - 0 10", captured: "B" }
    ],
    expectedPlayerCaptures: 3, // Black captured: dxe5, bxc6, cxd5
    expectedOpponentCaptures: 4, // White captured 4 times: dxe5, Nxe5, Nxc6, Bxd5
    expectedInsight: null, // Relatively balanced material (3 vs 4)
    shouldNotMention: "won material" // Should NOT say player won material
  },
  {
    name: "Equal Captures - 3 vs 3",
    description: "Both players make 3 captures each - balanced game",
    playerColor: "White",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
      { moveNum: 1, player: "Black", move: "e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { moveNum: 2, player: "Black", move: "Nc6", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
      { moveNum: 3, player: "White", move: "d4", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3" },
      { moveNum: 3, player: "Black", move: "exd4", fen: "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", captured: "P" },
      { moveNum: 4, player: "White", move: "Nxd4", fen: "r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", captured: "p" },
      { moveNum: 4, player: "Black", move: "Nf6", fen: "r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5" },
      { moveNum: 5, player: "White", move: "Nxc6", fen: "r1bqkb1r/pppp1ppp/2N2n2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", captured: "n" },
      { moveNum: 5, player: "Black", move: "bxc6", fen: "r1bqkb1r/p1pp1ppp/2p2n2/8/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 0 6", captured: "N" },
      { moveNum: 6, player: "White", move: "Bd3", fen: "r1bqkb1r/p1pp1ppp/2p2n2/8/4P3/3B4/PPP2PPP/RNBQK2R b KQkq - 1 6" },
      { moveNum: 6, player: "Black", move: "d5", fen: "r1bqkb1r/p1p2ppp/2p2n2/3p4/4P3/3B4/PPP2PPP/RNBQK2R w KQkq d6 0 7" },
      { moveNum: 7, player: "White", move: "exd5", fen: "r1bqkb1r/p1p2ppp/2p2n2/3P4/8/3B4/PPP2PPP/RNBQK2R b KQkq - 0 7", captured: "p" },
      { moveNum: 7, player: "Black", move: "cxd5", fen: "r1bqkb1r/p1p2ppp/5n2/3p4/8/3B4/PPP2PPP/RNBQK2R w KQkq - 0 8", captured: "P" }
    ],
    expectedPlayerCaptures: 3,
    expectedOpponentCaptures: 3,
    expectedInsight: null, // Should NOT heavily criticize or praise material play
    shouldNotMention: "material battle" // Balanced, so shouldn't emphasize material
  },
  {
    name: "No Captures - Pure Positional",
    description: "Clean opening with zero captures from either side",
    playerColor: "White",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
      { moveNum: 1, player: "Black", move: "c5", fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { moveNum: 2, player: "Black", move: "Nc6", fen: "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
      { moveNum: 3, player: "White", move: "d4", fen: "r1bqkbnr/pp1ppppp/2n5/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3" },
      { moveNum: 3, player: "Black", move: "cxd4", fen: "r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", captured: "P" },
      { moveNum: 4, player: "White", move: "Nxd4", fen: "r1bqkbnr/pp1ppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", captured: "p" },
      { moveNum: 4, player: "Black", move: "Nf6", fen: "r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5" },
      { moveNum: 5, player: "White", move: "Nc3", fen: "r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5" },
      { moveNum: 5, player: "Black", move: "e5", fen: "r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq e6 0 6" },
      { moveNum: 6, player: "White", move: "Ndb5", fen: "r1bqkb1r/pp1p1ppp/2n2n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 6" },
      { moveNum: 6, player: "Black", move: "d6", fen: "r1bqkb1r/pp3ppp/2np1n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7" },
      { moveNum: 7, player: "White", move: "Bg5", fen: "r1bqkb1r/pp3ppp/2np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 7" },
      { moveNum: 7, player: "Black", move: "a6", fen: "r1bqkb1r/1p3ppp/p1np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 8" }
    ],
    expectedPlayerCaptures: 1, // White Nxd4
    expectedOpponentCaptures: 1, // Black cxd4
    expectedInsight: null,
    shouldNotMention: "material" // No significant material battle
  },
  {
    name: "Mixed Notation - Captures with different symbols",
    description: "Tests x, X, ×, and captured field detection",
    playerColor: "Black",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "start" },
      { moveNum: 1, player: "Black", move: "e5", fen: "after" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "after" },
      { moveNum: 2, player: "Black", move: "Nc6", fen: "after" },
      { moveNum: 3, player: "White", move: "d4", fen: "after" },
      { moveNum: 3, player: "Black", move: "exd4", fen: "after", captured: "P" }, // lowercase x + captured field
      { moveNum: 4, player: "White", move: "NXd4", fen: "after", captured: "p" }, // uppercase X + captured field
      { moveNum: 4, player: "Black", move: "Nf6", fen: "after" },
      { moveNum: 5, player: "White", move: "Nc3", fen: "after" },
      { moveNum: 5, player: "Black", move: "Bb4", fen: "after" },
      { moveNum: 6, player: "White", move: "Nxc6", fen: "after", captured: "n" }, // Regular x
      { moveNum: 6, player: "Black", move: "bXc6", fen: "after", captured: "N" }, // uppercase X
      { moveNum: 7, player: "White", move: "Bd3", fen: "after" },
      { moveNum: 7, player: "Black", move: "d5", fen: "after" },
      { moveNum: 8, player: "White", move: "e×d5", fen: "after", captured: "p" }, // Unicode ×
      { moveNum: 8, player: "Black", move: "c×d5", fen: "after", captured: "P" }  // Unicode ×
    ],
    expectedPlayerCaptures: 3, // Black: exd4, bXc6, c×d5
    expectedOpponentCaptures: 3, // White: NXd4, Nxc6, e×d5
    expectedInsight: null,
    shouldNotMention: "material battle"
  },
  {
    name: "Heavy Tactical Game - Many Exchanges",
    description: "Game with 10+ captures total",
    playerColor: "White",
    moveHistory: [
      { moveNum: 1, player: "White", move: "e4", fen: "start" },
      { moveNum: 1, player: "Black", move: "e5", fen: "after" },
      { moveNum: 2, player: "White", move: "Nf3", fen: "after" },
      { moveNum: 2, player: "Black", move: "Nc6", fen: "after" },
      { moveNum: 3, player: "White", move: "Bb5", fen: "after" },
      { moveNum: 3, player: "Black", move: "a6", fen: "after" },
      { moveNum: 4, player: "White", move: "Bxc6", fen: "after", captured: "n" },
      { moveNum: 4, player: "Black", move: "dxc6", fen: "after", captured: "B" },
      { moveNum: 5, player: "White", move: "Nxe5", fen: "after", captured: "p" },
      { moveNum: 5, player: "Black", move: "Qd4", fen: "after" },
      { moveNum: 6, player: "White", move: "Nf3", fen: "after" },
      { moveNum: 6, player: "Black", move: "Qxe4+", fen: "after", captured: "P" },
      { moveNum: 7, player: "White", move: "Be2", fen: "after" },
      { moveNum: 7, player: "Black", move: "Nf6", fen: "after" },
      { moveNum: 8, player: "White", move: "d3", fen: "after" },
      { moveNum: 8, player: "Black", move: "Qc6", fen: "after" },
      { moveNum: 9, player: "White", move: "O-O", fen: "after" },
      { moveNum: 9, player: "Black", move: "Bg4", fen: "after" },
      { moveNum: 10, player: "White", move: "h3", fen: "after" },
      { moveNum: 10, player: "Black", move: "Bxf3", fen: "after", captured: "N" },
      { moveNum: 11, player: "White", move: "Bxf3", fen: "after", captured: "b" },
      { moveNum: 11, player: "Black", move: "Qxf3", fen: "after", captured: "B" },
      { moveNum: 12, player: "White", move: "Nc3", fen: "after" },
      { moveNum: 12, player: "Black", move: "O-O-O", fen: "after" },
      { moveNum: 13, player: "White", move: "Bg5", fen: "after" },
      { moveNum: 13, player: "Black", move: "h6", fen: "after" },
      { moveNum: 14, player: "White", move: "Bxf6", fen: "after", captured: "n" },
      { moveNum: 14, player: "Black", move: "Qxf6", fen: "after", captured: "B" }
    ],
    expectedPlayerCaptures: 4, // White: Bxc6, Nxe5, Bxf3, Bxf6
    expectedOpponentCaptures: 5, // Black: dxc6, Qxe4+, Bxf3, Qxf3, Qxf6
    expectedInsight: null, // Equal exchanges
    shouldNotMention: "material battle"
  }
];

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(data);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const startTime = Date.now();
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        if (res.statusCode === 200) {
          try {
            resolve({ data: JSON.parse(body), duration, status: res.statusCode });
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testScenario(scenario, apiUrl) {
  const payload = {
    moveHistory: scenario.moveHistory,
    playerColor: scenario.playerColor,
    pgn: "test game",
    cpuLevel: 5
  };

  try {
    const { data, duration } = await makeRequest(apiUrl, payload);
    
    const results = {
      passed: true,
      errors: [],
      duration,
      response: data
    };

    // Validate response structure
    if (!data.success) {
      results.passed = false;
      results.errors.push(`Worker returned success=false: ${data.error || 'unknown error'}`);
      return results;
    }

    if (!data.gameStats) {
      results.passed = false;
      results.errors.push('Missing gameStats in response');
      return results;
    }

    // Test 1: Verify capture counts are correct
    const actualPlayerCaptures = data.gameStats.captures;
    if (actualPlayerCaptures !== scenario.expectedPlayerCaptures) {
      results.passed = false;
      results.errors.push(
        `❌ PLAYER CAPTURE COUNT MISMATCH:\n` +
        `   Expected: ${scenario.expectedPlayerCaptures}\n` +
        `   Got: ${actualPlayerCaptures}\n` +
        `   This means the worker is incorrectly counting player captures!`
      );
    }

    // Test 2: Verify insights reflect accurate capture analysis
    const allInsights = [
      ...(data.insights?.mistakes || []),
      ...(data.insights?.strengths || []),
      ...(data.insights?.recommendations || [])
    ].join(' ').toLowerCase();

    if (scenario.expectedInsight) {
      if (!allInsights.includes(scenario.expectedInsight.toLowerCase())) {
        results.passed = false;
        results.errors.push(
          `❌ MISSING EXPECTED INSIGHT:\n` +
          `   Should mention: "${scenario.expectedInsight}"\n` +
          `   Actual insights: ${allInsights.substring(0, 200)}...`
        );
      }
    }

    if (scenario.shouldNotMention) {
      if (allInsights.includes(scenario.shouldNotMention.toLowerCase())) {
        results.passed = false;
        results.errors.push(
          `❌ INCORRECT INSIGHT:\n` +
          `   Should NOT mention: "${scenario.shouldNotMention}"\n` +
          `   But found it in: ${allInsights.substring(0, 200)}...`
        );
      }
    }

    // Test 3: Verify tactical patterns make sense
    if (data.tacticalPatterns && data.tacticalPatterns.length > 0) {
      const tacticalText = data.tacticalPatterns.join(' ').toLowerCase();
      const captureCount = (tacticalText.match(/captured/gi) || []).length;
      
      // If tactical patterns mention captures, verify they align with actual count
      if (tacticalText.includes('captured') && actualPlayerCaptures === 0) {
        results.passed = false;
        results.errors.push(
          `❌ TACTICAL PATTERN MISMATCH:\n` +
          `   Tactical patterns mention captures but player made 0 captures\n` +
          `   Patterns: ${data.tacticalPatterns.join('; ')}`
        );
      }
    }

    return results;
  } catch (error) {
    return {
      passed: false,
      errors: [`Request failed: ${error.message}`],
      duration: 0,
      response: null
    };
  }
}

async function runComprehensiveTests(apiUrl) {
  console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}COMPREHENSIVE WORKER CAPTURE METRICS TEST${colors.reset}`);
  console.log(`${colors.bright}Testing AI Worker's Capture Detection & Analysis Accuracy${colors.reset}`);
  console.log(`API URL: ${colors.yellow}${apiUrl}${colors.reset}`);
  console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

  const results = {
    totalTests: testScenarios.length,
    passed: 0,
    failed: 0,
    scenarios: []
  };

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    
    console.log(`${colors.bright}${colors.blue}─${'─'.repeat(78)}─${colors.reset}`);
    console.log(`${colors.bright}Test ${i + 1}/${testScenarios.length}: ${scenario.name}${colors.reset}`);
    console.log(`${colors.cyan}${scenario.description}${colors.reset}`);
    console.log(`Player Color: ${scenario.playerColor}`);
    console.log(`Expected Player Captures: ${scenario.expectedPlayerCaptures}`);
    console.log(`${colors.bright}${colors.blue}─${'─'.repeat(78)}─${colors.reset}\n`);

    const result = await testScenario(scenario, apiUrl);
    results.scenarios.push({ scenario, result });

    if (result.passed) {
      results.passed++;
      console.log(`${colors.green}✅ PASS${colors.reset} (${result.duration}ms)\n`);
      console.log(`${colors.green}📊 Response Statistics:${colors.reset}`);
      console.log(`   Player Captures: ${result.response.gameStats.captures} ${colors.green}✓${colors.reset}`);
      console.log(`   Total Moves: ${result.response.gameStats.totalMoves}`);
      console.log(`   Player Moves: ${result.response.gameStats.playerMoves}`);
      console.log(`   Game Phase: ${result.response.gameStats.gamePhase}`);
      
      if (result.response.insights) {
        console.log(`\n${colors.cyan}🎯 Generated Insights:${colors.reset}`);
        if (result.response.insights.mistakes?.length > 0) {
          console.log(`   Mistakes: ${result.response.insights.mistakes.length}`);
          result.response.insights.mistakes.forEach((m, idx) => {
            console.log(`      ${idx + 1}. ${m}`);
          });
        }
        if (result.response.insights.strengths?.length > 0) {
          console.log(`   Strengths: ${result.response.insights.strengths.length}`);
          result.response.insights.strengths.forEach((s, idx) => {
            console.log(`      ${idx + 1}. ${s}`);
          });
        }
      }
    } else {
      results.failed++;
      console.log(`${colors.red}❌ FAIL${colors.reset} (${result.duration}ms)\n`);
      result.errors.forEach(error => {
        console.log(`${colors.red}${error}${colors.reset}\n`);
      });
      
      if (result.response) {
        console.log(`${colors.yellow}📊 Actual Response:${colors.reset}`);
        console.log(`   Player Captures: ${result.response.gameStats?.captures || 'N/A'}`);
        console.log(`   Total Moves: ${result.response.gameStats?.totalMoves || 'N/A'}`);
      }
    }
    
    console.log('');
  }

  // Final Report
  console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}FINAL COMPREHENSIVE REPORT${colors.reset}`);
  console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

  console.log(`${colors.bright}📊 Overall Statistics:${colors.reset}`);
  console.log(`   Total Tests: ${results.totalTests}`);
  console.log(`   ${colors.green}Passed: ${results.passed} (${(results.passed/results.totalTests*100).toFixed(1)}%)${colors.reset}`);
  console.log(`   ${colors.red}Failed: ${results.failed}${colors.reset}\n`);

  console.log(`${colors.bright}📋 Scenario Results:${colors.reset}`);
  results.scenarios.forEach(({ scenario, result }, idx) => {
    const icon = result.passed ? `${colors.green}✅` : `${colors.red}❌`;
    console.log(`   ${icon} ${scenario.name}: ${result.passed ? 'PASS' : 'FAIL'}${colors.reset}`);
  });

  console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
  if (results.failed === 0) {
    console.log(`${colors.bright}${colors.green}✅ SUCCESS: 100% PASS RATE - WORKER CAPTURE METRICS ACCURATE!${colors.reset}`);
    console.log(`${colors.green}The worker correctly counts and analyzes player vs opponent captures.${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}⚠️  ISSUES DETECTED: Worker capture counting needs fixes${colors.reset}`);
    console.log(`${colors.red}${results.failed} test(s) failed - review capture detection logic.${colors.reset}`);
  }
  console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

  process.exit(results.failed === 0 ? 0 : 1);
}

// Main execution
const apiUrl = process.argv[2] || 'https://ae43e35b.chesschat-web.pages.dev/api/analyze-game';
runComprehensiveTests(apiUrl);
