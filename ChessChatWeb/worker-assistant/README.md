# Wall-E Assistant Worker

Standalone Cloudflare Worker service that provides AI chess coaching for ChessChat.

## Architecture

This is a **Worker Service** (not Pages Functions) that is called by the Pages project via service binding.

- **Pages Project**: `chesschat-web` (React/Vite frontend + `/api/*` functions)
- **Worker Service**: `walle-assistant-production` (internal AI assistant)
- **Service Binding**: `WALLE_ASSISTANT` (configured in Pages wrangler.toml)

## Self-Contained Design

This worker is **fully self-contained** and does NOT depend on parent directory installs.

All shared code is located in `src/shared/` (copied from parent `../shared/`).

### Dependencies

All runtime dependencies are declared in `package.json`:
- `@prisma/client` - Database access
- `@prisma/extension-accelerate` - Connection pooling
- `chess.js` - Chess logic

### Building & Deploying

The worker builds and deploys from its own directory:

```bash
cd ChessChatWeb/worker-assistant
npm ci
npx wrangler deploy --env production
```

**No parent `npm ci` required.**

## Cloudflare Worker Service Build Settings

Configure in Cloudflare Dashboard → Workers & Pages → Create Application → Worker Service Build:

### Required Settings

| Setting | Value |
|---------|-------|
| Repository | `richlegrande-dot/Chess` |
| Branch | `main` |
| **Path** | `ChessChatWeb/worker-assistant` ⚠️ CRITICAL |
| **Build command** | `npm ci` |
| **Deploy command** | `npx wrangler deploy --env production` ⚠️ REQUIRED |

**Note**: Deploy command is REQUIRED for Worker Service Builds. Empty deploy command will fail.

### Optional Settings

| Setting | Value |
|---------|-------|
| Preview deploy | `npx wrangler deploy --env staging` |

## Service Binding Configuration

The Pages project calls this worker via service binding.

Configure in Pages Settings → Functions → Service bindings:

| Variable | Service | Environment |
|----------|---------|-------------|
| `WALLE_ASSISTANT` | `walle-assistant` | `production` |

Then in Pages Functions:

```typescript
// functions/api/chat.ts
export async function onRequestPost(context) {
  const response = await context.env.WALLE_ASSISTANT.fetch(
    new Request('http://internal/assist/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Internal-Token': context.env.INTERNAL_AUTH_TOKEN 
      },
      body: JSON.stringify(data)
    })
  );
  return response;
}
```

## Endpoints

### POST /assist/chat
Chat with Wall-E assistant with game context.

### POST /assist/analyze-game
Analyze a completed game with personalized insights.

### POST /assist/chess-move
Generate CPU move for chess game.

## Security

The worker includes an optional auth guard:
- Validates `X-Internal-Token` header
- Returns 404 if header is missing or invalid
- Service binding remains functional (internal calls include token)

Set the shared secret:
```bash
wrangler secret put INTERNAL_AUTH_TOKEN --env production
# Also set in Pages project settings
```

## Environment Variables

Set via `wrangler secret`:

```bash
wrangler secret put DATABASE_URL --env production
wrangler secret put INTERNAL_AUTH_TOKEN --env production
```

The worker gracefully degrades if `DATABASE_URL` is unavailable.

## Development

Local development:

```bash
cd ChessChatWeb/worker-assistant
npm ci
npm run dev
```

## Verification

Run verification script to ensure correct configuration:

```bash
cd ChessChatWeb
npm run verify:hybrid-deploy
```

This script verifies:
- Worker package.json and lockfile exist
- Worker wrangler.toml configured correctly
- All required endpoints are present
- Service binding configured in Pages wrangler.toml
- No external AI dependencies
