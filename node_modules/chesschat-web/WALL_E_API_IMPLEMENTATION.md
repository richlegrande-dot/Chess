# Wall-E Database Persistence - API Implementation

## Overview

Wall-E's memory now persists to PostgreSQL via Cloudflare Functions serverless backend. This ensures learning data survives browser clearing and is accessible across devices.

## Architecture

```
Frontend (localStorage)
    ↓ (API calls)
Cloudflare Functions (/api/wall-e/*)
    ↓ (Prisma Client)
PostgreSQL (accelerate.prisma-data.net)
```

## API Endpoints

All endpoints are serverless Cloudflare Functions located in `functions/api/wall-e/`:

### 1. `/api/wall-e/profile` - Player Profile
- **POST**: Save player profile (skill ratings, play style, milestones)
- **GET**: Load player profile (`?userId=xxx`)

### 2. `/api/wall-e/games` - Training Games
- **POST**: Save training game (50-game rolling window)
- **GET**: Load all training games (`?userId=xxx`)

### 3. `/api/wall-e/mistakes` - Mistake Signatures
- **POST**: Save mistake signature (learned patterns)
- **GET**: Load all mistake signatures (`?userId=xxx`)

### 4. `/api/wall-e/metrics` - Learning Metrics
- **POST**: Save learning metric (session tracking)
- **GET**: Load all learning metrics (`?userId=xxx`)

### 5. `/api/wall-e/sync` - Bulk Sync
- **POST**: Sync all localStorage data to database at once

## Frontend Integration

The frontend code has been updated to use the API:

1. **App.tsx**: Auto-sync on startup (every 24 hours)
2. **protectedTrainingCore.ts**: Saves training games after each game
3. **enhancedLearningSystem.ts**: Saves player profile after learning updates
4. **ruleBasedCoachingEngine.ts**: Saves mistake signatures after analysis

All database writes are **non-blocking** - if the API fails, the game continues working with localStorage.

## Deployment Setup

### Step 1: Set DATABASE_URL Environment Variable

The Cloudflare Functions need access to the PostgreSQL database. Set this via Cloudflare Dashboard:

1. Go to: https://dash.cloudflare.com
2. Select your account → Pages → `chesschat-web`
3. Settings → Functions → Environment Variables
4. Add new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: `prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY_HERE`
   - **Environment**: Production (and Preview if needed)
5. Save and redeploy

### Step 2: Deploy

```bash
npm run build
npm run deploy
```

The Functions will automatically be deployed alongside the static site.

## Database Schema

Wall-E uses 4 tables:

1. **PlayerProfile**: User's skill ratings, play style, milestones
2. **TrainingGame**: 50-game rolling window with analysis
3. **MistakeSignature**: Learned mistake patterns with confidence scores
4. **LearningMetric**: Session tracking with insights

All tables use `userId` for multi-user support.

## User ID Generation

Each user gets a unique ID stored in localStorage:
```
wall-e-user-id: user_1234567890_abc123xyz
```

This ID links all Wall-E data to the same user across sessions.

## Sync Strategy

### Automatic Sync
- Runs on app startup if last sync was > 24 hours ago
- Non-blocking, won't interrupt gameplay

### Real-time Sync
- **Training Games**: Synced after each game
- **Player Profile**: Synced after skill rating updates
- **Mistake Signatures**: Synced after each game analysis
- **Learning Metrics**: Synced at session end

### Fallback
If API fails:
- Data remains in localStorage
- Game continues functioning normally
- Next auto-sync will retry

## Testing

### 1. Verify API Endpoints

```bash
# Test profile endpoint
curl -X POST https://chesschat.uk/api/wall-e/profile \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","skillRatings":{},"playStyle":"balanced","gamesPlayed":0}'

# Verify with GET
curl https://chesschat.uk/api/wall-e/profile?userId=test_user
```

### 2. Check Logs

View Cloudflare Functions logs:
1. Dashboard → Pages → chesschat-web
2. Functions → Real-time logs
3. Watch for successful database writes

### 3. Database Verification

```bash
# Check database contents
npx tsx verify-data-integrity.ts
```

## Files Modified

### New Files
- `functions/api/wall-e/profile.ts` - Player profile API
- `functions/api/wall-e/games.ts` - Training games API
- `functions/api/wall-e/mistakes.ts` - Mistake signatures API
- `functions/api/wall-e/metrics.ts` - Learning metrics API
- `functions/api/wall-e/sync.ts` - Bulk sync API
- `src/lib/api/walleApiSync.ts` - Frontend API client

### Updated Files
- `src/App.tsx` - Auto-sync on startup
- `src/lib/coaching/protectedTrainingCore.ts` - Game sync
- `src/lib/coaching/enhancedLearningSystem.ts` - Profile sync
- `src/lib/coaching/ruleBasedCoachingEngine.ts` - Mistake sync

## Troubleshooting

### API Returns 500 Error
- Check DATABASE_URL is set correctly in Cloudflare Dashboard
- Verify Prisma Accelerate API key is valid
- Check Functions logs for error details

### Data Not Syncing
- Check browser console for API errors
- Verify `wall-e-user-id` exists in localStorage
- Check last sync timestamp: `wall-e-last-sync`

### Database Connection Failed
- Test local connection: `npx prisma db pull`
- Verify Prisma Accelerate is accessible
- Check API key hasn't expired

## Security Notes

- **DATABASE_URL**: Never commit this to git, only set via Cloudflare Dashboard
- **User IDs**: Generated client-side, no authentication yet
- **Rate Limiting**: Cloudflare Pages has built-in DDoS protection
- **Data Privacy**: Each user's data is isolated by userId

## Next Steps

Once deployed and tested:

1. Monitor Cloudflare Functions logs for errors
2. Verify data appears in PostgreSQL after gameplay
3. Test localStorage → DB sync after 24 hours
4. Consider adding authentication for multi-device support
5. Implement data export/import for user backups

## Support

If issues persist:
1. Check Cloudflare Functions logs
2. Run `npx prisma studio` to inspect database
3. Test API endpoints with curl/Postman
4. Verify DATABASE_URL in Cloudflare Dashboard
