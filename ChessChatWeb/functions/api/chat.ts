// Cloudflare Pages Function: Chat with Wall-E
// Path: /api/chat
// 
// NO API KEYS REQUIRED - Uses Wall-E engine with learning history

import { getWallEEngine } from '../lib/walleEngine';
import { sanitizeUserMessage, checkRateLimit, getClientIP } from '../lib/security';

interface Env {
  DATABASE_URL?: string;
  RATE_LIMIT_KV?: KVNamespace;
  RATE_LIMIT_PER_IP?: string;
  RATE_LIMIT_WINDOW?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface GameContext {
  finalFEN?: string;
  pgn?: string;
  result?: string;
  blunders?: number;
  mistakes?: number;
  accuracy?: number;
  rating?: number;
  takeaways?: any[];
}

interface ChatRequest {
  message: string;
  userId?: string;
  gameContext?: GameContext;
  chatHistory?: ChatMessage[];
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Rate limiting (if KV available)
    if (context.env.RATE_LIMIT_KV) {
      const clientIP = getClientIP(context.request);
      const limit = parseInt(context.env.RATE_LIMIT_PER_IP || '30');
      const window = parseInt(context.env.RATE_LIMIT_WINDOW || '60');
      
      const rateLimitCheck = await checkRateLimit(context.env.RATE_LIMIT_KV, clientIP, limit, window);
      
      if (!rateLimitCheck.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          resetAt: rateLimitCheck.resetAt
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString(),
          },
        });
      }
    }

    const requestData = (await context.request.json()) as ChatRequest;
    const { message, userId, gameContext, chatHistory } = requestData;

    // Sanitize user message
    let sanitizedMessage: string;
    try {
      sanitizedMessage = sanitizeUserMessage(message);
    } catch (sanitizeError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid input: message contains unsafe characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate user ID if not provided
    const effectiveUserId = userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if DATABASE_URL is available for learning features
    if (!context.env.DATABASE_URL) {
      // Fallback: Basic coaching without personalization
      const walleEngine = getWallEEngine();
      
      // Simple response without database
      const fallbackResponse = generateFallbackResponse(sanitizedMessage, gameContext);
      
      return new Response(JSON.stringify({
        success: true,
        response: fallbackResponse,
        learningEnabled: false,
        note: 'Learning features disabled - DATABASE_URL not configured',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full Wall-E with learning history
    const walleEngine = getWallEEngine();
    const walleContext = {
      userId: effectiveUserId,
      databaseUrl: context.env.DATABASE_URL,
    };

    const chatResponse = await walleEngine.chat(
      walleContext,
      sanitizedMessage,
      gameContext
    );

    return new Response(JSON.stringify({
      success: true,
      response: chatResponse.response,
      confidenceScore: chatResponse.confidenceScore,
      sourcesUsed: chatResponse.sourcesUsed,
      learningApplied: chatResponse.learningApplied,
      learningEnabled: true,
      // REQUIRED: Provable personalization
      historyEvidence: chatResponse.historyEvidence,
      personalizedReferences: chatResponse.personalizedReferences,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Chat error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: 'I\'m here to help with your chess questions. Try asking about openings, tactics, or endgames.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// CORS handler
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Generate fallback response when database unavailable
 */
function generateFallbackResponse(message: string, gameContext?: GameContext): string {
  const lowerMessage = message.toLowerCase();

  // Game-specific response
  if (gameContext) {
    const sections: string[] = [];
    sections.push('Game Summary:');
    
    if (gameContext.accuracy !== undefined) {
      sections.push(`• Accuracy: ${gameContext.accuracy}%`);
    }
    if (gameContext.blunders !== undefined) {
      sections.push(`• Blunders: ${gameContext.blunders}`);
    }
    if (gameContext.mistakes !== undefined) {
      sections.push(`• Mistakes: ${gameContext.mistakes}`);
    }
    
    sections.push('');
    sections.push('General Advice:');
    
    if (gameContext.blunders && gameContext.blunders > 2) {
      sections.push('• Practice tactical puzzles daily to reduce blunders');
    }
    if (gameContext.accuracy && gameContext.accuracy < 70) {
      sections.push('• Slow down and calculate 2-3 moves ahead');
    }
    
    sections.push('• Analyze your games to understand mistakes');
    sections.push('• Focus on fundamental principles');
    
    return sections.join('\n');
  }

  // Topic-based responses
  if (lowerMessage.includes('opening')) {
    return `Opening Principles:
• Control the center with pawns and pieces
• Develop your pieces (knights before bishops)
• Castle early for king safety
• Don't move the same piece twice
• Connect your rooks

Try the Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4) for beginners!`;
  }

  if (lowerMessage.includes('tactic') || lowerMessage.includes('fork') || lowerMessage.includes('pin')) {
    return `Tactical Patterns:
• Fork: Attack two pieces at once (especially with knights)
• Pin: Restrict piece movement by attacking through it
• Skewer: Force a valuable piece to move, exposing another
• Discovered attack: Move one piece to reveal another's attack

Practice 15 minutes of tactical puzzles daily!`;
  }

  if (lowerMessage.includes('endgame')) {
    return `Endgame Fundamentals:
• Activate your king (it's powerful in endgames)
• Create passed pawns
• Use opposition in pawn endgames
• Rook behind passed pawns
• Study basic checkmate patterns (Q+K vs K, R+K vs K)

Key principle: Every pawn move matters!`;
  }

  if (lowerMessage.includes('improve') || lowerMessage.includes('better')) {
    return `Improvement Tips:
• Play regularly (at least 3 games/week)
• Analyze every game you play
• Practice tactical puzzles daily
• Study master games in your openings
• Learn endgame basics
• Play longer time controls to think deeply

Consistency is key!`;
  }

  // Default response
  return `I'm Wall-E, your chess coach! I can help with:
• Opening principles and strategy
• Tactical patterns and puzzles
• Endgame techniques
• Game analysis and improvement tips
• Position evaluation

Ask me anything about chess! (Note: Full learning features require database connection)`;
}
