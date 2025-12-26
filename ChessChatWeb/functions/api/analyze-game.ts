// Cloudflare Pages Function: Game Analysis with Wall-E
// Path: /api/analyze-game
// 
// NO API KEYS REQUIRED - Uses Wall-E engine with learning history

import { getWallEEngine } from '../lib/walleEngine';

interface Env {
  DATABASE_URL?: string;
}

interface AnalyzeGameRequest {
  pgn: string;
  moveHistory: any[];
  cpuLevel?: number;
  playerColor?: string;
  result?: string;
  userId?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await request.json() as AnalyzeGameRequest;
    const { pgn, moveHistory, cpuLevel, playerColor, result, userId } = requestData;

    if (!pgn || !moveHistory || !cpuLevel || !playerColor) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders },
        }
      );
    }

    // Generate user ID if not provided
    const effectiveUserId = userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if DATABASE_URL is available
    if (!env.DATABASE_URL) {
      // Fallback: Basic analysis without learning history
      const basicAnalysis = generateBasicAnalysis(moveHistory, playerColor, cpuLevel);
      
      return new Response(JSON.stringify({
        success: true,
        analysis: basicAnalysis,
        learningEnabled: false,
        note: 'Learning features disabled - DATABASE_URL not configured',
      }), {
        status: 200,
        headers: { ...corsHeaders },
      });
    }

    // Full Wall-E analysis with learning
    const walleEngine = getWallEEngine();
    const walleContext = {
      userId: effectiveUserId,
      databaseUrl: env.DATABASE_URL,
    };

    const analysisResponse = await walleEngine.analyzeGame(
      walleContext,
      pgn,
      moveHistory,
      {
        cpuLevel,
        playerColor,
        result,
      }
    );

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResponse.analysis,
      recommendations: analysisResponse.recommendations,
      personalizedInsights: analysisResponse.personalizedInsights,
      sourcesUsed: analysisResponse.sourcesUsed,
      confidenceScore: analysisResponse.confidenceScore,
      learningEnabled: true,
      // REQUIRED: Provable personalization
      historyEvidence: analysisResponse.historyEvidence,
      personalizedReferences: analysisResponse.personalizedReferences,
    }), {
      status: 200,
      headers: { ...corsHeaders },
    });

  } catch (error) {
    console.error('Game analysis error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      fallback: 'Review your game for tactical mistakes and missed opportunities. Focus on opening principles and endgame technique.',
    }), {
      status: 500,
      headers: { ...corsHeaders },
    });
  }
};

/**
 * Generate basic analysis when database unavailable
 */
function generateBasicAnalysis(
  moveHistory: any[],
  playerColor: string,
  cpuLevel: number
): string {
  const sections: string[] = [];

  sections.push(`Chess Game Analysis`);
  sections.push(`===================`);
  sections.push('');
  sections.push(`Game Details:`);
  sections.push(`• Your Color: ${playerColor}`);
  sections.push(`• CPU Difficulty: Level ${cpuLevel}/8`);
  sections.push(`• Total Moves: ${moveHistory.length}`);
  sections.push('');

  // Detect game phase
  const gamePhase = moveHistory.length < 15 ? 'Opening' : 
                    moveHistory.length > 40 ? 'Endgame' : 'Middlegame';

  sections.push(`Game Phase: ${gamePhase}`);
  sections.push('');

  // Phase-specific advice
  if (gamePhase === 'Opening') {
    sections.push(`Opening Advice:`);
    sections.push(`• Control the center with pawns (e4, d4, e5, d5)`);
    sections.push(`• Develop knights before bishops`);
    sections.push(`• Castle early (usually by move 10)`);
    sections.push(`• Don't move the same piece twice`);
    sections.push(`• Connect your rooks`);
  } else if (gamePhase === 'Middlegame') {
    sections.push(`Middlegame Strategy:`);
    sections.push(`• Look for tactical opportunities (forks, pins, skewers)`);
    sections.push(`• Create threats and put pressure on opponent`);
    sections.push(`• Improve piece positions`);
    sections.push(`• Control key squares and files`);
    sections.push(`• Calculate 2-3 moves ahead before moving`);
  } else {
    sections.push(`Endgame Technique:`);
    sections.push(`• Activate your king`);
    sections.push(`• Create passed pawns`);
    sections.push(`• Rook behind passed pawns`);
    sections.push(`• Use opposition in pawn endgames`);
    sections.push(`• Know basic checkmate patterns`);
  }

  sections.push('');
  sections.push(`General Recommendations:`);
  sections.push(`1. Analyze this game to find your mistakes`);
  sections.push(`2. Practice tactical puzzles for 15 minutes daily`);
  sections.push(`3. Study one opening deeply for ${playerColor}`);
  sections.push(`4. Play longer time controls to think carefully`);
  sections.push(`5. Review grandmaster games in this opening`);

  sections.push('');
  sections.push(`Next Steps:`);
  sections.push(`• Review each move where you felt uncertain`);
  sections.push(`• Identify 2-3 key moments that changed the game`);
  sections.push(`• Note patterns you want to work on`);
  sections.push(`• Play another game and apply what you learned`);

  sections.push('');
  sections.push(`Note: Enable DATABASE_URL for personalized coaching that improves based on your games!`);

  return sections.join('\n');
}
