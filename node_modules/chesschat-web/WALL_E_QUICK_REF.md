# Wall-E Quick Reference

## 🚀 Quick Start

### Local Development
```bash
# No API keys needed!
wrangler pages dev . --port 3000
```

### Test Wall-E
```bash
# Chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I improve?", "userId": "test"}'

# Game Analysis
curl -X POST http://localhost:3000/api/analyze-game \
  -H "Content-Type: application/json" \
  -d '{"pgn": "1.e4 e5", "moveHistory": [], "cpuLevel": 5, "playerColor": "white"}'
```

---

## 📋 Key Files

| File | Purpose |
|------|---------|
| `functions/lib/prisma.ts` | Database singleton (connection pooling) |
| `functions/lib/walleEngine.ts` | Wall-E AI engine (NO API KEYS) |
| `functions/lib/coachEngine.ts` | Knowledge base coaching |
| `functions/api/chat.ts` | Chat endpoint (Wall-E only) |
| `functions/api/analyze-game.ts` | Game analysis (Wall-E only) |
| `functions/api/wall-e/*.ts` | Learning persistence endpoints |
| `prisma/schema.prisma` | Database schema with learning models |
| `scripts/verify-cloudflare-ready.mjs` | Deployment readiness checker |
| `.github/workflows/ci.yml` | CI/CD pipeline |

---

## 🔧 Common Tasks

### Add New Coaching Knowledge
```bash
# Use admin panel or API
POST /api/admin/knowledge/sources
{
  "title": "Advanced Tactics",
  "sourceType": "DOC",
  "content": "..."
}
```

### Check Player Progress
```bash
GET /api/wall-e/profile?userId=USER_ID
GET /api/wall-e/games?userId=USER_ID
GET /api/wall-e/mistakes?userId=USER_ID
```

### Verify Deployment Readiness
```bash
node scripts/verify-cloudflare-ready.mjs
```

### Run Tests
```bash
npm run test:unit      # Unit tests
npm run test:e2e       # E2E tests
npm run build          # Build check
```

---

## 🎯 API Endpoints

### Wall-E Endpoints (NO API KEYS)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Chat with Wall-E |
| `/api/analyze-game` | POST | Game analysis |

### Learning Persistence
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wall-e/profile` | GET/POST | Player profile |
| `/api/wall-e/games` | GET/POST | Training games |
| `/api/wall-e/mistakes` | GET/POST | Mistake patterns |
| `/api/wall-e/metrics` | GET/POST | Learning metrics |
| `/api/wall-e/sync` | POST | Bulk sync |

### Knowledge Base
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/knowledge/openings` | GET | Opening knowledge |
| `/api/knowledge/heuristics` | GET | Tactical heuristics |

---

## 🗄️ Database Models

### PlayerProfile
Stores user skill ratings, play style, and behavioral patterns.

### TrainingGame
50-game rolling window with analysis and metrics.

### MistakeSignature
Recurring mistake patterns with occurrence tracking.

### LearningMetric
Session-based performance metrics.

### CoachingMemory (NEW)
Rolling aggregate of learning insights and coaching effectiveness.

---

## 🛠️ Troubleshooting

### Wall-E not responding
1. Check DATABASE_URL is configured
2. Verify Prisma connection: `npm run db:push`
3. Check knowledge base has content

### Build failures
1. Run: `node scripts/verify-cloudflare-ready.mjs`
2. Check lockfile: `git diff package-lock.json`
3. Reinstall: `rm -rf node_modules && npm install`

### Database connection errors
1. Verify DATABASE_URL in Cloudflare Dashboard
2. Check Prisma Accelerate connection
3. Review `functions/lib/prisma.ts` logs

### CI failing
1. Review GitHub Actions logs
2. Run locally: `npm ci && npm run build`
3. Check all files are committed

---

## 🎓 Learning Loop

```
User plays → Game stored → Mistakes detected → 
Profile updated → Next game coached with history → 
Improvement tracked → Repeat
```

---

## ⚙️ Environment Variables

### Required
- `DATABASE_URL` - Prisma database connection (Postgres + Accelerate)

### Optional
- `RATE_LIMIT_KV` - KV namespace for rate limiting
- `ANALYTICS_KV` - KV namespace for analytics

### NOT Required (Removed)
- ~~`OPENAI_API_KEY`~~ - NO LONGER NEEDED! 🎉

---

## 🚀 Deployment Checklist

- [ ] Run `node scripts/verify-cloudflare-ready.mjs`
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Verify CI passes
- [ ] Check Cloudflare Dashboard > Environment Variables
- [ ] Monitor deployment logs
- [ ] Test `/api/health` endpoint
- [ ] Test Wall-E chat
- [ ] Verify learning persistence

---

## 📊 Performance Optimization

### Prisma Singleton Benefits
- ✅ Connection reuse across requests
- ✅ Reduced cold start times
- ✅ Lower database connection count
- ✅ Better resource utilization

### Wall-E Performance
- ✅ No external API latency
- ✅ Knowledge base cached in memory
- ✅ Parallel data fetching
- ✅ Graceful degradation

---

## 🔒 Security Best Practices

1. ✅ Never log full DATABASE_URL
2. ✅ Sanitize all user inputs
3. ✅ Use Prisma parameterized queries
4. ✅ Rate limit API endpoints
5. ✅ No sensitive data in responses

---

## 📞 Quick Links

- [Full Implementation Docs](WALL_E_IMPLEMENTATION.md)
- [Prisma Schema](prisma/schema.prisma)
- [CI Workflow](.github/workflows/ci.yml)
- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [GitHub Repository](https://github.com/richlegrande-dot/Chess)
