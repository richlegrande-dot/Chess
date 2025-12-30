# ChessChat - Single Worker API Deployment

## Architecture Overview

**Clean, simplified deployment** using a single Cloudflare Worker for all backend API endpoints with Prisma-backed observability.

```
Frontend (Pages)  →  /api/*  →  Single Worker API  →  Prisma  →  Database
                                      ↓
                              Persistent Logging
```

### Key Features

- ✅ **Single Worker API**: All `/api/*` endpoints handled by one Worker
- ✅ **Prisma Observability**: Server-side call logs stored in database
- ✅ **No Silent Fallbacks**: Structured errors, no hidden failure modes
- ✅ **Automated Deployment**: GitHub Actions + Wrangler
- ✅ **Full Verification**: Automated tests after every deployment

## Quick Start

### Local Development

1. **Setup Worker API**:
   ```bash
   cd worker-api
   npm install
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your database credentials
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

3. **Run Database Migrations**:
   ```bash
   npm run prisma:migrate
   # OR for serverless: npm run prisma:push
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

   Worker will be available at `http://localhost:8787`

5. **Test Endpoints**:
   ```bash
   # Health check
   curl http://localhost:8787/api/admin/worker-health
   
   # Chess move
   curl -X POST http://localhost:8787/api/chess-move \
     -H "Content-Type: application/json" \
     -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":3}'
   ```

### Production Deployment

#### Prerequisites (One-time Setup)

See [docs/MANUAL_CLOUDFLARE_SETUP.md](docs/MANUAL_CLOUDFLARE_SETUP.md) for detailed instructions.

**Summary**:
1. Create Prisma database (Accelerate, Neon, or PostgreSQL)
2. Set Worker secrets: `wrangler secret put DATABASE_URL` and `ADMIN_PASSWORD`
3. Configure Worker route in Cloudflare Dashboard
4. Set GitHub secret: `CF_API_TOKEN`

#### Deploy via GitHub Actions (Recommended)

```bash
git add .
git commit -m "Deploy Worker API"
git push origin production
```

GitHub Actions will automatically:
1. Build and deploy Worker
2. Run verification tests
3. Report status

#### Manual Deployment

```bash
cd worker-api

# Deploy to production
npm run deploy

# Verify deployment
cd ..
WORKER_API_URL=https://chesschat.uk node scripts/verify-worker-api.mjs
```

## API Endpoints

All endpoints are prefixed with `/api/`

### Chess Move

**POST** `/api/chess-move`

Request:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "difficulty": "medium",
  "cpuLevel": 3,
  "timeMs": 1000,
  "gameId": "game-123"
}
```

Response:
```json
{
  "success": true,
  "move": "e4",
  "mode": "worker",
  "engine": "worker",
  "diagnostics": {
    "fen": "...",
    "move": "e4",
    "depth": 3,
    "cpuLevel": 3,
    "latencyMs": 45
  },
  "workerCallLog": {
    "endpoint": "/api/chess-move",
    "success": true,
    "latencyMs": 45,
    ...
  }
}
```

### Health Check

**GET** `/api/admin/worker-health`

Response:
```json
{
  "healthy": true,
  "latencyMs": 12,
  "checks": {
    "timestamp": "2025-12-28T...",
    "version": "1.0.0",
    "database": { "status": "ok" },
    "env": {
      "DATABASE_URL": "set",
      "ADMIN_PASSWORD": "set"
    }
  }
}
```

### Worker Call Logs

**GET** `/api/admin/worker-calls?limit=50`

Returns stored logs from database (newest first).

**POST** `/api/admin/worker-calls/clear`

Clears all logs (requires `Authorization: Bearer <ADMIN_PASSWORD>`).

## Verification

### Automated Verification

```bash
# Test against production
WORKER_API_URL=https://chesschat.uk node scripts/verify-worker-api.mjs
```

Tests performed:
1. ✅ Worker health check (DB connectivity)
2. ✅ Chess move request (returns `mode:"worker"`)
3. ✅ Logs are persisted in database
4. ✅ workerCallLog present in responses

### Manual Testing

```bash
# 1. Health check
curl https://chesschat.uk/api/admin/worker-health

# 2. Make a chess move
curl -X POST https://chesschat.uk/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 3
  }'

# 3. View logs
curl https://chesschat.uk/api/admin/worker-calls?limit=5
```

## Admin Portal

Access the admin portal at `/admin` to view:

- **Worker Calls Tab**: Real-time logs from Prisma database
- **System Health**: Worker and database status
- **Call Statistics**: Success rate, latency, error patterns

## Database Setup Options

### Option 1: Prisma Accelerate (Recommended)

**Best for**: Production deployments, maximum reliability

- HTTP-based connection (works everywhere)
- No `node_compat` needed (smaller bundles)
- Built-in caching and pooling

Setup: https://console.prisma.io → Create Accelerate project

### Option 2: Neon Serverless

**Best for**: Cost-conscious deployments, PostgreSQL lovers

- HTTP-based (no `node_compat` needed)
- Generous free tier
- Fast provisioning

Setup: https://neon.tech → Create project

### Option 3: Traditional PostgreSQL

**Best for**: Existing infrastructure, self-hosted

- Works with any PostgreSQL database
- Requires `node_compat = true` (larger bundle)

Setup: Use existing PostgreSQL connection string

See [worker-api/README.md](worker-api/README.md) for detailed setup instructions.

## CI/CD Pipeline

### GitHub Actions Workflow

File: [.github/workflows/deploy-worker.yml](.github/workflows/deploy-worker.yml)

**Triggers**: Push to `production` or `main` branch

**Steps**:
1. ✅ Check for old Pages Functions (prevent regression)
2. 🔨 Build Worker (npm install, Prisma generate)
3. ✅ TypeScript type check
4. 🚀 Deploy to Cloudflare
5. ⏳ Wait for propagation
6. ✅ Run verification tests
7. 📊 Report status

**Required Secret**: `CF_API_TOKEN` (Cloudflare API token with Workers permissions)

## Troubleshooting

### Worker not receiving requests

1. Check route is configured: Cloudflare Dashboard → Workers Routes
2. Verify route pattern: `chesschat.uk/api/*`
3. Check DNS propagation: `nslookup chesschat.uk`

### Database connection errors

1. Verify secret is set: `wrangler secret list`
2. Test connection string locally
3. Check database is accessible from internet
4. For Accelerate: Verify API key is valid

### "mode is not worker" in responses

This means the Worker is not handling requests:

1. Check Worker deployment: `wrangler deployments list`
2. Verify route configuration
3. Check for conflicting Pages Functions
4. Look for errors in Worker logs: `wrangler tail`

### Bundle size too large

1. Switch to Neon or Accelerate adapter (HTTP-based)
2. Set `node_compat = false` in `wrangler.toml`
3. Upgrade to Cloudflare Workers paid plan (10MB limit vs 3MB)

## Architecture Decisions

### Why Single Worker?

**Before**: Hybrid Pages Functions + Worker with service bindings
- ❌ Complex routing
- ❌ Silent fallback logic
- ❌ Difficult debugging
- ❌ Logs scattered across systems

**After**: Single Worker API
- ✅ One source of truth
- ✅ Fail loudly with structured errors
- ✅ All logs in database
- ✅ Simple routing and deployment

### Why Prisma?

- ✅ Type-safe database queries
- ✅ Migration management
- ✅ Works with Cloudflare Workers (via Accelerate/adapters)
- ✅ Built-in logging and observability

### Why Wrangler Deploy?

- ✅ Official Cloudflare CLI
- ✅ Mature and well-documented
- ✅ Handles secrets and environment properly
- ✅ Works with GitHub Actions

## Project Structure

```
ChessChatWeb/
├── worker-api/              # 🆕 Single Worker API
│   ├── src/
│   │   └── index.ts        # Worker entry point
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   ├── wrangler.toml       # Worker config
│   ├── package.json
│   └── .dev.vars.example
├── scripts/
│   └── verify-worker-api.mjs  # 🆕 Verification script
├── .github/
│   └── workflows/
│       └── deploy-worker.yml  # 🆕 CI/CD pipeline
├── docs/
│   └── MANUAL_CLOUDFLARE_SETUP.md  # 🆕 Setup guide
└── src/                     # Frontend (unchanged)
```

## Documentation

- **Manual Setup**: [docs/MANUAL_CLOUDFLARE_SETUP.md](docs/MANUAL_CLOUDFLARE_SETUP.md)
- **Worker API**: [worker-api/README.md](worker-api/README.md)
- **Verification**: Run `node scripts/verify-worker-api.mjs --help`

## Support

- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Prisma**: https://www.prisma.io/docs/
- **Wrangler**: https://developers.cloudflare.com/workers/wrangler/

## License

MIT
