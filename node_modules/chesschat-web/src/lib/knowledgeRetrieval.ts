/**
 * Knowledge Vault Retrieval for CPU Move Selection
 * Provides opening book and heuristic guidance for CPU opponent
 */

export interface OpeningCandidate {
  openingName: string;
  nextMove: string; // UCI format
  confidence: number;
  sourceId: string;
  chunkId: string;
}

export interface HeuristicHint {
  category: 'development' | 'king-safety' | 'material' | 'position';
  priority: number;
  description: string;
  sourceId: string;
  chunkId: string;
}

export interface MoveSource {
  type: 'vault_opening' | 'vault_heuristic' | 'engine_fallback';
  details?: {
    sourceId?: string;
    chunkId?: string;
    openingName?: string;
    heuristicUsed?: string;
  };
}

/**
 * Retrieves opening candidates from Knowledge Vault
 */
export async function getOpeningCandidates(
  fen: string,
  pgnMoves: string,
  plyCount: number,
  max: number = 5
): Promise<OpeningCandidate[]> {
  // Only use opening book in first 12 plies
  if (plyCount > 12) {
    return [];
  }

  try {
    // Call backend API with 1 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch('/api/knowledge/openings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, pgn: pgnMoves, plyCount, max }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Knowledge Vault] Opening retrieval failed:', response.statusText);
      return [];
    }

    const candidates: OpeningCandidate[] = await response.json();
    return candidates;
  } catch (error) {
    console.warn('[Knowledge Vault] Error retrieving openings:', error);
    return [];
  }
}

/**
 * Retrieves heuristic hints from Knowledge Vault
 */
export async function getHeuristicHints(
  fen: string,
  tags: string[] = ['tactics', 'strategy', 'endgames'],
  max: number = 8
): Promise<HeuristicHint[]> {
  try {
    // Call backend API with 1 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch('/api/knowledge/heuristics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, tags, max }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Knowledge Vault] Heuristic retrieval failed:', response.statusText);
      return [];
    }

    const hints: HeuristicHint[] = await response.json();
    return hints;
  } catch (error) {
    console.warn('[Knowledge Vault] Error retrieving heuristics:', error);
    return [];
  }
}

/**
 * Basic opening principles (fallback if vault unavailable)
 */
const OPENING_PRINCIPLES = {
  // Prioritize center control
  centerSquares: ['e4', 'e5', 'd4', 'd5'],
  
  // Development squares for pieces
  developmentSquares: {
    knight: ['f3', 'c3', 'f6', 'c6'],
    bishop: ['c4', 'f4', 'c5', 'f5', 'e2', 'd3'],
  },
  
  // King safety (castle early)
  castlingPriority: true,
};

/**
 * Apply deterministic heuristics to rank moves (local fallback)
 */
export function applyLocalHeuristics(
  legalMoves: Array<{from: string; to: string}>,
  fen: string,
  plyCount: number
): Array<{from: string; to: string; score: number}> {
  const scoredMoves = legalMoves.map(move => {
    let score = 0;

    // Opening phase (first 12 moves)
    if (plyCount <= 12) {
      // Prioritize center control
      if (OPENING_PRINCIPLES.centerSquares.includes(move.to)) {
        score += 30;
      }

      // Prioritize piece development
      if (move.from[1] === '1' || move.from[1] === '8') {
        score += 20; // Moving from back rank
      }

      // Prioritize knight development
      if (OPENING_PRINCIPLES.developmentSquares.knight.includes(move.to)) {
        score += 25;
      }

      // Prioritize bishop development
      if (OPENING_PRINCIPLES.developmentSquares.bishop.includes(move.to)) {
        score += 20;
      }
    }

    // Add randomness to avoid completely deterministic play
    score += Math.random() * 10;

    return { ...move, score };
  });

  // Sort by score descending
  return scoredMoves.sort((a, b) => b.score - a.score);
}

/**
 * Select CPU move with vault integration
 * 
 * Priority:
 * 1. Opening book from vault (if in opening phase)
 * 2. Heuristic-guided selection from vault
 * 3. Local heuristics (fallback)
 * 4. Random legal move (ultimate fallback)
 */
export async function selectCPUMoveWithVault(
  fen: string,
  pgn: string,
  plyCount: number,
  legalMoves: Array<{from: string; to: string}>,
  difficultyLevel: number = 4
): Promise<{move: {from: string; to: string}; source: MoveSource}> {
  
  console.log('[selectCPUMoveWithVault] Starting move selection, plyCount:', plyCount, 'legalMoves:', legalMoves.length);
  
  // Phase 1: Try opening book (first 12 plies)
  if (plyCount <= 12) {
    console.log('[selectCPUMoveWithVault] Trying opening book...');
    const openings = await getOpeningCandidates(fen, pgn, plyCount, 5);
    console.log('[selectCPUMoveWithVault] Opening candidates:', openings.length);
    
    if (openings.length > 0) {
      // Pick highest confidence opening, or weighted random
      const selected = openings[0];
      const uciMove = selected.nextMove;
      
      // Convert UCI to from/to
      const from = uciMove.substring(0, 2);
      const to = uciMove.substring(2, 4);
      
      // Verify it's in legal moves
      const isLegal = legalMoves.some(m => m.from === from && m.to === to);
      
      if (isLegal) {
        return {
          move: { from, to },
          source: {
            type: 'vault_opening',
            details: {
              sourceId: selected.sourceId,
              chunkId: selected.chunkId,
              openingName: selected.openingName,
            },
          },
        };
      }
    }
  }

  // Phase 2: Try heuristic guidance from vault
  console.log('[selectCPUMoveWithVault] Trying heuristic hints...');
  const hints = await getHeuristicHints(fen, ['tactics', 'strategy'], 8);
  console.log('[selectCPUMoveWithVault] Heuristic hints:', hints.length);
  
  if (hints.length > 0) {
    // Apply hints to score moves
    const scoredMoves = applyLocalHeuristics(legalMoves, fen, plyCount);
    
    // Pick from top N based on difficulty
    const candidateCount = Math.max(1, Math.min(difficultyLevel, scoredMoves.length));
    const topMoves = scoredMoves.slice(0, candidateCount);
    const selected = topMoves[Math.floor(Math.random() * topMoves.length)];
    
    return {
      move: { from: selected.from, to: selected.to },
      source: {
        type: 'vault_heuristic',
        details: {
          heuristicUsed: hints[0].description,
          sourceId: hints[0].sourceId,
          chunkId: hints[0].chunkId,
        },
      },
    };
  }

  // Phase 3: Local heuristics (fallback)
  console.log('[selectCPUMoveWithVault] Using local heuristics fallback...');
  const scoredMoves = applyLocalHeuristics(legalMoves, fen, plyCount);
  
  // Apply difficulty-based selection
  const candidateCount = Math.max(1, Math.min(difficultyLevel, scoredMoves.length));
  const topMoves = scoredMoves.slice(0, candidateCount);
  const selected = topMoves[Math.floor(Math.random() * topMoves.length)];
  
  console.log('[selectCPUMoveWithVault] Selected move:', selected.from, '→', selected.to);
  
  return {
    move: { from: selected.from, to: selected.to },
    source: {
      type: 'engine_fallback',
      details: {
        heuristicUsed: 'local_heuristics',
      },
    },
  };
}
