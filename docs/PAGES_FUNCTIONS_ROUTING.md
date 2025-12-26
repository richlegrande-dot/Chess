# Cloudflare Pages Functions - File-Based Routing Guide

This guide explains how Cloudflare Pages Functions use file-based routing and how to structure your API endpoints.

## Overview

Cloudflare Pages Functions automatically map files in the `functions/` directory to URL routes. This file-based routing system eliminates the need for explicit route definitions.

## Basic Routing

### File to Route Mapping

```
functions/
├── index.js              → /
├── about.js              → /about
├── api/
│   ├── users.js          → /api/users
│   └── products.js       → /api/products
└── blog/
    └── [slug].js         → /blog/:slug (dynamic route)
```

## HTTP Methods

Each function file can export handlers for different HTTP methods:

```javascript
// functions/api/users.js

// Handle GET requests to /api/users
export async function onRequestGet(context) {
  return new Response(JSON.stringify({ users: [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle POST requests to /api/users
export async function onRequestPost(context) {
  const data = await context.request.json();
  return new Response(JSON.stringify({ created: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle all other methods
export async function onRequest(context) {
  return new Response('Method not allowed', { status: 405 });
}
```

### Available Method Handlers

- `onRequestGet` - GET requests
- `onRequestPost` - POST requests
- `onRequestPut` - PUT requests
- `onRequestPatch` - PATCH requests
- `onRequestDelete` - DELETE requests
- `onRequestHead` - HEAD requests
- `onRequestOptions` - OPTIONS requests
- `onRequest` - Fallback for all methods

## Context Object

Every function receives a `context` object with the following properties:

```javascript
export async function onRequestGet(context) {
  const {
    request,      // Request object
    env,          // Environment variables, secrets, and bindings
    params,       // Dynamic route parameters
    waitUntil,    // Function to extend execution
    next,         // Call next middleware
    data          // Shared data between middleware
  } = context;
}
```

### Request Object

```javascript
export async function onRequestPost(context) {
  const { request } = context;
  
  // Get request details
  const url = new URL(request.url);
  const method = request.method;
  const headers = request.headers;
  
  // Parse body
  const json = await request.json();        // JSON body
  const text = await request.text();        // Text body
  const formData = await request.formData(); // Form data
  
  // Get specific header
  const authHeader = request.headers.get('Authorization');
  
  return new Response('OK');
}
```

### Environment Object

Access secrets, KV namespaces, and environment variables:

```javascript
export async function onRequestGet(context) {
  const { env } = context;
  
  // Access secrets
  const apiKey = env.OPENAI_API_KEY;
  const dbUrl = env.DATABASE_URL;
  
  // Access KV namespaces
  await env.ANALYTICS_KV.put('key', 'value');
  const value = await env.ANALYTICS_KV.get('key');
  
  // Access environment variables
  const environment = env.ENVIRONMENT; // 'production' or 'preview'
  
  return new Response('OK');
}
```

## Dynamic Routes

Use square brackets in filenames to create dynamic routes:

### Single Parameter

```javascript
// functions/api/users/[id].js
// Matches: /api/users/123, /api/users/abc, etc.

export async function onRequestGet(context) {
  const { params } = context;
  const userId = params.id;
  
  return new Response(JSON.stringify({ userId }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Multiple Parameters

```javascript
// functions/api/posts/[postId]/comments/[commentId].js
// Matches: /api/posts/123/comments/456

export async function onRequestGet(context) {
  const { params } = context;
  const { postId, commentId } = params;
  
  return new Response(JSON.stringify({ postId, commentId }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Catch-All Routes

```javascript
// functions/[[path]].js
// Matches: any path not matched by other routes

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  return new Response(`Catch-all: ${url.pathname}`, {
    status: 404
  });
}
```

## Middleware

Middleware functions run before route handlers.

### Global Middleware

```javascript
// functions/_middleware.js
// Runs for all routes

export async function onRequest(context) {
  const { request, next } = context;
  
  // Log request
  console.log(`${request.method} ${request.url}`);
  
  // Add custom header
  const response = await next();
  response.headers.set('X-Custom-Header', 'value');
  
  return response;
}
```

### Path-Specific Middleware

```javascript
// functions/api/_middleware.js
// Runs for all routes under /api/*

export async function onRequest(context) {
  const { request, next, env } = context;
  
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Continue to the route handler
  return next();
}
```

### Multiple Middleware

Middleware executes in order from root to specific:

```
functions/
├── _middleware.js           → 1. Runs first
├── api/
│   ├── _middleware.js       → 2. Runs second for /api/* routes
│   └── users/
│       ├── _middleware.js   → 3. Runs third for /api/users/* routes
│       └── index.js         → 4. Final route handler
```

## Working with KV Namespaces

### Basic KV Operations

```javascript
export async function onRequestGet(context) {
  const { env } = context;
  const kv = env.ANALYTICS_KV;
  
  // Put a value
  await kv.put('key', 'value');
  
  // Put with expiration (TTL in seconds)
  await kv.put('key', 'value', { expirationTtl: 60 });
  
  // Put with metadata
  await kv.put('key', 'value', { 
    metadata: { userId: '123' }
  });
  
  // Get a value
  const value = await kv.get('key');
  
  // Get with metadata
  const { value, metadata } = await kv.getWithMetadata('key');
  
  // Delete a value
  await kv.delete('key');
  
  // List keys
  const { keys } = await kv.list();
  
  return new Response(JSON.stringify({ keys }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### KV for Rate Limiting

```javascript
export async function onRequestPost(context) {
  const { env, request } = context;
  const kv = env.RATE_LIMIT_KV;
  
  // Get client IP
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate-limit:${clientIP}`;
  
  // Check rate limit
  const count = await kv.get(key);
  
  if (count && parseInt(count) >= 10) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  // Increment counter
  const newCount = count ? parseInt(count) + 1 : 1;
  await kv.put(key, newCount.toString(), { 
    expirationTtl: 60 // Reset after 1 minute
  });
  
  return new Response('OK');
}
```

### KV for Analytics

```javascript
export async function onRequest(context) {
  const { env, request, next } = context;
  const kv = env.ANALYTICS_KV;
  
  // Track page view
  const url = new URL(request.url);
  const path = url.pathname;
  const key = `pageviews:${path}`;
  
  const views = await kv.get(key);
  const newViews = views ? parseInt(views) + 1 : 1;
  await kv.put(key, newViews.toString());
  
  // Continue to next handler
  return next();
}
```

## Response Helpers

### JSON Response

```javascript
export async function onRequestGet(context) {
  const data = { message: 'Hello, World!' };
  
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}
```

### HTML Response

```javascript
export async function onRequestGet(context) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Hello</title></head>
      <body><h1>Hello, World!</h1></body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Redirect

```javascript
export async function onRequestGet(context) {
  return Response.redirect('https://example.com', 302);
}
```

### Error Response

```javascript
export async function onRequestGet(context) {
  try {
    // Some operation
    throw new Error('Something went wrong');
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## CORS Configuration

```javascript
// functions/api/_middleware.js

export async function onRequest(context) {
  const { request, next } = context;
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // Add CORS headers to response
  const response = await next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  
  return response;
}
```

## Error Handling

### Custom Error Handler

```javascript
// functions/_middleware.js

export async function onRequest(context) {
  try {
    return await context.next();
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Validation

```javascript
export async function onRequestPost(context) {
  const { request } = context;
  
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({
      error: 'Invalid JSON'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Validate required fields
  if (!data.name || !data.email) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Process data...
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Best Practices

### 1. Use Middleware for Common Logic

Put authentication, logging, and error handling in middleware.

### 2. Keep Functions Small

Each function should do one thing well.

### 3. Use KV for State

Store session data, rate limits, and analytics in KV namespaces.

### 4. Handle Errors Gracefully

Always wrap operations in try-catch blocks.

### 5. Set Appropriate Cache Headers

```javascript
// Cache for 1 hour
headers: {
  'Cache-Control': 'public, max-age=3600'
}

// Never cache
headers: {
  'Cache-Control': 'no-cache, no-store, must-revalidate'
}
```

### 6. Use Environment Variables

Never hardcode secrets or configuration.

### 7. Validate Input

Always validate and sanitize user input.

## Testing Locally

Run the local development server:

```bash
npm run dev
```

Access your functions at:
- `http://localhost:8788/`
- `http://localhost:8788/api/health`

## Deployment

Functions are automatically deployed with your Pages project:

```bash
npm run deploy:production
```

## Debugging

### Console Logging

```javascript
export async function onRequestGet(context) {
  console.log('Request received');
  console.log('Headers:', context.request.headers);
  
  return new Response('OK');
}
```

View logs in:
- Cloudflare Dashboard → Pages → Your Project → Functions
- Wrangler CLI: `wrangler pages deployment tail`

### Error Messages

Return detailed error messages in development:

```javascript
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Some operation
  } catch (error) {
    if (env.ENVIRONMENT === 'preview') {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

## Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Workers Runtime API](https://developers.cloudflare.com/workers/runtime-apis/)
- [KV Documentation](https://developers.cloudflare.com/kv/)
