/**
 * Chat API endpoint - Stub implementation
 * Returns truthful message about chat functionality not being available
 */

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    
    // Return truthful response about capabilities
    return new Response(
      JSON.stringify({
        success: true,
        response: "Chat functionality is currently unavailable. Your local coaching system is still analyzing your games and providing insights!",
        serverCapabilities: {
          chatEnabled: false,
          localCoachingEnabled: true
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid request format',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
