/**
 * Knowledge Vault API - Opening Book Retrieval
 * Cloudflare Pages Function
 */

interface Env {
  DATABASE_URL?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fen, pgn, plyCount, max = 5 } = await context.request.json();

    console.log(`[Opening Retrieval] FEN: ${fen}, Ply: ${plyCount}`);

    // Simple opening book - match PGN prefix
    const openings = getOpeningBook();
    
    const matches = openings
      .filter(opening => {
        // Match if PGN starts with opening moves
        return pgn && opening.moves.some(moveSeq => 
          pgn.replace(/\d+\.\s*/g, '').trim().startsWith(moveSeq.replace(/\d+\.\s*/g, '').trim())
        );
      })
      .slice(0, max)
      .map(opening => ({
        openingName: opening.name,
        nextMove: getNextMoveFromOpening(opening, pgn),
        confidence: 0.8,
        sourceId: opening.id,
        chunkId: opening.id,
      }))
      .filter(m => m.nextMove); // Only include if we found a next move

    console.log(`[Opening Retrieval] Found ${matches.length} candidates`);

    return new Response(JSON.stringify(matches), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('[Opening Retrieval] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve openings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

function getNextMoveFromOpening(opening: any, pgn: string): string | null {
  // Clean PGN (remove move numbers)
  const cleanPgn = pgn.replace(/\d+\.\s*/g, '').trim();
  
  // Find matching move sequence
  for (const moveSeq of opening.moves) {
    const cleanSeq = moveSeq.replace(/\d+\.\s*/g, '').trim();
    
    if (cleanSeq.startsWith(cleanPgn) && cleanSeq.length > cleanPgn.length) {
      // Get the next move
      const nextMove = cleanSeq.substring(cleanPgn.length).trim().split(' ')[0];
      
      // Convert SAN to UCI (simplified - would need full parser for production)
      return convertSANToUCI(nextMove);
    }
  }
  
  return null;
}

function convertSANToUCI(san: string): string {
  // Simplified SAN->UCI conversion
  // This is a STUB - in production, use chess.js to parse the move
  const sanToUci: { [key: string]: string } = {
    'e4': 'e2e4',
    'e5': 'e7e5',
    'd4': 'd2d4',
    'd5': 'd7d5',
    'Nf3': 'g1f3',
    'Nf6': 'g8f6',
    'Nc3': 'b1c3',
    'Nc6': 'b8c6',
    'Bb5': 'f1b5',
    'Bc5': 'f8c5',
    'O-O': 'e1g1', // Kingside castle (white)
    'O-O-O': 'e1c1', // Queenside castle
  };
  
  return sanToUci[san] || '';
}

function getOpeningBook() {
  return [
    {
      id: 'italian',
      name: 'Italian Game',
      moves: ['e4 e5 Nf3 Nc6 Bc4', '1. e4 e5 2. Nf3 Nc6 3. Bc4'],
    },
    {
      id: 'ruy-lopez',
      name: 'Ruy Lopez',
      moves: ['e4 e5 Nf3 Nc6 Bb5', '1. e4 e5 2. Nf3 Nc6 3. Bb5'],
    },
    {
      id: 'sicilian',
      name: 'Sicilian Defense',
      moves: ['e4 c5 Nf3', '1. e4 c5 2. Nf3'],
    },
    {
      id: 'french',
      name: 'French Defense',
      moves: ['e4 e6 d4', '1. e4 e6 2. d4'],
    },
    {
      id: 'kings-indian',
      name: "King's Indian Defense",
      moves: ['d4 Nf6 c4 g6 Nc3 Bg7', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7'],
    },
    {
      id: 'queens-gambit',
      name: "Queen's Gambit",
      moves: ['d4 d5 c4', '1. d4 d5 2. c4'],
    },
  ];
}
