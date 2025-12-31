/**
 * Mock Backend for Local Development
 * 
 * Simple Express server that mocks the Cloudflare Functions API
 * for local testing without Wrangler's module resolution issues.
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = 8787;

// Middleware
app.use(cors());
app.use(express.json());

// Mock admin password
const ADMIN_PASSWORD = 'ChessAdmin2025!';
const sessions = new Map<string, { expiresAt: Date }>();

// Helper: Generate session token
function generateToken(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Verify session
function verifySession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// POST /api/admin/auth/unlock
app.post('/api/admin/auth/unlock', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    
    sessions.set(token, { expiresAt });
    
    res.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString()
    });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// POST /api/admin/auth/logout
app.post('/api/admin/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'] as string;
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true });
});

// Middleware: Require auth
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'] as string;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  
  console.log(`[AUTH] Checking token: ${token ? token.substring(0, 15) + '...' : 'none'}`);
  
  if (!token || !verifySession(token)) {
    console.log('[AUTH] Unauthorized - invalid or missing token');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('[AUTH] Token verified successfully');
  next();
}

// GET /api/admin/knowledge/sources
app.get('/api/admin/knowledge/sources', requireAuth, async (req, res) => {
  // Mock response matching Prisma format
  res.json({
    sources: [
      { 
        id: '1', 
        title: 'Chess Tactics: Essential Patterns for Improvement', 
        sourceType: 'markdown', 
        url: null,
        isDeleted: false, 
        _count: { chunks: 14 },
        keyTakeaways: ['Pin traps more valuable pieces behind less valuable ones', 'Forks attack multiple pieces simultaneously', 'Discovered attacks occur when moving one piece reveals another', 'Deflection forces enemy pieces from key squares'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        id: '2', 
        title: 'Opening Principles: Building a Strong Foundation', 
        sourceType: 'markdown', 
        url: null,
        isDeleted: false, 
        _count: { chunks: 13 },
        keyTakeaways: ['Control the center squares (e4, d4, e5, d5)', 'Develop knights and bishops early', 'Castle within first 10 moves', 'Connect rooks after castling'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        id: '3', 
        title: 'Endgame Fundamentals: Converting Advantages to Victory', 
        sourceType: 'markdown', 
        url: null,
        isDeleted: false, 
        _count: { chunks: 15 },
        keyTakeaways: ['Activate your king in the endgame', 'Create passed pawns to win', 'Opposition gives king control', 'Rook behind passed pawns is best placement'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        id: '4', 
        title: 'Popular Chess Openings: A Comprehensive Guide', 
        sourceType: 'markdown', 
        url: null,
        isDeleted: false, 
        _count: { chunks: 74 },
        keyTakeaways: ['Sicilian Defense (1.e4 c5) - most aggressive Black response', 'Queen\'s Gambit (1.d4 d5 2.c4) - classic positional opening', 'Italian Game focuses on rapid development', 'Understanding opening ideas matters more than memorizing moves'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        id: '5', 
        title: 'Chess Rules: Complete Guide for Beginners', 
        sourceType: 'markdown', 
        url: 'https://www.chess.com/learn-how-to-play-chess',
        isDeleted: false, 
        _count: { chunks: 18 },
        keyTakeaways: ['White always moves first', 'The king can move one square in any direction', 'Pawns can only capture diagonally forward', 'Castling requires king and rook to have never moved', 'Checkmate ends the game - draw if stalemate occurs'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    totalCount: 5,
    page: 1,
    totalPages: 1
  });
});

// GET /api/admin/knowledge/sources/:id/chunks
app.get('/api/admin/knowledge/sources/:id/chunks', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  // Mock chunks based on source ID
  const mockChunks = {
    '1': [
      { 
        id: 'c1', 
        chunkText: '## Pin\n\nA pin is a tactical motif where an attacking piece targets a valuable piece behind a less valuable piece. The pinned piece cannot move without exposing a more valuable piece behind it.', 
        tags: JSON.stringify(['tactics', 'pin']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c2', 
        chunkText: '## Fork\n\nA fork (or double attack) occurs when a single piece attacks two or more enemy pieces simultaneously. The knight fork is the most common type.', 
        tags: JSON.stringify(['tactics', 'fork']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1a', 
        chunkText: '## Skewer\n\nA skewer is the reverse of a pin - it forces a valuable piece to move, exposing a less valuable piece behind it. Often called a "reverse pin".', 
        tags: JSON.stringify(['tactics', 'skewer']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1b', 
        chunkText: '## Discovered Attack\n\nA discovered attack occurs when one piece moves, revealing an attack from another piece behind it. Particularly powerful when the moving piece also makes a threat.', 
        tags: JSON.stringify(['tactics', 'discovered-attack']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1c', 
        chunkText: '## Discovered Check\n\nA special type of discovered attack where the revealed piece gives check. The moving piece can capture material freely since the opponent must deal with the check.', 
        tags: JSON.stringify(['tactics', 'discovered-check', 'check']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1d', 
        chunkText: '## Double Check\n\nWhen two pieces give check simultaneously. The king must move since blocking or capturing only addresses one threat.', 
        tags: JSON.stringify(['tactics', 'double-check', 'check']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1e', 
        chunkText: '## Deflection\n\nForcing an enemy piece away from a key square or defensive duty, usually through a sacrifice or threat.', 
        tags: JSON.stringify(['tactics', 'deflection']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1f', 
        chunkText: '## Decoy\n\nLuring an enemy piece to a square where it can be attacked or where it blocks its own pieces. Often involves a sacrifice.', 
        tags: JSON.stringify(['tactics', 'decoy', 'sacrifice']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1g', 
        chunkText: '## Zwischenzug (In-Between Move)\n\nAn unexpected intermediate move that disrupts the expected sequence, often turning the tables on the opponent.', 
        tags: JSON.stringify(['tactics', 'zwischenzug', 'intermediate-move']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1h', 
        chunkText: '## Removal of Defender\n\nCapturing or deflecting a piece that defends an important square or piece, allowing you to capture what was defended.', 
        tags: JSON.stringify(['tactics', 'removal-defender']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1i', 
        chunkText: '## Overloading\n\nGiving a piece too many defensive duties so it cannot fulfill all of them. Also called overworking.', 
        tags: JSON.stringify(['tactics', 'overloading']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1j', 
        chunkText: '## Trapped Piece\n\nCreating a situation where an enemy piece has no safe squares to move to and will be captured.', 
        tags: JSON.stringify(['tactics', 'trapped-piece']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1k', 
        chunkText: '## Clearance\n\nClearing a line, diagonal, or square for your pieces by moving or sacrificing another piece out of the way.', 
        tags: JSON.stringify(['tactics', 'clearance', 'sacrifice']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c1l', 
        chunkText: '## X-Ray Attack\n\nAn indirect attack through an enemy piece, often setting up tactics if that piece moves.', 
        tags: JSON.stringify(['tactics', 'xray-attack']),
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ],
    '2': [
      { 
        id: 'c3', 
        chunkText: '## Control the Center\n\nThe center squares (e4, d4, e5, d5) are the most important squares on the board. Controlling these squares gives your pieces more mobility and influence.', 
        tags: JSON.stringify(['opening', 'center']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3a', 
        chunkText: '## Develop Your Pieces\n\nBring your knights and bishops out early. Develop with purpose - each move should contribute to your position.', 
        tags: JSON.stringify(['opening', 'development']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3b', 
        chunkText: '## Castle Early\n\nCastling moves your king to safety and connects your rooks. Try to castle within the first 10 moves.', 
        tags: JSON.stringify(['opening', 'king-safety', 'castling']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3c', 
        chunkText: '## Don\'t Move the Same Piece Twice\n\nIn the opening, avoid moving the same piece multiple times unless necessary. Develop all your pieces first.', 
        tags: JSON.stringify(['opening', 'development', 'tempo']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3d', 
        chunkText: '## Don\'t Bring Queen Out Early\n\nAvoiding bringing your queen out too early where it can be attacked with tempo by developing enemy pieces.', 
        tags: JSON.stringify(['opening', 'queen', 'tempo']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3e', 
        chunkText: '## Knights Before Bishops\n\nGenerally develop knights before bishops since knights have fewer good squares and it\'s easier to decide where they belong.', 
        tags: JSON.stringify(['opening', 'development', 'knights', 'bishops']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3f', 
        chunkText: '## Connect Your Rooks\n\nAfter castling and developing minor pieces, connect your rooks by developing your queen. Rooks work best when connected.', 
        tags: JSON.stringify(['opening', 'rooks', 'coordination']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3g', 
        chunkText: '## Control Key Diagonals\n\nPlace your bishops on long diagonals where they control important squares and put pressure on the opponent.', 
        tags: JSON.stringify(['opening', 'bishops', 'diagonals']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3h', 
        chunkText: '## Avoid Pawn Weaknesses\n\nDon\'t create holes, isolated pawns, or doubled pawns in the opening unless you get compensation.', 
        tags: JSON.stringify(['opening', 'pawns', 'structure']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3i', 
        chunkText: '## Fight for the Center\n\nEven if you don\'t occupy the center with pawns, challenge your opponent\'s central control with pieces.', 
        tags: JSON.stringify(['opening', 'center', 'control']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3j', 
        chunkText: '## Develop with Threats\n\nWhen possible, develop pieces while creating threats that your opponent must respond to.', 
        tags: JSON.stringify(['opening', 'development', 'tempo', 'threats']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3k', 
        chunkText: '## Understand Pawn Breaks\n\nLearn the key pawn breaks for your opening system - moves like d4, e4, c5, or f5 that open the position.', 
        tags: JSON.stringify(['opening', 'pawns', 'pawn-breaks']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c3l', 
        chunkText: '## Complete Your Development\n\nDon\'t launch an attack until all your pieces are developed. Premature attacks often fail.', 
        tags: JSON.stringify(['opening', 'development', 'strategy']),
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ],
    '3': [
      { 
        id: 'c4', 
        chunkText: '## King Activity\n\nIn the endgame, the king transforms from a liability to a powerful piece. Activate your king early in the endgame to support pawns and attack enemy pawns.', 
        tags: JSON.stringify(['endgame', 'king-activity']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4a', 
        chunkText: '## Passed Pawns Must Be Pushed\n\nPassed pawns increase in value dramatically in the endgame. Push them forward to tie down enemy pieces.', 
        tags: JSON.stringify(['endgame', 'passed-pawns']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4b', 
        chunkText: '## Rooks Behind Passed Pawns\n\nPlace your rooks behind your own passed pawns or behind enemy passed pawns to attack or support them.', 
        tags: JSON.stringify(['endgame', 'rooks', 'passed-pawns']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4c', 
        chunkText: '## Opposition\n\nIn king and pawn endgames, having the opposition means your king faces the enemy king with one square between them, and it\'s the opponent\'s turn.', 
        tags: JSON.stringify(['endgame', 'king', 'opposition']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4d', 
        chunkText: '## Rook on the Seventh Rank\n\nA rook on the opponent\'s second rank (seventh for White, second for Black) is very powerful, attacking pawns and restricting the king.', 
        tags: JSON.stringify(['endgame', 'rooks', 'seventh-rank']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4e', 
        chunkText: '## Cut Off the King\n\nUse your rook to cut off the enemy king from the action, preventing it from supporting pawns or pieces.', 
        tags: JSON.stringify(['endgame', 'rooks', 'king', 'cutoff']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4f', 
        chunkText: '## Lucena Position\n\nA fundamental winning position in rook endgames where the attacking side builds a bridge to escort the pawn to promotion.', 
        tags: JSON.stringify(['endgame', 'rook-endgame', 'lucena', 'technique']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4g', 
        chunkText: '## Philidor Position\n\nThe main defensive setup in rook and pawn endgames - defending from the side and giving checks from behind.', 
        tags: JSON.stringify(['endgame', 'rook-endgame', 'philidor', 'defense']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4h', 
        chunkText: '## Bishop vs Knight\n\nBishops are generally better in open positions with pawns on both sides. Knights excel in closed positions and with pawns on one side.', 
        tags: JSON.stringify(['endgame', 'bishops', 'knights', 'minor-pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4i', 
        chunkText: '## Good vs Bad Bishop\n\nA bishop is "bad" when blocked by its own pawns on the same color. Convert to a "good" bishop by repositioning pawns.', 
        tags: JSON.stringify(['endgame', 'bishops', 'good-bad-bishop']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4j', 
        chunkText: '## Square of the Pawn\n\nA geometric rule to determine if a king can catch a passed pawn - if the king is inside the square, it can catch it.', 
        tags: JSON.stringify(['endgame', 'king', 'pawns', 'rule-of-square']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4k', 
        chunkText: '## Triangulation\n\nA king maneuver to lose a tempo and put the opponent in zugzwang - making them move when any move worsens their position.', 
        tags: JSON.stringify(['endgame', 'king', 'triangulation', 'zugzwang']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4l', 
        chunkText: '## Fortress Positions\n\nSome materially disadvantaged positions can be held by creating an impenetrable fortress that the opponent cannot break.', 
        tags: JSON.stringify(['endgame', 'fortress', 'defense', 'drawing']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4m', 
        chunkText: '## Queen vs Rook\n\nThe queen usually wins, but the defending side should keep the rook close to the king and avoid checks that separate them.', 
        tags: JSON.stringify(['endgame', 'queen', 'rook', 'basic-endgame']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c4n', 
        chunkText: '## Pawn Majority\n\nHaving more pawns on one side of the board creates winning chances by creating a passed pawn through advancement.', 
        tags: JSON.stringify(['endgame', 'pawns', 'pawn-majority', 'strategy']),
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ],
    '4': [
      { 
        id: 'c5', 
        chunkText: '## Sicilian Defense (1.e4 c5)\n\nThe Sicilian Defense is the most popular and aggressive response to 1.e4. Black immediately fights for the center and creates an imbalanced position, leading to sharp tactical play.\n\n**Key Ideas:**\n- Fight for the d4 square\n- Create counterplay on the queenside with ...b5\n- Castle kingside and launch a pawn storm\n- Exchange the light-squared bishop early', 
        tags: JSON.stringify(['opening', 'sicilian', 'aggressive', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c6', 
        chunkText: '## French Defense (1.e4 e6)\n\nA solid, strategic opening where Black accepts a slightly cramped position in exchange for a rock-solid pawn structure and counterplay on the queenside.\n\n**Key Ideas:**\n- Build a strong pawn chain\n- Attack White\'s pawn center with ...c5 or ...f6\n- Develop the light-squared bishop before playing ...e6\n- Create queenside play with ...b6 and ...Ba6', 
        tags: JSON.stringify(['opening', 'french', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c7', 
        chunkText: '## Caro-Kann Defense (1.e4 c6)\n\nOne of the most solid defenses against 1.e4, the Caro-Kann leads to positions with fewer weaknesses than the French Defense.\n\n**Key Ideas:**\n- Support the d5 pawn break with c6\n- Develop the light-squared bishop outside the pawn chain\n- Fight for control of the e4 square\n- Aim for a solid, slightly passive but safe position', 
        tags: JSON.stringify(['opening', 'caro-kann', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c8', 
        chunkText: '## Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4)\n\nOne of the oldest and most classical openings, the Italian Game focuses on rapid development and control of the center.\n\n**Key Ideas:**\n- Develop pieces toward the center\n- Prepare d4 advance to open the position\n- Castle quickly\n- Create threats against f7', 
        tags: JSON.stringify(['opening', 'italian', 'classical', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c9', 
        chunkText: '## Spanish Opening (Ruy Lopez) (1.e4 e5 2.Nf3 Nc6 3.Bb5)\n\nThe Spanish Opening is considered one of the strongest and most strategic ways to play after 1.e4 e5.\n\n**Key Ideas:**\n- Pressure the e5 pawn indirectly\n- Prepare d4 to dominate the center\n- Castle and build a strong pawn center\n- Maneuver pieces to optimal squares', 
        tags: JSON.stringify(['opening', 'spanish', 'ruy-lopez', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c10', 
        chunkText: '## Queen\'s Gambit (1.d4 d5 2.c4)\n\nThe Queen\'s Gambit is one of the oldest and most respected openings, offering White excellent control of the center.\n\n**Key Ideas:**\n- Pressure Black\'s d5 pawn\n- Control the center with pawns\n- Develop pieces harmoniously\n- Create long-term positional pressure', 
        tags: JSON.stringify(['opening', 'queens-gambit', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c11', 
        chunkText: '## King\'s Indian Defense (1.d4 Nf6 2.c4 g6 3.Nc3 Bg7)\n\nA hypermodern opening where Black allows White to build a strong center, planning to attack it later with pawn breaks.\n\n**Key Ideas:**\n- Fianchetto the kingside bishop\n- Castle kingside quickly\n- Prepare the ...e5 or ...c5 pawn break\n- Create dynamic counterplay', 
        tags: JSON.stringify(['opening', 'kings-indian', 'hypermodern', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c12', 
        chunkText: '## Nimzo-Indian Defense (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)\n\nA sophisticated opening that pins White\'s knight and fights for central control without occupying the center with pawns.\n\n**Key Ideas:**\n- Pin the knight on c3\n- Control e4 square\n- Create doubled pawns on c-file if White captures on b4\n- Develop pieces harmoniously', 
        tags: JSON.stringify(['opening', 'nimzo-indian', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c13', 
        chunkText: '## English Opening (1.c4)\n\nA flexible opening that can transpose into many different structures, the English Opening allows White to avoid main-line theory.\n\n**Key Ideas:**\n- Control d5 square from the side\n- Develop flexibly based on Black\'s setup\n- Fianchetto kingside bishop often\n- Maintain positional pressure', 
        tags: JSON.stringify(['opening', 'english', 'flexible']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c14', 
        chunkText: '## London System (1.d4 d5 2.Bf4)\n\nA solid, system-based opening that leads to quiet, strategic positions with easy development for White.\n\n**Key Ideas:**\n- Develop bishop to f4 early\n- Build a solid pawn structure with e3 and Nf3\n- Castle kingside\n- Create slow but steady pressure', 
        tags: JSON.stringify(['opening', 'london', 'system', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c15', 
        chunkText: '## Alekhine Defense (1.e4 Nf6) [ECO B02-B05]\n\nA hypermodern defense where Black invites White to build a large pawn center, planning to attack and undermine it later.\n\n**Key Ideas:**\n- Provoke White\'s pawns forward with ...Nf6\n- Attack the extended center with ...d6 and ...c5\n- Counterattack on the queenside\n- Excellent surprise weapon', 
        tags: JSON.stringify(['opening', 'alekhine', 'hypermodern', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c16', 
        chunkText: '## Pirc Defense (1.e4 d6 2.d4 Nf6 3.Nc3 g6) [ECO B07-B09]\n\nA flexible hypermodern defense where Black fianchettoes the kingside bishop and aims for dynamic counterplay.\n\n**Key Ideas:**\n- Fianchetto kingside bishop on g7\n- Control center from distance\n- Prepare ...e5 or ...c5 counterattack\n- Keep position flexible', 
        tags: JSON.stringify(['opening', 'pirc', 'hypermodern', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c17', 
        chunkText: '## Scandinavian Defense (1.e4 d5) [ECO B01]\n\nAn aggressive counterattack where Black immediately challenges White\'s e4 pawn on move one.\n\n**Key Ideas:**\n- Challenge e4 immediately with ...d5\n- Recapture with queen (2...Qxd5) or knight\n- Develop quickly to compensate for early queen moves\n- Simple and straightforward play', 
        tags: JSON.stringify(['opening', 'scandinavian', 'aggressive', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c18', 
        chunkText: '## Scotch Game (1.e4 e5 2.Nf3 Nc6 3.d4) [ECO C44-C45]\n\nAn aggressive opening where White immediately strikes at Black\'s e5 pawn to open the center.\n\n**Key Ideas:**\n- Open the center early with d4\n- Quick piece development\n- Control center with pieces, not pawns\n- Popular at all levels', 
        tags: JSON.stringify(['opening', 'scotch', 'aggressive', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c19', 
        chunkText: '## Four Knights Game (1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6) [ECO C46-C49]\n\nA classical opening focusing on symmetrical development and solid principles.\n\n**Key Ideas:**\n- Develop all knights before bishops\n- Control center naturally\n- Maintain symmetry or break it strategically\n- Solid and reliable', 
        tags: JSON.stringify(['opening', 'four-knights', 'classical', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c20', 
        chunkText: '## Vienna Game (1.e4 e5 2.Nc3) [ECO C25-C29]\n\nA flexible opening that can lead to calm positional play or sharp tactical complications.\n\n**Key Ideas:**\n- Develop knight to c3 early\n- Prepare f4 gambit or positional play\n- Maintain flexibility\n- Surprise value for club players', 
        tags: JSON.stringify(['opening', 'vienna', 'flexible', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c21', 
        chunkText: '## King\'s Gambit (1.e4 e5 2.f4) [ECO C30-C39]\n\nOne of the oldest chess openings, offering a pawn for rapid development and attacking chances.\n\n**Key Ideas:**\n- Sacrifice f-pawn for open f-file\n- Rapid piece development\n- Attack Black\'s king\n- Romantic, aggressive style', 
        tags: JSON.stringify(['opening', 'kings-gambit', 'gambit', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c22', 
        chunkText: '## Petrov Defense (1.e4 e5 2.Nf3 Nf6) [ECO C42-C43]\n\nA solid and symmetrical defense where Black immediately counterattacks White\'s e4 pawn.\n\n**Key Ideas:**\n- Counter-attack e4 with ...Nf6\n- Maintain symmetry when advantageous\n- Solid pawn structure\n- Reliable drawing weapon', 
        tags: JSON.stringify(['opening', 'petrov', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c23', 
        chunkText: '## Dutch Defense (1.d4 f5) [ECO A80-A99]\n\nAn aggressive response to 1.d4 where Black immediately fights for the e4 square.\n\n**Key Ideas:**\n- Control e4 square with ...f5\n- Kingside attacking chances\n- Fianchetto kingside bishop (Leningrad Dutch)\n- Sharp tactical play', 
        tags: JSON.stringify(['opening', 'dutch', 'aggressive', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c24', 
        chunkText: '## Grünfeld Defense (1.d4 Nf6 2.c4 g6 3.Nc3 d5) [ECO D70-D99]\n\nA hypermodern defense where Black allows White a big center to counterattack it dynamically.\n\n**Key Ideas:**\n- Allow White\'s big pawn center\n- Fianchetto kingside bishop\n- Counterattack with ...d5 and ...c5\n- Dynamic, tactical play', 
        tags: JSON.stringify(['opening', 'grunfeld', 'hypermodern', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c25', 
        chunkText: '## Queen\'s Indian Defense (1.d4 Nf6 2.c4 e6 3.Nf3 b6) [ECO E12-E19]\n\nA solid defense where Black fianchettoes the queenside bishop to control key central squares.\n\n**Key Ideas:**\n- Fianchetto queenside bishop\n- Control e4 square from distance\n- Flexible pawn structure\n- Solid and reliable', 
        tags: JSON.stringify(['opening', 'queens-indian', 'solid', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c26', 
        chunkText: '## Benoni Defense (1.d4 Nf6 2.c4 c5) [ECO A56-A79]\n\nAn asymmetrical defense creating imbalanced positions and counterplay opportunities.\n\n**Key Ideas:**\n- Create pawn tension with ...c5\n- Queenside pawn majority\n- Kingside piece play\n- Tactical complications', 
        tags: JSON.stringify(['opening', 'benoni', 'aggressive', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c27', 
        chunkText: '## Bogo-Indian Defense (1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+) [ECO E11]\n\nA flexible defense that checks White\'s development and avoids main-line theory.\n\n**Key Ideas:**\n- Check on b4 early\n- Exchange bishop for knight\n- Solid pawn structure\n- Less theoretical than Nimzo-Indian', 
        tags: JSON.stringify(['opening', 'bogo-indian', 'flexible', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c28', 
        chunkText: '## Catalan Opening (1.d4 Nf6 2.c4 e6 3.g3) [ECO E00-E09]\n\nA positional opening combining Queen\'s Gambit ideas with kingside fianchetto.\n\n**Key Ideas:**\n- Fianchetto kingside bishop\n- Pressure Black\'s queenside\n- Control long diagonal\n- Subtle positional advantage', 
        tags: JSON.stringify(['opening', 'catalan', 'positional', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c29', 
        chunkText: '## Slav Defense (1.d4 d5 2.c4 c6) [ECO D10-D19]\n\nA solid defense where Black supports the d5 pawn with c6 instead of e6.\n\n**Key Ideas:**\n- Support d5 with c6 pawn\n- Keep light-squared bishop active\n- Solid pawn structure\n- Flexible piece placement', 
        tags: JSON.stringify(['opening', 'slav', 'solid', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c30', 
        chunkText: '## Semi-Slav Defense (1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6) [ECO D43-D49]\n\nCombines ideas from Slav and Queen\'s Gambit Declined for complex middlegame positions.\n\n**Key Ideas:**\n- Solid center with c6 and e6\n- Control center squares\n- Rich strategic possibilities\n- Popular at highest levels', 
        tags: JSON.stringify(['opening', 'semi-slav', 'complex', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c31', 
        chunkText: '## Budapest Gambit (1.d4 Nf6 2.c4 e5) [ECO A51-A52]\n\nAn aggressive gambit where Black sacrifices a pawn for rapid development.\n\n**Key Ideas:**\n- Sacrifice e5 pawn temporarily\n- Rapid piece development\n- Attack White\'s center\n- Surprise weapon', 
        tags: JSON.stringify(['opening', 'budapest', 'gambit', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c32', 
        chunkText: '## Réti Opening (1.Nf3) [ECO A04-A09]\n\nA flexible hypermodern opening that can transpose into various structures.\n\n**Key Ideas:**\n- Develop knight first\n- Maintain flexibility\n- Control center from distance\n- Transpose to favorable structures', 
        tags: JSON.stringify(['opening', 'reti', 'hypermodern', 'flexible']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c33', 
        chunkText: '## Bird Opening (1.f4) [ECO A02-A03]\n\nAn unorthodox opening controlling e5 with the f-pawn from move one.\n\n**Key Ideas:**\n- Control e5 square early\n- Kingside expansion\n- Fianchetto kingside bishop\n- Surprise value', 
        tags: JSON.stringify(['opening', 'bird', 'unorthodox']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c34', 
        chunkText: '## Torre Attack (1.d4 Nf6 2.Nf3 e6 3.Bg5) [ECO A46-A47]\n\nA solid system where White develops the bishop to g5 early.\n\n**Key Ideas:**\n- Pin knight on f6\n- Simple development\n- Solid pawn structure\n- Less theoretical preparation', 
        tags: JSON.stringify(['opening', 'torre', 'system', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c35', 
        chunkText: '## Trompowsky Attack (1.d4 Nf6 2.Bg5) [ECO A45]\n\nAn aggressive system attacking Black\'s knight immediately.\n\n**Key Ideas:**\n- Attack f6 knight early\n- Avoid main-line theory\n- Create pawn weaknesses\n- Tactical complications', 
        tags: JSON.stringify(['opening', 'trompowsky', 'aggressive', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c36', 
        chunkText: '## Colle System (1.d4 d5 2.Nf3 Nf6 3.e3) [ECO D04-D05]\n\nA quiet system with a standard setup regardless of Black\'s moves.\n\n**Key Ideas:**\n- Standard setup with e3, Bd3, Nbd2\n- Prepare e4 break\n- Solid structure\n- Easy to learn', 
        tags: JSON.stringify(['opening', 'colle', 'system', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c37', 
        chunkText: '## Evans Gambit (1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4) [ECO C51-C52]\n\nA romantic-era gambit sacrificing a pawn for rapid development and attack.\n\n**Key Ideas:**\n- Sacrifice b-pawn for tempo\n- Rapid central expansion\n- Attack Black\'s king\n- Sharp tactical play', 
        tags: JSON.stringify(['opening', 'evans', 'gambit', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c38', 
        chunkText: '## Two Knights Defense (1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6) [ECO C55-C59]\n\nA sharp defense against the Italian Game with tactical complications.\n\n**Key Ideas:**\n- Develop both knights quickly\n- Counterattack e4\n- Tactical sharpness\n- Fried Liver Attack variations', 
        tags: JSON.stringify(['opening', 'two-knights', 'tactical', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c39', 
        chunkText: '## Modern Defense (1.e4 g6) [ECO B06]\n\nA flexible hypermodern defense fianchettoing the kingside bishop first.\n\n**Key Ideas:**\n- Fianchetto g7 bishop immediately\n- Control center from distance\n- Keep position flexible\n- Surprise value', 
        tags: JSON.stringify(['opening', 'modern', 'hypermodern', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c40', 
        chunkText: '## Philidor Defense (1.e4 e5 2.Nf3 d6) [ECO C41]\n\nA solid but passive defense supporting e5 with the d-pawn.\n\n**Key Ideas:**\n- Support e5 with d6\n- Solid pawn structure\n- Slightly cramped position\n- Reliable but passive', 
        tags: JSON.stringify(['opening', 'philidor', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c41', 
        chunkText: '## Old Indian Defense (1.d4 Nf6 2.c4 d6) [ECO A53-A55]\n\nA flexible system where Black delays central commitments.\n\n**Key Ideas:**\n- Delay central pawn moves\n- Keep position flexible\n- Kingside fianchetto often\n- Solid structure', 
        tags: JSON.stringify(['opening', 'old-indian', 'flexible', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c42', 
        chunkText: '## Benko Gambit (1.d4 Nf6 2.c4 c5 3.d5 b5) [ECO A57-A59]\n\nA positional gambit sacrificing the b-pawn for long-term queenside pressure.\n\n**Key Ideas:**\n- Sacrifice b5 pawn\n- Queenside pressure\n- Open a- and b-files\n- Long-term compensation', 
        tags: JSON.stringify(['opening', 'benko', 'gambit', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c43', 
        chunkText: '## Ponziani Opening (1.e4 e5 2.Nf3 Nc6 3.c3) [ECO C44]\n\nAn old opening preparing d4 to control the center.\n\n**Key Ideas:**\n- Prepare d4 advance\n- Control center with pawns\n- Solid but slow development\n- Surprise weapon', 
        tags: JSON.stringify(['opening', 'ponziani', 'classical', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c44', 
        chunkText: '## Nimzo-Larsen Attack (1.b3) [ECO A01]\n\nA hypermodern flank opening fianchettoing the queenside bishop first.\n\n**Key Ideas:**\n- Fianchetto queenside bishop\n- Control center from flanks\n- Flexible pawn structure\n- Surprise value', 
        tags: JSON.stringify(['opening', 'nimzo-larsen', 'hypermodern']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c45', 
        chunkText: '## Blackmar-Diemer Gambit (1.d4 d5 2.e4) [ECO D00]\n\nAn aggressive gambit offering a pawn for rapid development and attack.\n\n**Key Ideas:**\n- Sacrifice pawn for initiative\n- Rapid piece development\n- Kingside attack\n- Sharp tactics', 
        tags: JSON.stringify(['opening', 'blackmar-diemer', 'gambit', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c46', 
        chunkText: '## Tarrasch Defense (1.d4 d5 2.c4 e6 3.Nc3 c5) [ECO D32-D34]\n\nA dynamic defense creating pawn tension in the center.\n\n**Key Ideas:**\n- Challenge center with ...c5\n- Accept isolated d-pawn\n- Active piece play\n- Dynamic compensation', 
        tags: JSON.stringify(['opening', 'tarrasch', 'dynamic', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c47', 
        chunkText: '## Chigorin Defense (1.d4 d5 2.c4 Nc6) [ECO D07]\n\nAn unorthodox defense developing the knight to c6 early.\n\n**Key Ideas:**\n- Develop Nc6 early\n- Pressure White\'s center\n- Unbalanced positions\n- Surprise value', 
        tags: JSON.stringify(['opening', 'chigorin', 'unorthodox', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c48', 
        chunkText: '## Owen Defense (1.e4 b6) [ECO B00]\n\nAn unusual defense fianchettoing the queenside bishop immediately.\n\n**Key Ideas:**\n- Fianchetto queenside bishop\n- Control long diagonal\n- Flexible structure\n- Surprise weapon', 
        tags: JSON.stringify(['opening', 'owen', 'unorthodox', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c49', 
        chunkText: '## Nimzowitsch Defense (1.e4 Nc6) [ECO B00]\n\nA hypermodern defense developing the knight to the rim early.\n\n**Key Ideas:**\n- Develop Nc6 before e5\n- Control center from distance\n- Flexible setup\n- Avoid main lines', 
        tags: JSON.stringify(['opening', 'nimzowitsch', 'hypermodern', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c50', 
        chunkText: '## St. George Defense (1.e4 a6) [ECO B00]\n\nAn ultra-solid defense preparing ...b5 immediately.\n\n**Key Ideas:**\n- Prepare ...b5 expansion\n- Queenside play\n- Extremely solid\n- Surprise value', 
        tags: JSON.stringify(['opening', 'st-george', 'unorthodox', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c51', 
        chunkText: '## Polish Opening (1.b4) [ECO A00]\n\nAn aggressive flank opening immediately expanding on the queenside.\n\n**Key Ideas:**\n- Queenside expansion\n- Control a5 and c5\n- Surprise opponents\n- Unorthodox play', 
        tags: JSON.stringify(['opening', 'polish', 'unorthodox']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c52', 
        chunkText: '## Accelerated Dragon (1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6) [ECO B34-B39]\n\nA sharp Sicilian variation where Black fianchettoes immediately.\n\n**Key Ideas:**\n- Fianchetto g7 bishop quickly\n- Avoid Maróczy Bind\n- Dynamic play\n- Sharp tactics', 
        tags: JSON.stringify(['opening', 'sicilian', 'accelerated-dragon', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c53', 
        chunkText: '## Dragon Variation (Sicilian) (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6) [ECO B70-B79]\n\nOne of the sharpest Sicilian variations with opposite-side castling attacks.\n\n**Key Ideas:**\n- Fianchetto g7 bishop\n- Castle queenside often\n- Race to attack opponent king\n- Extremely tactical', 
        tags: JSON.stringify(['opening', 'sicilian', 'dragon', 'sharp', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c54', 
        chunkText: '## Najdorf Variation (Sicilian) (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6) [ECO B90-B99]\n\nThe most popular and flexible Sicilian variation, favored by world champions.\n\n**Key Ideas:**\n- Prepare ...e5 or ...b5\n- Maximum flexibility\n- Sharp tactics\n- Rich theory', 
        tags: JSON.stringify(['opening', 'sicilian', 'najdorf', 'sharp', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c55', 
        chunkText: '## Sveshnikov Variation (Sicilian) (1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5) [ECO B33]\n\nA sharp Sicilian where Black accepts a weakened d5 square for active play.\n\n**Key Ideas:**\n- Accept weak d5 square\n- Active piece play\n- Dynamic compensation\n- Sharp tactics', 
        tags: JSON.stringify(['opening', 'sicilian', 'sveshnikov', 'sharp', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c56', 
        chunkText: '## Taimanov Variation (Sicilian) (1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6) [ECO B44-B49]\n\nA flexible Sicilian system maintaining central control.\n\n**Key Ideas:**\n- Keep pawn structure flexible\n- Solid center\n- Less tactical than other Sicilians\n- Reliable', 
        tags: JSON.stringify(['opening', 'sicilian', 'taimanov', 'flexible', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c57', 
        chunkText: '## Classical Variation (Sicilian) (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6) [ECO B56-B69]\n\nA solid Sicilian system developing naturally and maintaining flexibility.\n\n**Key Ideas:**\n- Natural development\n- Flexible structure\n- Less theory than Najdorf\n- Reliable and solid', 
        tags: JSON.stringify(['opening', 'sicilian', 'classical', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c58', 
        chunkText: '## Scheveningen Variation (Sicilian) (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6) [ECO B80-B85]\n\nA solid Sicilian with a strong pawn center and flexible piece placement.\n\n**Key Ideas:**\n- Strong central pawns d6 and e6\n- Solid structure\n- Flexible piece development\n- Reliable and strategic', 
        tags: JSON.stringify(['opening', 'sicilian', 'scheveningen', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c59', 
        chunkText: '## Queen\'s Gambit Declined (1.d4 d5 2.c4 e6) [ECO D30-D69]\n\nA classical and solid defense accepting a slightly cramped position for a strong center.\n\n**Key Ideas:**\n- Maintain d5 pawn\n- Solid pawn structure\n- Strategic maneuvering\n- Classical play', 
        tags: JSON.stringify(['opening', 'qgd', 'solid', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c60', 
        chunkText: '## Semi-Tarrasch Defense (1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5) [ECO D40-D42]\n\nA dynamic defense combining ideas from Tarrasch and QGD.\n\n**Key Ideas:**\n- Challenge center with ...c5\n- Active piece play\n- Isolated d-pawn often\n- Dynamic positions', 
        tags: JSON.stringify(['opening', 'semi-tarrasch', 'dynamic', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c61', 
        chunkText: '## Ragozin Defense (1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Bb4) [ECO D38-D39]\n\nA combination of Queen\'s Gambit Declined and Nimzo-Indian ideas.\n\n**Key Ideas:**\n- Pin c3 knight\n- Solid central structure\n- Flexible development\n- Reliable', 
        tags: JSON.stringify(['opening', 'ragozin', 'solid', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c62', 
        chunkText: '## Accelerated London System (1.d4 Nf6 2.Bf4) [ECO D02]\n\nAn even more direct version of the London System.\n\n**Key Ideas:**\n- Develop Bf4 immediately\n- Simple development plan\n- Solid structure\n- Easy to play', 
        tags: JSON.stringify(['opening', 'london', 'system', '1d4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c63', 
        chunkText: '## Marshall Attack (Ruy Lopez) (1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7 6.Re1 b5 7.Bb3 0-0 8.c3 d5) [ECO C89]\n\nA sharp gambit in the Ruy Lopez sacrificing a pawn for initiative.\n\n**Key Ideas:**\n- Sacrifice d5 pawn\n- Create attacking chances\n- Dynamic piece play\n- Heavily analyzed', 
        tags: JSON.stringify(['opening', 'ruy-lopez', 'marshall', 'gambit', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'c64', 
        chunkText: '## Berlin Defense (Ruy Lopez) (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6) [ECO C65-C67]\n\nA solid defense that often leads to an endgame after exchanges.\n\n**Key Ideas:**\n- Trade pieces early\n- Reach favorable endgame\n- Solid structure\n- Drawing weapon', 
        tags: JSON.stringify(['opening', 'ruy-lopez', 'berlin', 'solid', '1e4']),
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ],
    '5': [
      { 
        id: 'r1', 
        chunkText: '## Chess Board Setup\n\nThe chessboard is laid out so that each player has a white (or light) square in the bottom right-hand corner.\n\n**Board Setup:**\n- 8x8 grid of alternating light and dark squares (64 total)\n- Ranks numbered 1-8 (rows from White\'s side)\n- Files labeled a-h (columns from left to right)\n- Bottom-right corner must be a light square\n\n**Piece Placement:**\n- Second rank: All 8 pawns\n- Back rank corners: Rooks\n- Next to rooks: Knights\n- Next to knights: Bishops\n- Queen on her own color (white queen on light square, black queen on dark square)\n- King on the remaining center square', 
        tags: JSON.stringify(['rules', 'setup', 'board', 'beginner']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r2', 
        chunkText: '## The King\'s Movement\n\nThe king is the most important piece but one of the weakest in terms of movement.\n\n**Movement Rules:**\n- Can move exactly one square in any direction: forward, backward, sideways, or diagonally\n- Cannot move into check (a square attacked by an opponent\'s piece)\n- Cannot castle if in check, through check, or into check\n\n**Special Characteristics:**\n- Infinitely valuable (losing the king means losing the game)\n- Becomes more active in the endgame\n- Must be protected throughout the game', 
        tags: JSON.stringify(['rules', 'king', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r3', 
        chunkText: '## The Queen\'s Movement\n\nThe queen is the most powerful piece on the board.\n\n**Movement Rules:**\n- Can move any number of squares in any one straight direction: forward, backward, sideways, or diagonally\n- Cannot jump over other pieces\n- Captures by landing on an opponent\'s square\n\n**Special Characteristics:**\n- Worth approximately 9 points in material value\n- Combines the powers of rook and bishop\n- Very powerful but should be developed after minor pieces', 
        tags: JSON.stringify(['rules', 'queen', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r4', 
        chunkText: '## The Rook\'s Movement\n\nRooks are powerful pieces particularly effective in the endgame.\n\n**Movement Rules:**\n- Can move any number of squares forward, backward, or sideways (along ranks and files)\n- Cannot move diagonally\n- Cannot jump over other pieces\n\n**Special Characteristics:**\n- Worth approximately 5 points in material value\n- Particularly powerful when protecting each other (doubled rooks)\n- Most effective on open files\n- Can participate in castling', 
        tags: JSON.stringify(['rules', 'rook', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r5', 
        chunkText: '## The Bishop\'s Movement\n\nBishops are long-range pieces that control diagonals.\n\n**Movement Rules:**\n- Can move any number of squares diagonally\n- Cannot jump over other pieces\n- Cannot change the color of square it starts on\n\n**Special Characteristics:**\n- Worth approximately 3 points in material value\n- Each bishop is confined to either light or dark squares\n- Two bishops work well together covering both colors\n- More effective in open positions', 
        tags: JSON.stringify(['rules', 'bishop', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r6', 
        chunkText: '## The Knight\'s Movement\n\nKnights have a unique movement pattern that allows them to jump over other pieces.\n\n**Movement Rules:**\n- Moves in an "L" shape: two squares in one direction, then one square perpendicular\n- Only piece that can jump over other pieces\n- Always lands on a square of opposite color from where it started\n\n**Special Characteristics:**\n- Worth approximately 3 points in material value\n- Most effective in closed positions\n- Can control up to 8 squares from the center\n- Cannot lose a tempo (always changes square color)', 
        tags: JSON.stringify(['rules', 'knight', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r7', 
        chunkText: '## The Pawn\'s Movement\n\nPawns are unique pieces with special movement and capture rules.\n\n**Movement Rules:**\n- Move forward one square (or two squares on their first move)\n- Cannot move backward\n- Capture diagonally forward one square\n- Cannot capture forward or move diagonally without capturing\n\n**Special Characteristics:**\n- Worth approximately 1 point in material value\n- If blocked by another piece, cannot move at all\n- Can promote to any piece (except king) upon reaching the opposite end\n- Subject to en passant capture rule', 
        tags: JSON.stringify(['rules', 'pawn', 'movement', 'pieces']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r8', 
        chunkText: '## Pawn Promotion\n\nWhen a pawn reaches the opposite end of the board, it must be promoted.\n\n**Promotion Rules:**\n- Occurs when a pawn reaches the 8th rank (for White) or 1st rank (for Black)\n- Must immediately be exchanged for a queen, rook, bishop, or knight of the same color\n- Cannot remain a pawn or become a king\n- No limit on piece type (can have multiple queens)\n\n**Strategic Considerations:**\n- Usually promoted to queen (most powerful)\n- Sometimes knight promotion is best (to give check or avoid stalemate)\n- Underpromotion to rook or bishop is rare but sometimes necessary', 
        tags: JSON.stringify(['rules', 'pawn', 'promotion', 'special-moves']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r9', 
        chunkText: '## En Passant\n\n"En passant" (French for "in passing") is a special pawn capture that can only occur under specific circumstances.\n\n**En Passant Rules:**\n- Can only happen immediately after an opponent moves a pawn two squares forward from its starting position\n- Your pawn must be on the 5th rank (for White) or 4th rank (for Black)\n- The opponent\'s pawn must land beside your pawn\n- You can capture it as if it had only moved one square\n- Must be done immediately on the next move or the opportunity is lost\n\n**Example:**\n- White pawn on e5, Black moves pawn from f7 to f5\n- White can capture en passant, moving the e5 pawn to f6 and removing the f5 pawn', 
        tags: JSON.stringify(['rules', 'pawn', 'en-passant', 'special-moves']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r10', 
        chunkText: '## Castling\n\nCastling is a special move involving the king and rook, performed as a single move.\n\n**Castling Requirements:**\n- Must be the king\'s first move\n- Must be that rook\'s first move\n- No pieces between king and rook\n- King cannot be in check\n- King cannot pass through a square under attack\n- King cannot castle into check\n\n**How to Castle:**\n- **Kingside:** King moves two squares toward the h-rook; rook moves to the square the king crossed\n- **Queenside:** King moves two squares toward the a-rook; rook moves to the square the king crossed\n\n**Notation:** O-O (kingside), O-O-O (queenside)', 
        tags: JSON.stringify(['rules', 'castling', 'king', 'rook', 'special-moves']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r11', 
        chunkText: '## Turn Order and Basic Rules\n\nChess follows a strict turn-based system with specific rules.\n\n**Turn Rules:**\n- White always moves first\n- Players alternate turns\n- Must make exactly one move per turn (exception: castling moves both king and rook)\n- Cannot pass or skip a turn\n\n**Move Requirements:**\n- Can only move your own pieces\n- Cannot move into or remain in check\n- If in check, must get out of check\n- Touch-move rule in tournaments: if you touch a piece, you must move it (if legal)', 
        tags: JSON.stringify(['rules', 'turns', 'basic', 'beginner']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r12', 
        chunkText: '## Check, Checkmate, and Game Objectives\n\n**Check:**\n- When a king is under attack by an opponent\'s piece\n- Must be resolved immediately by:\n  1. Moving the king to safety\n  2. Blocking the attack with another piece\n  3. Capturing the attacking piece\n\n**Checkmate:**\n- King is in check and has no legal way to escape\n- Game ends immediately - player delivering checkmate wins\n- King is never actually captured\n\n**Game Objective:**\n- Checkmate the opponent\'s king\n- Protect your own king from checkmate', 
        tags: JSON.stringify(['rules', 'check', 'checkmate', 'objective']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r13', 
        chunkText: '## Stalemate\n\nStalemate is a special draw condition that ends the game.\n\n**Stalemate Rules:**\n- Occurs when a player is NOT in check\n- But has no legal moves available\n- Game ends in a draw (tie) immediately\n\n**Key Points:**\n- Often happens when one player has overwhelming material advantage\n- Usually disadvantageous for the stronger side\n- Important to avoid when trying to win\n- Can be used as a defensive resource', 
        tags: JSON.stringify(['rules', 'stalemate', 'draw', 'endgame']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r14', 
        chunkText: '## Draw Conditions\n\nThere are several ways a chess game can end in a draw.\n\n**Draw Types:**\n\n1. **Stalemate:** Player not in check but has no legal moves\n\n2. **Insufficient Material:** Neither player has enough pieces to checkmate\n   - King vs King\n   - King and Bishop vs King\n   - King and Knight vs King\n\n3. **Threefold Repetition:** Same position occurs three times with same player to move\n\n4. **Fifty-Move Rule:** Fifty consecutive moves by both players without a pawn move or capture\n\n5. **Agreement:** Both players agree to a draw', 
        tags: JSON.stringify(['rules', 'draw', 'stalemate', 'endgame']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r15', 
        chunkText: '## Piece Values\n\nUnderstanding relative piece values helps with exchanges and tactical decisions.\n\n**Standard Point Values:**\n- Pawn: 1 point\n- Knight: 3 points\n- Bishop: 3 points (slightly more valuable than knight)\n- Rook: 5 points\n- Queen: 9 points\n- King: Infinite (losing the king means losing the game)\n\n**Exchange Considerations:**\n- These values are guidelines, not absolute\n- Position matters (a well-placed knight can be worth more than a rook)\n- Two minor pieces (bishops/knights) roughly equal a rook and pawn\n- Bishop pair is often stronger than two knights', 
        tags: JSON.stringify(['rules', 'piece-values', 'strategy', 'material']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r16', 
        chunkText: '## Basic Chess Etiquette and Tournament Rules\n\n**Touch-Move Rule:**\n- If you touch your own piece, you must move it (if legal)\n- If you touch opponent\'s piece, you must capture it (if legal)\n- Say "adjust" or "j\'adoube" before adjusting pieces without moving them\n\n**Clock Rules:**\n- Each player has a set amount of time for all their moves\n- Clock starts for the opponent after you complete your move\n- Running out of time results in loss (unless opponent cannot checkmate)\n\n**General Etiquette:**\n- Don\'t distract your opponent\n- Resign if position is clearly lost\n- Shake hands before and after the game', 
        tags: JSON.stringify(['rules', 'etiquette', 'tournament', 'clock']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r17', 
        chunkText: '## Winning and Losing the Game\n\n**Ways to Win:**\n1. **Checkmate:** Opponent\'s king is in check with no escape\n2. **Resignation:** Opponent resigns the game\n3. **Time Forfeit:** Opponent runs out of time (with sufficient mating material)\n\n**Ways to Lose:**\n1. **Checkmate:** Your king is in check with no escape\n2. **Resignation:** You resign the game\n3. **Time Forfeit:** You run out of time (opponent has sufficient mating material)\n\n**Draws:**\n- Stalemate, insufficient material, threefold repetition, fifty-move rule, or mutual agreement', 
        tags: JSON.stringify(['rules', 'winning', 'losing', 'checkmate', 'draw']),
        language: 'en',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'r18', 
        chunkText: '## Chess Notation Basics\n\nChess notation allows games to be recorded and analyzed.\n\n**Algebraic Notation:**\n- Files (columns): a-h from left to right\n- Ranks (rows): 1-8 from White\'s side to Black\'s side\n- Each square identified by file + rank (e.g., e4, d5)\n\n**Piece Abbreviations:**\n- K = King, Q = Queen, R = Rook, B = Bishop, N = Knight\n- Pawns have no letter (just the square)\n\n**Special Symbols:**\n- x = captures (e.g., Nxe5)\n- + = check\n- # = checkmate\n- O-O = kingside castling\n- O-O-O = queenside castling\n- = = promotion (e.g., e8=Q)', 
        tags: JSON.stringify(['rules', 'notation', 'algebraic', 'recording']),
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ]
  };
  
  res.json(mockChunks[id as keyof typeof mockChunks] || []);
});

// GET /api/admin/knowledge/diagnostics
app.get('/api/admin/knowledge/diagnostics', requireAuth, async (req, res) => {
  res.json({
    sources: [
      { id: '1', title: 'Chess Tactics: Essential Patterns for Improvement', chunkCount: 14 },
      { id: '2', title: 'Opening Principles: Building a Strong Foundation', chunkCount: 13 },
      { id: '3', title: 'Endgame Fundamentals: Converting Advantages to Victory', chunkCount: 15 },
      { id: '4', title: 'Popular Chess Openings: A Comprehensive Guide', chunkCount: 74 },
      { id: '5', title: 'Chess Rules: Complete Guide for Beginners', chunkCount: 18 }
    ],
    totalChunks: 134
  });
});

// POST /api/admin/coach
app.post('/api/admin/coach', requireAuth, async (req, res) => {
  const { action, theme, query } = req.body;
  
  if (action === 'search_knowledge') {
    // Enhanced search that looks for opening-related terms
    const lowerQuery = query.toLowerCase();
    let results = [];
    
    if (lowerQuery.includes('sicilian') || lowerQuery.includes('1.e4 c5')) {
      results.push({
        id: 'c5',
        text: 'The Sicilian Defense is the most popular and aggressive response to 1.e4. Black immediately fights for the center and creates an imbalanced position...',
        fullText: '## Sicilian Defense (1.e4 c5)\n\nThe Sicilian Defense is the most popular and aggressive response to 1.e4. Black immediately fights for the center and creates an imbalanced position, leading to sharp tactical play.\n\n**Key Ideas:**\n- Fight for the d4 square\n- Create counterplay on the queenside with ...b5\n- Castle kingside and launch a pawn storm\n- Exchange the light-squared bishop early\n\n**Main Variations:**\n- **Najdorf (5...a6)**: Most aggressive, prepares ...e5 or ...b5\n- **Dragon (5...g6)**: Sharp attacking positions with opposite-side castling',
        tags: JSON.stringify({ tags: ['opening', 'sicilian', 'aggressive', '1e4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (lowerQuery.includes('french') || lowerQuery.includes('1.e4 e6')) {
      results.push({
        id: 'c6',
        text: 'A solid, strategic opening where Black accepts a slightly cramped position in exchange for a rock-solid pawn structure...',
        fullText: '## French Defense (1.e4 e6)\n\nA solid, strategic opening where Black accepts a slightly cramped position in exchange for a rock-solid pawn structure and counterplay on the queenside.\n\n**Key Ideas:**\n- Build a strong pawn chain\n- Attack White\'s pawn center with ...c5 or ...f6\n- Develop the light-squared bishop before playing ...e6\n- Create queenside play with ...b6 and ...Ba6',
        tags: JSON.stringify({ tags: ['opening', 'french', 'solid', '1e4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (lowerQuery.includes('italian') || lowerQuery.includes('giuoco')) {
      results.push({
        id: 'c8',
        text: 'One of the oldest and most classical openings, the Italian Game focuses on rapid development and control of the center...',
        fullText: '## Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4)\n\nOne of the oldest and most classical openings, the Italian Game focuses on rapid development and control of the center.\n\n**Key Ideas:**\n- Develop pieces toward the center\n- Prepare d4 advance to open the position\n- Castle quickly\n- Create threats against f7',
        tags: JSON.stringify({ tags: ['opening', 'italian', 'classical', '1e4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (lowerQuery.includes('spanish') || lowerQuery.includes('ruy lopez')) {
      results.push({
        id: 'c9',
        text: 'The Spanish Opening is considered one of the strongest and most strategic ways to play after 1.e4 e5...',
        fullText: '## Spanish Opening (Ruy Lopez) (1.e4 e5 2.Nf3 Nc6 3.Bb5)\n\nThe Spanish Opening is considered one of the strongest and most strategic ways to play after 1.e4 e5.\n\n**Key Ideas:**\n- Pressure the e5 pawn indirectly\n- Prepare d4 to dominate the center\n- Castle and build a strong pawn center\n- Maneuver pieces to optimal squares',
        tags: JSON.stringify({ tags: ['opening', 'spanish', 'ruy-lopez', '1e4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (lowerQuery.includes('queens gambit') || lowerQuery.includes('queen\'s gambit') || lowerQuery.includes('1.d4 d5')) {
      results.push({
        id: 'c10',
        text: 'The Queen\'s Gambit is one of the oldest and most respected openings, offering White excellent control of the center...',
        fullText: '## Queen\'s Gambit (1.d4 d5 2.c4)\n\nThe Queen\'s Gambit is one of the oldest and most respected openings, offering White excellent control of the center.\n\n**Key Ideas:**\n- Pressure Black\'s d5 pawn\n- Control the center with pawns\n- Develop pieces harmoniously\n- Create long-term positional pressure',
        tags: JSON.stringify({ tags: ['opening', 'queens-gambit', '1d4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (lowerQuery.includes('london')) {
      results.push({
        id: 'c14',
        text: 'A solid, system-based opening that leads to quiet, strategic positions with easy development for White...',
        fullText: '## London System (1.d4 d5 2.Bf4)\n\nA solid, system-based opening that leads to quiet, strategic positions with easy development for White.\n\n**Key Ideas:**\n- Develop bishop to f4 early\n- Build a solid pawn structure with e3 and Nf3\n- Castle kingside\n- Create slow but steady pressure',
        tags: JSON.stringify({ tags: ['opening', 'london', 'system', '1d4'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    // Generic opening search
    if (results.length === 0 && (lowerQuery.includes('opening') || lowerQuery.includes('1.e4') || lowerQuery.includes('1.d4'))) {
      results.push({
        id: 'generic',
        text: `Search results for "${query}": Found multiple opening resources. Try searching for specific openings like "Sicilian", "French", "Italian", "Spanish", "Queen's Gambit", or "London System".`,
        fullText: 'Available openings in the knowledge base:\n- Sicilian Defense\n- French Defense\n- Caro-Kann Defense\n- Italian Game\n- Spanish Opening (Ruy Lopez)\n- Queen\'s Gambit\n- King\'s Indian Defense\n- Nimzo-Indian Defense\n- English Opening\n- London System',
        tags: JSON.stringify({ tags: ['opening', 'index'] }),
        source: 'Popular Chess Openings: A Comprehensive Guide'
      });
    }
    
    if (results.length === 0) {
      results.push({
        id: '1',
        text: `Mock result for "${query}": This is a placeholder...`,
        fullText: `Full mock content about ${query}. In a real implementation, this would retrieve actual knowledge chunks from the database.`,
        tags: JSON.stringify({ tags: [query.toLowerCase()] }),
        source: 'Chess Knowledge Base'
      });
    }
    
    res.json({
      query,
      results,
      count: results.length
    });
  } else if (action === 'thematic_coaching') {
    // Enhanced thematic coaching for openings
    const lowerTheme = theme.toLowerCase();
    let coaching = '';
    
    if (lowerTheme.includes('opening')) {
      coaching = `Coaching on: ${theme}\n\n**Opening Fundamentals:**\n\n1. **Control the Center**: Always fight for control of e4, d4, e5, and d5\n2. **Develop Pieces**: Bring knights and bishops out before moving the same piece twice\n3. **Castle Early**: Get your king to safety by move 8-10\n4. **Connect Rooks**: Clear your back rank so rooks can support each other\n\n**Popular Opening Systems:**\n- For 1.e4: Italian Game, Spanish Opening, Sicilian Defense (as Black)\n- For 1.d4: Queen's Gambit, London System, King's Indian Defense (as Black)\n- Flexible options: English Opening (1.c4)\n\n**Study Approach:**\nFocus on understanding ideas and plans rather than memorizing specific move orders. Learn one opening for White and 2-3 defenses for Black.`;
    } else if (lowerTheme.includes('sicilian')) {
      coaching = `Coaching on: Sicilian Defense\n\n**Core Ideas:**\nThe Sicilian (1.e4 c5) is Black's most ambitious defense. You're saying "I'm not settling for a draw - I want to win!"\n\n**Key Strategies:**\n- Control d4 and prevent White from establishing d4-e4 pawn center\n- Create queenside counterplay with ...b5\n- Castle kingside and prepare pawn storm on kingside\n- Time your ...d5 break carefully\n\n**Common Variations:**\n- Najdorf (5...a6): Most flexible and aggressive\n- Dragon (5...g6): Sharp tactical positions\n- Classical (5...Nc6): Solid and strategic\n\n**Beginner-Friendly:** Accelerated Dragon - develops quickly and avoids heavy theory.`;
    } else {
      coaching = `Mock Coaching on: ${theme}\n\nThis is placeholder coaching advice. The real implementation would retrieve relevant knowledge chunks and synthesize coaching guidance.`;
    }
    
    res.json({
      coaching,
      theme
    });
  } else if (action === 'generate_advice') {
    res.json({
      advice: 'Mock coaching advice generated from game analysis.\n\nGame Analysis:\nRating: 75/100\nAccuracy: 78%\n\nThis is placeholder text. Real implementation would analyze the game and provide detailed coaching.',
      relevantKnowledge: ['Mock knowledge chunk 1', 'Mock knowledge chunk 2'],
      sources: ['Chess Tactics', 'Opening Principles'],
      confidence: 0.8
    });
  } else {
    res.status(400).json({ error: 'Unknown action' });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime() * 1000, // Convert to ms
    database: {
      dbReady: true,  // Mock DB is "ready"
      connectionStatus: 'connected',
      responseTime: 12,
      openConnections: 1,
      maxConnections: 10
    },
    checks: {
      apiKey: true,
      database: true,
    },
    message: 'Mock backend running'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🎭 Mock Backend Server running on http://localhost:${PORT}`);
  console.log(`📍 Admin endpoints available:`);
  console.log(`   - POST /api/admin/auth/unlock`);
  console.log(`   - GET  /api/admin/knowledge/sources`);
  console.log(`   - GET  /api/admin/knowledge/diagnostics`);
  console.log(`   - POST /api/admin/coach`);
  console.log(`\n🔐 Admin password: ${ADMIN_PASSWORD}\n`);
});
