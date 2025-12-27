# Wall-E Assistant Worker

Standalone Cloudflare Worker service for chess coaching AI.

## Overview

This Worker provides internal AI assistance endpoints called by Cloudflare Pages Functions via service binding. It is **NOT** publicly accessible.

## Architecture

```
Pages Functions (/api/*)
    ↓ (service binding)
Worker (/assist/*)
    ↓ (imports)
Shared modules (../shared/*)
```

## Endpoints

### POST /assist/chat
Chat with Wall-E coaching assistant.

**Request**:
```json
{
  "message": "How can I improve my opening?",
  "userId": "user123",
  "gameContext": { ... }
}
```

**Response**:
```json
{
  "success": true,
  "response": "Based on your last 10 games...",
  "historyEvidence": { ... },
  "personalizedReferences": [ ... ]
}
```

### POST /assist/analyze-game
Analyze a completed game.

**Request**:
```json
{
  "pgn": "1. e4 e5 2. Nf3 ...",
  "moveHistory": [ ... ],
  "cpuLevel": 3,
  "playerColor": "white",
  "userId": "user123"
}
```

**Response**:
```json
{
  "success": true,
  "analysis": "Your game showed strong tactical awareness...",
  "recommendations": [ ... ],
  "historyEvidence": { ... }
}
```

### POST /assist/chess-move
Get CPU opponent's next move.

**Request**:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "difficulty": "intermediate"
}
```

**Response**:
```json
{
  "success": true,
  "move": "e2e4",
  "evaluation": 0.3,
  "source": "opening_book"
}
```

## Development

### Local Testing

```bash
# Install dependencies (first time)
npm install

# Run worker locally
npx wrangler dev

# Test endpoints
curl http://localhost:8787/assist/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

### Deploy

```bash
# Deploy to production
npx wrangler deploy --env production

# Deploy to staging
npx wrangler deploy --env staging
```

### Configure Secrets

```bash
# Set DATABASE_URL
npx wrangler secret put DATABASE_URL --env production
```

## Service Binding Setup

### In Cloudflare Dashboard

1. Go to Pages project → Settings → Functions → Bindings
2. Add Service Binding:
   - **Name**: `WALLE_ASSISTANT`
   - **Service**: `walle-assistant`
   - **Environment**: `production`

### Verification

```bash
# Check if binding is working
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -d '{"message":"Test"}'

# Should return: "mode": "service-binding"
```

## Code Sharing

This worker imports shared Wall-E logic from `../shared/`:
- `walleEngine.ts` - Main coaching engine
- `walleChessEngine.ts` - CPU chess opponent
- `personalizedReferences.ts` - Provable personalization
- `prisma.ts` - Database client

**DO NOT** duplicate code. Always import from `../../shared/`.

## Constraints

### Non-Negotiable

1. **NO EXTERNAL AI**: Wall-E only, no OpenAI/Anthropic/etc.
2. **PROVABLE PERSONALIZATION**: Every response must include `historyEvidence` with ≥2 references OR explicit "insufficient history" reason.
3. **DATABASE OPTIONAL**: Graceful degradation if DATABASE_URL unavailable.

### Verification

```bash
# Run integrity checks
cd ..
node scripts/verify-hybrid-assistant.mjs
```

## Related Docs

- [../docs/HYBRID_BINDING_DEPLOY.md](../docs/HYBRID_BINDING_DEPLOY.md) - Full deployment guide
- [../COMPLETE_OPENAI_REMOVAL.md](../COMPLETE_OPENAI_REMOVAL.md) - No AI dependencies
- [../PROVABLE_PERSONALIZATION_COMPLETE.md](../PROVABLE_PERSONALIZATION_COMPLETE.md) - Evidence system
