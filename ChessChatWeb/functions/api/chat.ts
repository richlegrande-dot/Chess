/**
 * Chat API endpoint - Stub implementation
 * Returns a generic message since AI chat isn't deployed
 */

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    
    // Return a helpful stub response
    return new Response(
      JSON.stringify({
        success: true,
        response: "Chat functionality is currently unavailable. Your local coaching system is still analyzing your games and providing insights!",
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
