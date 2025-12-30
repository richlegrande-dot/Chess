# Pages Functions API - DEPRECATED

**Status:** 🔴 **ARCHIVED - NO LONGER IN USE**  
**Date Archived:** December 28, 2024  
**Replacement:** Worker API at `chesschat.uk/api/*`

---

## Why This Was Archived

The hybrid architecture (Pages Functions + Worker service binding) has been fully retired in favor of a **single Worker API** deployment.

### Previous Architecture (DEPRECATED):
```
Browser → Pages Functions (/api/*) → Service Binding → Wall-E Worker
```

### Current Architecture (ACTIVE):
```
Browser → Worker API (/api/*) → Prisma Accelerate → Database
```

---

## What Was Moved

All API endpoints from `functions/api/` including:

- ❌ `functions/api/chess-move.ts` - Chess engine endpoint
- ❌ `functions/api/admin/worker-health.ts` - Health check
- ❌ `functions/api/admin/worker-calls.ts` - Call logs
- ❌ All other admin/knowledge/wall-e endpoints

These are now handled by:
- ✅ `worker-api/src/index.ts` - Single Worker implementation

---

## Benefits of Worker API

1. **Simpler architecture** - No service binding complexity
2. **Better performance** - Direct routing, no intermediate layer
3. **Easier debugging** - Single Worker to monitor
4. **Unified logging** - All requests logged to `WorkerCallLog` table
5. **Direct database access** - Prisma Accelerate from Worker

---

## Migration Guide

If you need to restore or reference old Pages Functions code:

1. **Chess Move Endpoint:**
   - Old: `functions/api/chess-move.ts`
   - New: `worker-api/src/index.ts` → `handleChessMove()`

2. **Admin Endpoints:**
   - Old: `functions/api/admin/*`
   - New: `worker-api/src/index.ts` → admin routes section

3. **Database Access:**
   - Old: Service binding to Worker
   - New: Direct Prisma Client with `@prisma/client/edge`

---

## Verification

To confirm Pages Functions are not being used:

```powershell
# Check Worker route handles all /api/* requests
curl https://chesschat.uk/api/admin/worker-health

# Response should show Worker API version (not Pages Functions)
# Look for "engine": "worker", "mode": "worker" in responses
```

---

## Important: Do Not Re-Enable

If you're considering re-enabling Pages Functions:

1. The Worker API is the **production standard** going forward
2. Pages Functions lack direct database access
3. Service bindings add unnecessary complexity
4. Worker API has comprehensive logging and monitoring

**Contact the team before making any changes to this architecture.**

---

## References

- Worker API: `worker-api/`
- Deployment Guide: `WORKER_DEPLOYMENT.md`
- Success Report: `WORKER_API_SUCCESS.md`
- Manual Setup: `SETUP_STEPS_COMPLETE.md`
