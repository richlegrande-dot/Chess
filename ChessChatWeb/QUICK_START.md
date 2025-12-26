# Prisma + Knowledge Vault - Quick Start Guide

## ✅ Implementation Complete: Backend API (Phases 1-2)

**Status**: Database and Knowledge Vault API are fully functional!

### What's Been Implemented

#### 🗄️ **Database Layer**
- ✅ Prisma ORM with PostgreSQL + Accelerate
- ✅ Fail-fast validation on startup
- ✅ Health monitoring and diagnostics
- ✅ Circuit breaker pattern for resilience

#### 🔐 **Admin Authentication**
- ✅ Password-based admin login
- ✅ Short-lived session tokens (2-hour expiry)
- ✅ No raw passwords stored in browser

#### 📚 **Knowledge Vault**  
- ✅ Sources and Chunks CRUD
- ✅ Soft delete for sources
- ✅ Automatic audit logging
- ✅ Chunk count diagnostics (prevents Care2Connect bug)

---

## 🚀 Testing the API

### 1. Check Health Status

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T...",
  "checks": {
    "apiKey": false,
    "database": true
  },
  "database": {
    "dbReady": true,
    "lastPing": "2025-12-18T...",
    "latencyMs": 45,
    "consecutiveFailures": 0
  }
}
```

### 2. Admin Login

```bash
curl -X POST http://localhost:3000/api/admin/auth/unlock \
  -H "Content-Type: application/json" \
  -d '{"password": "ChessAdmin2025!"}'
```

Expected response:
```json
{
  "success": true,
  "token": "abc123...",
  "expiresAt": "2025-12-18T..."
}
```

**Save the token** for subsequent requests!

### 3. Create a Knowledge Source

```bash
curl -X POST http://localhost:3000/api/admin/knowledge/sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Chess Opening Principles",
    "sourceType": "DOC",
    "url": null
  }'
```

Expected response:
```json
{
  "id": "cm...",
  "title": "Chess Opening Principles",
  "sourceType": "DOC",
  "isDeleted": false,
  "createdAt": "2025-12-18T...",
  "updatedAt": "2025-12-18T..."
}
```

### 4. Add Chunks to Source

```bash
curl -X POST "http://localhost:3000/api/admin/knowledge/sources/{sourceId}/chunks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "chunkText": "Control the center with pawns (e4, d4, e5, d5). Develop knights before bishops. Castle early for king safety.",
    "tags": ["openings", "principles"],
    "language": "en"
  }'
```

### 5. List Sources

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  "http://localhost:3000/api/admin/knowledge/sources?page=1&limit=10"
```

Expected response:
```json
{
  "sources": [
    {
      "id": "cm...",
      "title": "Chess Opening Principles",
      "sourceType": "DOC",
      "_count": {
        "chunks": 1
      },
      "updatedAt": "2025-12-18T..."
    }
  ],
  "total": 1
}
```

### 6. Run Diagnostics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  "http://localhost:3000/api/admin/knowledge/diagnostics"
```

Expected response:
```json
{
  "totalSources": 1,
  "totalChunks": 1,
  "chunksPerSource": [
    {"sourceId": "cm...", "count": 1}
  ],
  "mismatches": [],
  "status": "OK"
}
```

### 7. View Audit Log

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  "http://localhost:3000/api/admin/knowledge/audit?page=1&limit=10"
```

---

## 📁 Complete API Reference

### Health Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | System health status |
| GET | `/api/health?test=true` | None | With OpenAI connectivity test |

### Admin Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/auth/unlock` | None | Login with password |
| POST | `/api/admin/auth/logout` | Token | Invalidate token |

### Knowledge Sources
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/knowledge/sources` | Token | List sources (paginated) |
| POST | `/api/admin/knowledge/sources` | Token | Create source |
| GET | `/api/admin/knowledge/sources/{id}` | Token | Get source details |
| PATCH | `/api/admin/knowledge/sources/{id}` | Token | Update source |
| DELETE | `/api/admin/knowledge/sources/{id}` | Token | Soft delete source |

### Knowledge Chunks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/knowledge/sources/{id}/chunks` | Token | Get chunks for source |
| POST | `/api/admin/knowledge/sources/{id}/chunks` | Token | Create chunk |
| PATCH | `/api/admin/knowledge/chunks/{id}` | Token | Update chunk |
| DELETE | `/api/admin/knowledge/chunks/{id}` | Token | Delete chunk |

### Knowledge Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/knowledge/audit` | Token | View audit log |
| GET | `/api/admin/knowledge/diagnostics` | Token | Run chunk count diagnostics |

---

## 🔧 Configuration

### Environment Variables (.env)
```bash
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/..."
ADMIN_PASSWORD="ChessAdmin2025!"
OPENAI_API_KEY="sk-..."  # Optional
```

### Prisma Commands
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## 🐛 Troubleshooting

### "Database is not ready" Error
**Symptom**: API returns 503 with "Database is not ready"  
**Cause**: DATABASE_URL missing or invalid  
**Fix**: 
```bash
# Check .env file exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection
npx prisma db pull
```

### "Unauthorized" Error  
**Symptom**: API returns 401 "Invalid or expired token"  
**Cause**: Token expired (2-hour limit) or invalid  
**Fix**: Call `/api/admin/auth/unlock` again to get new token

### Chunk Count Mismatch
**Symptom**: Diagnostics shows `status: "MISMATCH_DETECTED"`  
**Cause**: Database inconsistency  
**Fix**: Check audit log, re-import affected sources

---

## ✈️ What's Next?

### Immediate (You can do this now!)
1. **Test the API** using the curl commands above
2. **Create test data** (sources and chunks)
3. **Check audit log** to see all operations logged

### Coming Soon (Phase 3-4)
- 🎨 **Admin Portal UI** (React frontend for Knowledge Vault)
- 🔗 **API Client** (centralized `apiFetch()` helper)
- 🚫 **CORS Fix** (no more hardcoded URLs)

### Future (Phase 6-7)
- 📥 **Knowledge Import** (bulk import from markdown files)
- 🤖 **CoachEngine** (self-created baseline agent)
- 📊 **Analytics** (game insights from Knowledge Vault)

---

## 📚 Documentation

- [PRISMA_IMPLEMENTATION_STATUS.md](PRISMA_IMPLEMENTATION_STATUS.md) - Full implementation details
- [docs/DB_HARDENING.md](docs/DB_HARDENING.md) - Database hardening strategy
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema

---

## 🎉 Summary

**You now have**:
- ✅ Production-grade Prisma database with Accelerate
- ✅ Complete Knowledge Vault backend API
- ✅ Admin authentication with session tokens
- ✅ Audit logging for all operations
- ✅ Chunk count diagnostics (prevents regressions)
- ✅ Health monitoring and circuit breakers

**Backend implementation**: ~90% complete  
**Ready for**: Admin UI development (Phase 3)

---

**Questions?** Check [PRISMA_IMPLEMENTATION_STATUS.md](PRISMA_IMPLEMENTATION_STATUS.md) for detailed status and next steps.
