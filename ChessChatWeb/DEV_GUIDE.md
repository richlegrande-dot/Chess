# Local Development Guide

**Version:** 2.0 - Stockfish + AI Coaching Architecture  
**Last Updated:** December 29, 2025

This guide explains how to run the entire ChessChat stack locally for development.

---

## Prerequisites

- **Node.js**: v18 or later
- **PostgreSQL**: For local database (or use Prisma Accelerate)
- **pnpm/npm**: Package manager

---

## Architecture Components

The development stack consists of:
1. **Frontend** (Vite dev server) - `http://localhost:3001`
2. **Worker API** (Wrangler dev) - `http://localhost:8787`
3. **AI Coaching Worker** (Wrangler dev) - `http://localhost:8788`
4. **Database** (PostgreSQL local or remote)

---

## Step 1: Install Dependencies

### Root project

```bash
cd ChessChatWeb
npm install
```

### Worker API

```bash
cd worker-api
npm install
npm run prisma:generate
```

### AI Coaching Worker

```bash
cd worker-assistant
npm install
```

---

## Step 2: Configure Environment Variables

### Worker API (`.dev.vars`)

Create `worker-api/.dev.vars`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chesschat_dev"
ADMIN_PASSWORD="dev-admin-password"
INTERNAL_AUTH_TOKEN="dev-internal-token"
ENVIRONMENT="development"
VERSION="2.0.0-dev"
```

If using Prisma Accelerate:

```env
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_DEV_KEY"
```

### AI Coaching Worker (`.dev.vars`)

Create `worker-assistant/.dev.vars`:

```env
INTERNAL_AUTH_TOKEN="dev-internal-token"
OPENAI_API_KEY="sk-..."  # Optional
ANTHROPIC_API_KEY="..."  # Optional
```

### Frontend (`.env.local`)

Create `ChessChatWeb/.env.local`:

```env
VITE_API_URL=http://localhost:8787/api
```

---

## Step 3: Setup Database

### Option A: Local PostgreSQL

1. Install PostgreSQL:
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

2. Create database:
```bash
psql postgres
CREATE DATABASE chesschat_dev;
CREATE USER chesschat WITH PASSWORD 'dev-password';
GRANT ALL PRIVILEGES ON DATABASE chesschat_dev TO chesschat;
\q
```

3. Run migrations:
```bash
cd worker-api
npx prisma migrate dev
```

### Option B: Use Prisma Accelerate

1. Sign up at https://www.prisma.io/accelerate
2. Create a project
3. Get connection string (starts with `prisma+postgres://`)
4. Use in `.dev.vars`

---

## Step 4: Run Development Servers

You'll need **3 terminal windows**:

### Terminal 1: Frontend

```bash
cd ChessChatWeb
npm run dev
```

**URL:** http://localhost:3001

### Terminal 2: Worker API

```bash
cd worker-api
npm run dev
```

**URL:** http://localhost:8787

**Available endpoints:**
- `POST /api/chess-move`
- `POST /api/game/complete`
- `GET /api/game/:id`
- `GET /api/learning/profile?playerId=...`
- `GET /api/admin/worker-health`
- `GET /api/admin/worker-calls`

### Terminal 3: AI Coaching Worker (Optional)

```bash
cd worker-assistant
npm run dev
```

**URL:** http://localhost:8788

**Available endpoints:**
- `POST /assist/postgame`
- `POST /assist/explain`
- `GET /health`

---

## Step 5: Configure Service Binding (Local)

For local development, the Worker API needs to call the AI Worker. Configure in `worker-api/wrangler.toml`:

```toml
# Local development service binding
[[services]]
binding = "AI_COACH"
service = "walle-assistant"
```

Ensure both workers are running simultaneously.

---

## Step 6: Test the Stack

### Test 1: Frontend loads

Visit http://localhost:3001 - you should see the chess board.

### Test 2: Make a move

1. Start a game
2. Make a move as white
3. Frontend calls `POST /api/chess-move`
4. Worker API computes move with Stockfish
5. CPU responds

**Check browser DevTools → Network tab** to see API calls.

### Test 3: Admin endpoints

```bash
# Health check
curl http://localhost:8787/api/admin/worker-health

# View logs
curl http://localhost:8787/api/admin/worker-calls
```

### Test 4: Database

```bash
cd worker-api
npx prisma studio
```

This opens a web UI at http://localhost:5555 to inspect database records.

---

## Step 7: Debugging

### Enable Debug Logging

Worker API logs are visible in the terminal running `npm run dev`.

To enable more verbose logging, edit `worker-api/src/index-new.ts` and add:

```typescript
console.log('[Debug] Request received:', {
  path: request.url,
  method: request.method,
});
```

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3001",
      "webRoot": "${workspaceFolder}/ChessChatWeb/src"
    }
  ]
}
```

### Inspect Database

```bash
cd worker-api
npx prisma studio
```

Or use a PostgreSQL client:
- **TablePlus** (https://tableplus.com)
- **pgAdmin** (https://www.pgadmin.org)
- **DBeaver** (https://dbeaver.io)

---

## Step 8: Making Changes

### Frontend Changes

1. Edit files in `src/`
2. Vite hot-reloads automatically
3. No restart needed

### Worker API Changes

1. Edit files in `worker-api/src/`
2. Wrangler auto-reloads on save
3. For schema changes:
   ```bash
   cd worker-api
   npx prisma migrate dev --name description_of_change
   npm run prisma:generate
   ```

### AI Worker Changes

1. Edit files in `worker-assistant/src/`
2. Wrangler auto-reloads on save

---

## Step 9: Running Tests

### Unit Tests (TODO - Phase 2)

```bash
npm test
```

### Integration Tests

```bash
# Test Worker API endpoints
node scripts/test-prod-chess-move.mjs http://localhost:8787
```

### Architecture Verification

```bash
node scripts/verify-architecture.mjs
```

---

## Step 10: Stockfish Implementation

Currently, `worker-api/src/stockfish.ts` is a **placeholder** that needs implementation.

### Option A: stockfish.js (WASM)

1. Install stockfish.js:
```bash
cd worker-api
npm install stockfish
```

2. Update `stockfish.ts` to use the library
3. Test locally

### Option B: Separate Stockfish Server

1. Run Stockfish as HTTP server (separate Node.js process)
2. Update `stockfish.ts` to call HTTP API
3. Configure endpoint in `.dev.vars`

**For now, the placeholder returns an error** indicating Stockfish is not yet implemented.

---

## Common Issues

### Issue: Worker API returns 500

**Check:**
1. Is `DATABASE_URL` correct in `.dev.vars`?
2. Did you run `npx prisma migrate dev`?
3. Check terminal logs for errors

### Issue: Frontend can't reach API

**Check:**
1. Is Worker API running on port 8787?
2. Is `VITE_API_URL` set correctly in `.env.local`?
3. Check CORS headers in Worker API

### Issue: Service binding not working

**Check:**
1. Is AI Worker running on port 8788?
2. Is service binding configured in `wrangler.toml`?
3. Try restarting both workers

### Issue: Database migration fails

**Check:**
1. Is PostgreSQL running?
2. Can you connect: `psql -d chesschat_dev`?
3. Check `DATABASE_URL` format

---

## Development Workflow

### Daily Development

1. Start all servers:
```bash
# Terminal 1
cd ChessChatWeb && npm run dev

# Terminal 2
cd worker-api && npm run dev

# Terminal 3 (optional)
cd worker-assistant && npm run dev
```

2. Make changes
3. Test in browser
4. Commit changes

### Before Committing

```bash
# Run verification
node scripts/verify-architecture.mjs

# Test endpoints
node scripts/test-prod-chess-move.mjs http://localhost:8787

# Format code
npm run format  # If configured

# Commit
git add .
git commit -m "feat: description"
git push
```

### Deploying Changes

See [MANUAL_CLOUDFLARE_SETUP.md](./MANUAL_CLOUDFLARE_SETUP.md) for production deployment.

---

## Quick Start Command (Single Terminal)

For convenience, add to `package.json`:

```json
{
  "scripts": {
    "dev:all": "concurrently \"npm run dev\" \"cd worker-api && npm run dev\" \"cd worker-assistant && npm run dev\""
  }
}
```

Then:
```bash
npm install -g concurrently
npm run dev:all
```

---

## Additional Resources

- **Architecture:** [ARCHITECTURE_STOCKFISH_AI_LEARNING.md](./ARCHITECTURE_STOCKFISH_AI_LEARNING.md)
- **Production Setup:** [MANUAL_CLOUDFLARE_SETUP.md](./MANUAL_CLOUDFLARE_SETUP.md)
- **Prisma Docs:** https://www.prisma.io/docs
- **Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Stockfish:** https://stockfishchess.org/

---

**Happy coding!** 🚀♟️
