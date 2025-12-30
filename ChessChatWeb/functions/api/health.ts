/**
 * Health check endpoint for admin diagnostics
 */

export async function onRequestGet(context: {
  request: Request;
  env: any;
}) {
  const { request } = context;
  const url = new URL(request.url);
  const isTest = url.searchParams.has('test');
  
  return new Response(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: isTest ? 'test' : 'normal',
      service: 'ChessChat Pages',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
