# Worker API - Local Development Setup

This guide covers setting up the Worker API for local development.

## Quick Start

1. **Install dependencies**:
   ```bash
   cd worker-api
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your actual values
   ```

3. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations** (if needed):
   ```bash
   npm run prisma:migrate
   # or for serverless: npm run prisma:push
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

## Database Setup Options

### Option 1: Prisma Accelerate (Recommended)

**Pros**: HTTP-based, works everywhere, no special config needed
**Cons**: Requires Prisma Data Platform account

1. Sign up at https://console.prisma.io
2. Create a new project and get your Accelerate connection string
3. Set in `.dev.vars`:
   ```
   DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY"
   DATABASE_ADAPTER="accelerate"
   ```

### Option 2: Neon Serverless

**Pros**: HTTP-based, generous free tier, no node_compat needed
**Cons**: PostgreSQL only

1. Sign up at https://neon.tech
2. Create a database and get connection string
3. Set in `.dev.vars`:
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
   DATABASE_ADAPTER="neon"
   ```
4. Update `wrangler.toml`: Set `node_compat = false`

### Option 3: Traditional PostgreSQL

**Pros**: Works with any PostgreSQL database
**Cons**: Requires node_compat (larger bundle size)

1. Have a PostgreSQL database ready
2. Set in `.dev.vars`:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/database"
   DATABASE_ADAPTER="pg"
   ```
3. Ensure `wrangler.toml` has `node_compat = true`

## Common Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create a migration
npm run prisma:migrate

# Push schema without migration (for serverless)
npm run prisma:push

# Open Prisma Studio
npm run prisma:studio

# Run development server
npm run dev

# Deploy to production
npm run deploy
```

## Troubleshooting

### "Cannot find module '@prisma/client'"
Run: `npm run prisma:generate`

### "Environment variable not found: DATABASE_URL"
Make sure `.dev.vars` exists with valid `DATABASE_URL`

### Prisma commands fail
Use the `npm run env --` prefix to load `.dev.vars`:
```bash
npm run env -- npx prisma studio
```

### Worker bundle too large
Switch to Neon adapter and set `node_compat = false` in `wrangler.toml`
