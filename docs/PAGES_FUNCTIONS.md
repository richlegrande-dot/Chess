# Cloudflare Pages Functions Guide

Complete guide to building backend APIs with Cloudflare Pages Functions for ChessChat Web.

## Table of Contents

1. [Overview](#overview)
2. [File-based Routing](#file-based-routing)
3. [Function Handlers](#function-handlers)
4. [Context API](#context-api)
5. [Middleware](#middleware)
6. [TypeScript Support](#typescript-support)
7. [KV Storage Integration](#kv-storage-integration)
8. [Database Integration](#database-integration)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

## Overview

Cloudflare Pages Functions provide a serverless backend for your Pages application. Functions run on Cloudflare's global network, providing low-latency responses worldwide.

### Key Features

- **File-based routing**: Functions map to URL paths based on file structure
- **TypeScript support**: Full TypeScript support out of the box
- **Zero configuration**: No build step required for Functions
- **Global deployment**: Deployed to Cloudflare's edge network
- **Integrated bindings**: Access to KV, Durable Objects, R2, D1, and more

### Architecture

```
functions/
├── api/
│   ├── users/
│   │   ├── [id].ts          → /api/users/:id
│   │   └── index.ts         → /api/users
│   ├── games/
│   │   ├── [gameId].ts      → /api/games/:gameId
│   │   └── index.ts         → /api/games
│   └── health.ts            → /api/health
├── _middleware.ts           → Runs for all routes
└── [[path]].ts              → Catch-all route
```

## File-based Routing

### Basic Routing

Files in the `functions/` directory automatically become HTTP endpoints:

```typescript
// functions/api/hello.ts
export async function onRequestGet() {
  return new Response("Hello World!");
}
```

**Route**: `/api/hello`

### Dynamic Routes

Use square brackets `[param]` for dynamic segments:

```typescript
// functions/api/users/[id].ts
export async function onRequestGet(context) {
  const { id } = context.params;
  return Response.json({ userId: id });
}
```

**Routes**: 
- `/api/users/123` → `{ userId: "123" }`
- `/api/users/abc` → `{ userId: "abc" }`

### Nested Dynamic Routes

```typescript
// functions/api/games/[gameId]/moves/[moveId].ts
export async function onRequestGet(context) {
  const { gameId, moveId } = context.params;
  return Response.json({ gameId, moveId });
}
```

**Route**: `/api/games/abc123/moves/5`

### Catch-all Routes

Use double square brackets `[[path]]` for catch-all routes:

```typescript
// functions/api/[[path]].ts
export async function onRequestGet(context) {
  const path = context.params.path || [];
  return Response.json({ 
    path,
    message: "Catch-all route"
  });
}
```

**Matches**: `/api/anything/you/want`

### Index Routes

`index.ts` files map to the directory path:

```typescript
// functions/api/index.ts
export async function onRequestGet() {
  return Response.json({ message: "API root" });
}
```

**Route**: `/api` or `/api/`

## Function Handlers

### HTTP Method Handlers

Export named functions for specific HTTP methods:

```typescript
// GET request handler
export async function onRequestGet(context) {
  return Response.json({ method: "GET" });
}

// POST request handler
export async function onRequestPost(context) {
  const body = await context.request.json();
  return Response.json({ method: "POST", body });
}

// PUT request handler
export async function onRequestPut(context) {
  return Response.json({ method: "PUT" });
}

// DELETE request handler
export async function onRequestDelete(context) {
  return Response.json({ method: "DELETE" });
}

// PATCH request handler
export async function onRequestPatch(context) {
  return Response.json({ method: "PATCH" });
}

// HEAD request handler
export async function onRequestHead(context) {
  return new Response(null, { status: 200 });
}

// OPTIONS request handler
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

### Generic Handler

Handle all HTTP methods with `onRequest`:

```typescript
export async function onRequest(context) {
  const method = context.request.method;
  
  if (method === "GET") {
    return Response.json({ method: "GET" });
  }
  
  if (method === "POST") {
    return Response.json({ method: "POST" });
  }
  
  return new Response("Method not allowed", { status: 405 });
}
```

## Context API

The context object provides access to request data and environment bindings.

### Context Properties

```typescript
interface Context {
  request: Request;           // Standard Request object
  env: Env;                   // Environment bindings (KV, secrets, etc.)
  params: Params;             // Route parameters
  waitUntil: (promise: Promise<any>) => void;  // Background tasks
  next: () => Promise<Response>;  // Call next middleware/function
  data: Record<string, any>;  // Data passed between middleware
  functionPath: string;       // Path to the function file
}
```

### Request Object

```typescript
export async function onRequestPost(context) {
  const { request } = context;
  
  // Request properties
  console.log(request.method);        // "POST"
  console.log(request.url);           // Full URL
  console.log(request.headers);       // Headers object
  
  // Parse JSON body
  const json = await request.json();
  
  // Parse form data
  const formData = await request.formData();
  
  // Get text body
  const text = await request.text();
  
  // Get binary body
  const buffer = await request.arrayBuffer();
  
  return Response.json({ received: json });
}
```

### Environment Bindings

```typescript
export async function onRequestGet(context) {
  const { env } = context;
  
  // Access KV namespaces
  const value = await env.CACHE.get("key");
  
  // Access secrets
  const dbUrl = env.DATABASE_URL;
  
  // Access other bindings
  const bucket = env.MY_BUCKET;  // R2 bucket
  
  return Response.json({ value });
}
```

### Route Parameters

```typescript
// functions/api/games/[gameId]/moves/[moveId].ts
export async function onRequestGet(context) {
  const { gameId, moveId } = context.params;
  
  return Response.json({ gameId, moveId });
}
```

### Query Parameters

```typescript
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const params = url.searchParams;
  
  const page = params.get("page") || "1";
  const limit = params.get("limit") || "10";
  
  return Response.json({ page, limit });
}
```

## Middleware

Middleware runs before route handlers and can modify requests/responses.

### Creating Middleware

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  // Add CORS headers
  const response = await context.next();
  
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  
  return response;
}
```

### Middleware for Specific Methods

```typescript
// functions/_middleware.ts
export async function onRequestGet(context) {
  console.log("GET request middleware");
  return context.next();
}

export async function onRequestPost(context) {
  console.log("POST request middleware");
  return context.next();
}
```

### Authentication Middleware

```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  const token = context.request.headers.get("Authorization");
  
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Verify token
  try {
    const user = await verifyToken(token, context.env.JWT_SECRET);
    context.data.user = user;  // Pass user to handlers
    return context.next();
  } catch (error) {
    return new Response("Invalid token", { status: 401 });
  }
}
```

### Logging Middleware

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  const start = Date.now();
  
  // Process request
  const response = await context.next();
  
  // Log request details
  const duration = Date.now() - start;
  console.log({
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    status: response.status,
    duration: `${duration}ms`,
  });
  
  return response;
}
```

## TypeScript Support

### Type Definitions

```typescript
// functions/types.ts
export interface Env {
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  GAME_STATE: KVNamespace;
  DATABASE_URL: string;
  JWT_SECRET: string;
  API_SECRET_KEY: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Game {
  id: string;
  whitePlayer: string;
  blackPlayer: string;
  moves: string[];
  status: "active" | "completed" | "abandoned";
}
```

### Typed Handlers

```typescript
// functions/api/users/[id].ts
import type { Env, User } from "../../types";

interface Params {
  id: string;
}

interface Context {
  request: Request;
  env: Env;
  params: Params;
}

export async function onRequestGet(context: Context): Promise<Response> {
  const { id } = context.params;
  const { CACHE } = context.env;
  
  // Get user from cache
  const cached = await CACHE.get<User>(`user:${id}`, "json");
  
  if (cached) {
    return Response.json(cached);
  }
  
  // Fetch user from database
  const user: User = await fetchUserFromDB(id, context.env.DATABASE_URL);
  
  // Cache user
  await CACHE.put(`user:${id}`, JSON.stringify(user), {
    expirationTtl: 3600,
  });
  
  return Response.json(user);
}
```

## KV Storage Integration

### Basic KV Operations

```typescript
export async function onRequest(context) {
  const { CACHE } = context.env;
  
  // Get value
  const value = await CACHE.get("key");
  
  // Get with metadata
  const { value, metadata } = await CACHE.getWithMetadata("key");
  
  // Get as JSON
  const json = await CACHE.get("key", "json");
  
  // Put value
  await CACHE.put("key", "value");
  
  // Put with expiration
  await CACHE.put("key", "value", {
    expirationTtl: 3600,  // 1 hour
  });
  
  // Put with metadata
  await CACHE.put("key", "value", {
    metadata: { createdAt: Date.now() },
  });
  
  // Delete value
  await CACHE.delete("key");
  
  // List keys
  const list = await CACHE.list();
  
  return Response.json({ success: true });
}
```

### Session Management

```typescript
// functions/api/sessions.ts
import { nanoid } from "nanoid";

export async function onRequestPost(context) {
  const { SESSIONS } = context.env;
  const { username, password } = await context.request.json();
  
  // Verify credentials
  const user = await verifyCredentials(username, password);
  
  if (!user) {
    return new Response("Invalid credentials", { status: 401 });
  }
  
  // Create session
  const sessionId = nanoid();
  const sessionData = {
    userId: user.id,
    username: user.username,
    createdAt: Date.now(),
  };
  
  // Store session (expires in 7 days)
  await SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(sessionData),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  
  return Response.json({ sessionId });
}
```

### Caching Strategy

```typescript
// functions/api/data/[id].ts
export async function onRequestGet(context) {
  const { id } = context.params;
  const { CACHE } = context.env;
  const cacheKey = `data:${id}`;
  
  // Try cache first
  const cached = await CACHE.get(cacheKey, "json");
  if (cached) {
    return Response.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }
  
  // Fetch from source
  const data = await fetchData(id);
  
  // Cache for 5 minutes
  await CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: 300,
  });
  
  return Response.json(data, {
    headers: { "X-Cache": "MISS" },
  });
}
```

## Database Integration

### Using Prisma

```typescript
// functions/api/users/index.ts
import { PrismaClient } from "@prisma/client";

export async function onRequestGet(context) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: context.env.DATABASE_URL,
      },
    },
  });
  
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
    
    return Response.json(users);
  } finally {
    await prisma.$disconnect();
  }
}
```

### Connection Pooling

For serverless environments, always use a connection pooler:

```typescript
// Recommended: Use Prisma Data Proxy or Accelerate
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,  // Points to connection pooler
    },
  },
});

// Alternative: Use direct connection with pooling
// DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
```

## Error Handling

### Try-Catch Pattern

```typescript
export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // Process data
    const result = await processData(data);
    
    return Response.json(result);
  } catch (error) {
    console.error("Error processing request:", error);
    
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Validation Errors

```typescript
export async function onRequestPost(context) {
  const data = await context.request.json();
  
  // Validate input
  if (!data.username || data.username.length < 3) {
    return Response.json(
      { error: "Username must be at least 3 characters" },
      { status: 400 }
    );
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    return Response.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }
  
  // Process valid data
  return Response.json({ success: true });
}
```

### Error Middleware

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  try {
    return await context.next();
  } catch (error) {
    console.error("Unhandled error:", error);
    
    return Response.json(
      { 
        error: "Internal server error",
        message: error.message 
      },
      { status: 500 }
    );
  }
}
```

## Best Practices

### 1. Use TypeScript

Always use TypeScript for type safety and better IDE support.

### 2. Handle CORS

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  // Handle OPTIONS preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  
  const response = await context.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  
  return response;
}
```

### 3. Implement Rate Limiting

```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  const { CACHE } = context.env;
  const ip = context.request.headers.get("CF-Connecting-IP");
  const key = `ratelimit:${ip}`;
  
  const count = await CACHE.get(key);
  
  if (count && parseInt(count) > 100) {
    return new Response("Rate limit exceeded", { status: 429 });
  }
  
  await CACHE.put(key, String((parseInt(count || "0") + 1)), {
    expirationTtl: 60,  // 1 minute window
  });
  
  return context.next();
}
```

### 4. Use Background Tasks

```typescript
export async function onRequestPost(context) {
  const data = await context.request.json();
  
  // Process synchronously
  const result = await processData(data);
  
  // Run analytics in background
  context.waitUntil(
    recordAnalytics(context.env.ANALYTICS, data)
  );
  
  return Response.json(result);
}
```

### 5. Cache Aggressively

```typescript
export async function onRequestGet(context) {
  const response = await fetchData();
  
  // Cache in KV
  await context.env.CACHE.put("data", JSON.stringify(response), {
    expirationTtl: 300,
  });
  
  // Also use HTTP caching
  return Response.json(response, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
```

### 6. Log Strategically

```typescript
export async function onRequest(context) {
  const start = Date.now();
  
  console.log({
    type: "request",
    method: context.request.method,
    path: new URL(context.request.url).pathname,
  });
  
  const response = await context.next();
  
  console.log({
    type: "response",
    status: response.status,
    duration: Date.now() - start,
  });
  
  return response;
}
```

### 7. Secure Sensitive Operations

```typescript
export async function onRequestPost(context) {
  // Verify API key
  const apiKey = context.request.headers.get("X-API-Key");
  
  if (apiKey !== context.env.API_SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Process secure operation
  return Response.json({ success: true });
}
```

## Additional Resources

- [Cloudflare Pages Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [Workers Runtime API](https://developers.cloudflare.com/workers/runtime-apis/)
- [KV Documentation](https://developers.cloudflare.com/kv/)
- [TypeScript Definitions](https://github.com/cloudflare/workers-types)
