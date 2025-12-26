/**
 * Example Health Check Endpoint
 * GET /api/health
 * 
 * This endpoint provides a simple health check for the application.
 */

export async function onRequestGet(context) {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: context.env.NODE_ENV || "production",
  });
}
