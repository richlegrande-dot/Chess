/**
 * Knowledge Vault API - Heuristic Hints Retrieval
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
    const { fen, tags = ['tactics', 'strategy'], max = 8 } = await context.request.json();

    console.log(`[Heuristic Retrieval] FEN: ${fen}, Tags: ${tags.join(', ')}`);

    // Get heuristic hints based on tags
    const hints = getHeuristicHints(tags, max);

    console.log(`[Heuristic Retrieval] Returning ${hints.length} hints`);

    return new Response(JSON.stringify(hints), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('[Heuristic Retrieval] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve heuristics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

function getHeuristicHints(tags: string[], max: number) {
  const allHints = [
    {
      category: 'development',
      priority: 10,
      description: 'Develop knights before bishops in the opening',
      sourceId: 'opening-principles',
      chunkId: 'dev-1',
      tags: ['strategy', 'openings'],
    },
    {
      category: 'development',
      priority: 9,
      description: 'Control the center with pawns (e4, d4, e5, d5)',
      sourceId: 'opening-principles',
      chunkId: 'dev-2',
      tags: ['strategy', 'openings'],
    },
    {
      category: 'king-safety',
      priority: 8,
      description: 'Castle early to protect your king',
      sourceId: 'opening-principles',
      chunkId: 'safety-1',
      tags: ['strategy', 'king-safety'],
    },
    {
      category: 'material',
      priority: 9,
      description: 'Avoid hanging pieces - always check if pieces are defended',
      sourceId: 'tactical-fundamentals',
      chunkId: 'tact-1',
      tags: ['tactics'],
    },
    {
      category: 'material',
      priority: 10,
      description: 'Look for tactical opportunities: forks, pins, skewers',
      sourceId: 'tactical-fundamentals',
      chunkId: 'tact-2',
      tags: ['tactics'],
    },
    {
      category: 'position',
      priority: 7,
      description: 'Rooks belong on open files',
      sourceId: 'piece-placement',
      chunkId: 'pos-1',
      tags: ['strategy', 'endgames'],
    },
    {
      category: 'position',
      priority: 8,
      description: 'Knights are strongest in the center of the board',
      sourceId: 'piece-placement',
      chunkId: 'pos-2',
      tags: ['strategy'],
    },
    {
      category: 'development',
      priority: 7,
      description: "Don't move the same piece twice in the opening",
      sourceId: 'opening-principles',
      chunkId: 'dev-3',
      tags: ['strategy', 'openings'],
    },
    {
      category: 'king-safety',
      priority: 9,
      description: 'Keep pawns in front of your castled king',
      sourceId: 'king-safety-fundamentals',
      chunkId: 'safety-2',
      tags: ['strategy', 'king-safety'],
    },
    {
      category: 'material',
      priority: 8,
      description: 'When ahead in material, trade pieces (not pawns)',
      sourceId: 'endgame-principles',
      chunkId: 'end-1',
      tags: ['strategy', 'endgames'],
    },
  ];

  // Filter by tags
  const filtered = allHints.filter(hint =>
    hint.tags.some(t => tags.includes(t))
  );

  // Sort by priority and return top N
  return filtered
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max)
    .map(({ tags, ...hint }) => hint); // Remove tags from response
}
