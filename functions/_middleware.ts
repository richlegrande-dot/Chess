/**
 * Global Middleware
 * This middleware runs for all routes
 * 
 * Use this for:
 * - CORS headers
 * - Request logging
 * - Performance monitoring
 */

export async function onRequest(context) {
  const start = Date.now();
  
  // Handle CORS preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  
  // Process request
  const response = await context.next();
  
  // Add CORS headers to response
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  
  // Add performance header
  const duration = Date.now() - start;
  response.headers.set("X-Response-Time", `${duration}ms`);
  
  // Log request
  console.log({
    type: "request",
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    status: response.status,
    duration: `${duration}ms`,
  });
  
  return response;
}
