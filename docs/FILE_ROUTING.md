# File-based Routing Guide

Complete guide to Cloudflare Pages Functions file-based routing system.

## Overview

Cloudflare Pages Functions use file-based routing where the file structure in the `functions/` directory automatically maps to HTTP endpoints.

## Routing Rules

### Basic File Mapping

| File Path | URL Path |
|-----------|----------|
| `functions/index.ts` | `/` |
| `functions/api/index.ts` | `/api` |
| `functions/api/health.ts` | `/api/health` |
| `functions/users.ts` | `/users` |

### Directory Nesting

```
functions/
├── api/
│   ├── users/
│   │   ├── index.ts        → /api/users
│   │   └── profile.ts      → /api/users/profile
│   └── games/
│       └── index.ts        → /api/games
└── health.ts               → /health
```

## Dynamic Routes

### Single Parameter

```typescript
// functions/api/users/[id].ts
export async function onRequestGet(context) {
  const { id } = context.params;
  return Response.json({ userId: id });
}
```

**Matches:**
- `/api/users/123` → `{ userId: "123" }`
- `/api/users/abc` → `{ userId: "abc" }`
- `/api/users/user-name` → `{ userId: "user-name" }`

### Multiple Parameters

```typescript
// functions/api/games/[gameId]/moves/[moveId].ts
export async function onRequestGet(context) {
  const { gameId, moveId } = context.params;
  return Response.json({ gameId, moveId });
}
```

**Matches:**
- `/api/games/game123/moves/5` → `{ gameId: "game123", moveId: "5" }`

### Nested Dynamic Routes

```typescript
// functions/api/[version]/users/[id].ts
export async function onRequestGet(context) {
  const { version, id } = context.params;
  return Response.json({ 
    version,    // "v1", "v2", etc.
    userId: id 
  });
}
```

**Matches:**
- `/api/v1/users/123`
- `/api/v2/users/456`

## Catch-all Routes

### Basic Catch-all

```typescript
// functions/api/[[path]].ts
export async function onRequestGet(context) {
  const path = context.params.path;
  
  // path is an array of path segments
  return Response.json({ 
    path,
    message: "Catch-all route"
  });
}
```

**Matches:**
- `/api/anything` → `{ path: ["anything"] }`
- `/api/any/nested/path` → `{ path: ["any", "nested", "path"] }`

### Named Catch-all

```typescript
// functions/api/files/[[filepath]].ts
export async function onRequestGet(context) {
  const filepath = context.params.filepath || [];
  const fullPath = filepath.join("/");
  
  return Response.json({ 
    filepath: fullPath 
  });
}
```

**Matches:**
- `/api/files/documents/report.pdf` → `{ filepath: "documents/report.pdf" }`

## Route Priority

When multiple routes could match a URL, Pages Functions use this priority order:

1. **Static routes** (exact matches)
2. **Dynamic routes** (single parameter)
3. **Catch-all routes** (multiple parameters)

### Example

```
functions/
├── api/
│   ├── users.ts            # Priority 1: /api/users
│   ├── [resource].ts       # Priority 2: /api/anything-else
│   └── [[path]].ts         # Priority 3: /api/any/nested/path
```

**Matching:**
- `/api/users` → `users.ts` (static route wins)
- `/api/games` → `[resource].ts` (dynamic route)
- `/api/v1/data/items` → `[[path]].ts` (catch-all route)

## Index Routes

### Directory Index

`index.ts` files represent the directory itself:

```typescript
// functions/api/index.ts
export async function onRequestGet() {
  return Response.json({ 
    message: "API root",
    endpoints: ["/api/users", "/api/games"]
  });
}
```

**Matches:**
- `/api`
- `/api/`

### Root Index

```typescript
// functions/index.ts
export async function onRequestGet() {
  return Response.json({ 
    message: "Root endpoint"
  });
}
```

**Matches:**
- `/`

## HTTP Methods

### Method-specific Handlers

```typescript
// functions/api/users.ts

// GET /api/users
export async function onRequestGet(context) {
  return Response.json({ method: "GET" });
}

// POST /api/users
export async function onRequestPost(context) {
  const body = await context.request.json();
  return Response.json({ method: "POST", body });
}

// PUT /api/users
export async function onRequestPut(context) {
  return Response.json({ method: "PUT" });
}

// DELETE /api/users
export async function onRequestDelete(context) {
  return Response.json({ method: "DELETE" });
}

// PATCH /api/users
export async function onRequestPatch(context) {
  return Response.json({ method: "PATCH" });
}
```

### Generic Handler

```typescript
// functions/api/proxy.ts
export async function onRequest(context) {
  // Handles all HTTP methods
  return Response.json({ 
    method: context.request.method 
  });
}
```

## Middleware

### Global Middleware

```typescript
// functions/_middleware.ts
export async function onRequest(context) {
  console.log("Global middleware");
  return context.next();
}
```

**Applies to:** All routes

### Path-specific Middleware

```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  console.log("API middleware");
  return context.next();
}
```

**Applies to:** All routes under `/api/*`

### Middleware Chain

```
functions/
├── _middleware.ts           # Runs first (global)
├── api/
│   ├── _middleware.ts       # Runs second (api/*)
│   ├── users/
│   │   ├── _middleware.ts   # Runs third (api/users/*)
│   │   └── [id].ts          # Runs last (handler)
```

**Execution order for `/api/users/123`:**
1. `functions/_middleware.ts`
2. `functions/api/_middleware.ts`
3. `functions/api/users/_middleware.ts`
4. `functions/api/users/[id].ts`

## Advanced Patterns

### API Versioning

```
functions/
├── api/
│   ├── v1/
│   │   ├── users.ts         → /api/v1/users
│   │   └── games.ts         → /api/v1/games
│   └── v2/
│       ├── users.ts         → /api/v2/users
│       └── games.ts         → /api/v2/games
```

### RESTful Resources

```
functions/
├── api/
│   └── users/
│       ├── index.ts         → GET/POST /api/users
│       ├── [id].ts          → GET/PUT/DELETE /api/users/:id
│       └── [id]/
│           ├── profile.ts   → /api/users/:id/profile
│           └── settings.ts  → /api/users/:id/settings
```

```typescript
// functions/api/users/index.ts
export async function onRequestGet() {
  // List all users
  return Response.json({ users: [] });
}

export async function onRequestPost(context) {
  // Create new user
  const user = await context.request.json();
  return Response.json({ user }, { status: 201 });
}

// functions/api/users/[id].ts
export async function onRequestGet(context) {
  // Get single user
  const { id } = context.params;
  return Response.json({ userId: id });
}

export async function onRequestPut(context) {
  // Update user
  const { id } = context.params;
  const updates = await context.request.json();
  return Response.json({ userId: id, updates });
}

export async function onRequestDelete(context) {
  // Delete user
  const { id } = context.params;
  return Response.json({ deleted: id });
}
```

### WebSocket Upgrade

```typescript
// functions/api/ws.ts
export async function onRequestGet(context) {
  const upgradeHeader = context.request.headers.get("Upgrade");
  
  if (upgradeHeader === "websocket") {
    // Upgrade to WebSocket
    const [client, server] = Object.values(new WebSocketPair());
    
    server.accept();
    server.addEventListener("message", (event) => {
      server.send(`Echo: ${event.data}`);
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  return new Response("Expected WebSocket upgrade", { status: 426 });
}
```

### File Upload Handling

```typescript
// functions/api/upload.ts
export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const file = formData.get("file");
  
  if (file instanceof File) {
    const { MY_BUCKET } = context.env;
    
    // Upload to R2
    await MY_BUCKET.put(file.name, file.stream());
    
    return Response.json({
      success: true,
      filename: file.name,
      size: file.size,
    });
  }
  
  return Response.json(
    { error: "No file provided" },
    { status: 400 }
  );
}
```

## SPA Routing Integration

### React Router Configuration

Create a `_redirects` file for client-side routing:

```
# public/_redirects
/api/* 200
/* /index.html 200
```

This ensures:
- API routes are handled by Functions
- All other routes serve `index.html` (for React Router)

### Example Structure

```
├── functions/
│   └── api/
│       └── *.ts              # Backend API routes
├── public/
│   └── _redirects            # Routing configuration
└── src/
    └── App.tsx               # React Router setup
```

## Testing Routes

### Local Development

```bash
# Install Wrangler
npm install -g wrangler

# Run local dev server
wrangler pages dev dist -- npm run dev
```

### Testing Dynamic Routes

```bash
# Test dynamic route
curl http://localhost:8788/api/users/123

# Test catch-all route
curl http://localhost:8788/api/files/documents/report.pdf

# Test with method
curl -X POST http://localhost:8788/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John"}'
```

## Best Practices

### 1. Organize by Feature

```
functions/
├── api/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── refresh.ts
│   ├── games/
│   │   ├── index.ts
│   │   ├── [id].ts
│   │   └── [id]/
│   │       └── moves.ts
│   └── users/
│       ├── index.ts
│       └── [id].ts
```

### 2. Use Middleware for Cross-cutting Concerns

```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  // CORS
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      },
    });
  }
  
  // Logging
  console.log({
    method: context.request.method,
    path: new URL(context.request.url).pathname,
  });
  
  // Authentication
  const token = context.request.headers.get("Authorization");
  if (token) {
    context.data.user = await verifyToken(token);
  }
  
  return context.next();
}
```

### 3. Keep Functions Small and Focused

```typescript
// Good: Single responsibility
// functions/api/users/[id]/profile.ts
export async function onRequestGet(context) {
  const { id } = context.params;
  const profile = await getUserProfile(id);
  return Response.json(profile);
}

// Bad: Too many responsibilities
// functions/api/users.ts
export async function onRequest(context) {
  // Handles users, profiles, settings, etc.
  // Too complex!
}
```

### 4. Document Your Routes

```typescript
/**
 * User Profile API
 * 
 * GET /api/users/:id/profile
 * Returns the public profile for a user
 * 
 * @param {string} id - User ID
 * @returns {Profile} User profile object
 */
export async function onRequestGet(context) {
  // Implementation
}
```

### 5. Handle Errors Gracefully

```typescript
export async function onRequestGet(context) {
  try {
    const { id } = context.params;
    const user = await getUser(id);
    
    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    return Response.json(user);
  } catch (error) {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Common Patterns

### Pagination

```typescript
// functions/api/users/index.ts
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  
  const users = await getUsers({ page, limit });
  
  return Response.json({
    data: users,
    pagination: {
      page,
      limit,
      total: users.length,
    },
  });
}
```

### Search and Filtering

```typescript
// functions/api/games/index.ts
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const status = url.searchParams.get("status");
  const player = url.searchParams.get("player");
  
  const games = await searchGames({ status, player });
  
  return Response.json({ games });
}
```

### Batch Operations

```typescript
// functions/api/users/batch.ts
export async function onRequestPost(context) {
  const { operations } = await context.request.json();
  
  const results = await Promise.all(
    operations.map(op => processOperation(op))
  );
  
  return Response.json({ results });
}
```

## Resources

- [Cloudflare Pages Functions Routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Workers Runtime API](https://developers.cloudflare.com/workers/runtime-apis/)
- [Request/Response API](https://developers.cloudflare.com/workers/runtime-apis/request/)
