/**
 * Example KV Storage Endpoint
 * GET /api/examples/kv - Get a value from KV
 * POST /api/examples/kv - Set a value in KV
 * 
 * This demonstrates how to use KV storage in Pages Functions.
 */

export async function onRequestGet(context) {
  const { CACHE } = context.env;
  
  // Get a value from KV
  const value = await CACHE.get("example-key");
  
  return Response.json({
    key: "example-key",
    value: value || null,
    cached: value !== null,
  });
}

export async function onRequestPost(context) {
  const { CACHE } = context.env;
  const { key, value, ttl } = await context.request.json();
  
  // Validate input
  if (!key || !value) {
    return Response.json(
      { error: "Both 'key' and 'value' are required" },
      { status: 400 }
    );
  }
  
  // Store in KV
  const options = ttl ? { expirationTtl: ttl } : undefined;
  await CACHE.put(key, value, options);
  
  return Response.json({
    success: true,
    key,
    value,
    ttl: ttl || "no expiration",
  });
}
