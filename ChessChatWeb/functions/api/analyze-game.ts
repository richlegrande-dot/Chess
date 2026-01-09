/**
 * Game Analysis API endpoint - Advanced heuristic analysis
 * Analyzes game patterns without external AI services
 */

interface MoveRecord {
  moveNum: number;
  player: 'White' | 'Black';
  move: string;
  fen: string;
  captured?: string;
}

interface AnalysisResult {
  success: boolean;
  gameStats: {
    totalMoves: number;
    playerMoves: number;
    captures: number;
    checks: number;
    castled: boolean;
    gamePhase: string;
  };
  insights: {
    mistakes: string[];
    strengths: string[];
    recommendations: string[];
  };
  tacticalPatterns: string[];
}

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    const { pgn, moveHistory, cpuLevel, playerColor } = body;
    
    if (!moveHistory || !Array.isArray(moveHistory)) {
      throw new Error('Invalid moveHistory');
    }

    const analysis = analyzeMoveHistory(moveHistory as MoveRecord[], playerColor);
    
    return new Response(
      JSON.stringify(analysis),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request format',
      }),
      {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      }
    );
  }
}

function analyzeMoveHistory(moveHistory: MoveRecord[], playerColor: string): AnalysisResult {
  const playerMoves = moveHistory.filter(m => m.player === playerColor);
  const opponentMoves = moveHistory.filter(m => m.player !== playerColor);
  
  // Count captures - a move is a capture if it has captured field OR contains 'x'/'×' notation
  // We deduplicate by move number to avoid double-counting moves with both indicators
  const playerCapturesMoves = new Set();
  moveHistory.forEach(m => {
    if (m.player === playerColor && (m.captured || m.move.toLowerCase().includes('x') || m.move.includes('×'))) {
      playerCapturesMoves.add(m.moveNum);
    }
  });
  const playerCaptures = playerCapturesMoves.size;
  
  const opponentCapturesMoves = new Set();
  moveHistory.forEach(m => {
    if (m.player !== playerColor && (m.captured || m.move.toLowerCase().includes('x') || m.move.includes('×'))) {
      opponentCapturesMoves.add(m.moveNum);
    }
  });
  const opponentCaptures = opponentCapturesMoves.size;
  
  const playerChecks = moveHistory.filter(m => 
    (m.move.includes('+') || m.move.includes('#')) && m.player === playerColor
  ).length;
  const castled = moveHistory.some(m => 
    (m.move.includes('O-O') || m.move.includes('0-0')) && m.player === playerColor
  );
  
  const totalMoves = moveHistory.length;
  const gamePhase = totalMoves < 15 ? 'Opening' : totalMoves < 35 ? 'Middlegame' : 'Endgame';
  
  // Analyze mistakes
  const mistakes: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];
  const tacticalPatterns: string[] = [];
  
  // Material balance
  if (opponentCaptures > playerCaptures + 2) {
    mistakes.push(`Lost material battle (opponent: ${opponentCaptures} captures vs you: ${playerCaptures})`);
    recommendations.push('Practice hanging piece detection - scan for undefended pieces before moving');
  } else if (playerCaptures > opponentCaptures + 1) {
    strengths.push(`Won material exchanges (${playerCaptures} vs ${opponentCaptures} captures)`);
  }
  
  // King safety
  if (!castled && totalMoves > 15) {
    mistakes.push('Never castled - king remained unsafe in center');
    recommendations.push('Castle by move 8-12 in most games for king safety');
  } else if (castled && moveHistory.findIndex(m => m.move.includes('O-O') && m.player === playerColor) <= 10) {
    strengths.push('Castled early for king safety');
  }
  
  // Tactical activity
  if (playerChecks === 0 && totalMoves > 20) {
    mistakes.push('No forcing moves (checks) throughout the game');
    recommendations.push('Look for checks, captures, and threats (CCT) on every move');
  } else if (playerChecks >= 3) {
    strengths.push(`Active play with ${playerChecks} checks to pressure opponent`);
    tacticalPatterns.push('Forcing moves and initiative');
  }
  
  // Opening phase analysis
  const openingMoves = playerMoves.slice(0, Math.min(5, playerMoves.length));
  const centerControl = openingMoves.filter(m => m.move.match(/^[ed][45]/)).length;
  const earlyDevelopment = openingMoves.filter(m => m.move.match(/^[NBR]/)).length;
  
  if (centerControl === 0 && totalMoves > 10) {
    mistakes.push('No central pawn moves (e4/d4) in opening');
    recommendations.push('Start games by controlling center with e4 or d4');
  } else if (centerControl > 0) {
    strengths.push('Controlled center early in opening');
  }
  
  if (earlyDevelopment >= 2) {
    strengths.push('Good piece development in opening');
  }
  
  // Capture analysis
  if (playerCaptures > 0) {
    const captureTypes = moveHistory
      .filter(m => (m.captured || m.move.includes('x')) && m.player === playerColor)
      .map(m => m.move);
    tacticalPatterns.push(`Captured pieces: ${captureTypes.join(', ')}`);
  }
  
  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('Review the game with Stockfish analysis to find exact mistakes');
    recommendations.push('Solve 15 tactical puzzles daily to improve pattern recognition');
  }
  
  return {
    success: true,
    gameStats: {
      totalMoves,
      playerMoves: playerMoves.length,
      captures: playerCaptures,
      checks: playerChecks,
      castled,
      gamePhase
    },
    insights: {
      mistakes,
      strengths,
      recommendations
    },
    tacticalPatterns
  };
}
