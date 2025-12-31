# ChessChat Learning Layer V3 - Quick Start Guide

**A True Closed-Loop Learning System for Chess Coaching**

---

## What Is This?

Learning Layer V3 transforms ChessChat from a static coaching app into an **adaptive learning system** that:

- 📊 **Tracks mastery** of 29 chess concepts (not just blunders)
- 🎯 **Personalizes coaching** based on YOUR weaknesses
- 📈 **Measures effectiveness** of advice and adapts
- 🔄 **Generates practice plans** that evolve with you
- 🔍 **Stays transparent** - every decision is auditable

**This is NOT fake learning.** The system changes its behavior based on measured outcomes.

---

## Quick Example

### Before Learning Layer V3:
> "You made 3 mistakes in this game. Try to do better next time."

### After Learning Layer V3:
> "Focus on **Preventing Hanging Pieces** (mastery: 42%). In this game, move 8 (Nf6) lost 400 centipawns due to leaving your knight unprotected. This is the 3rd time in your last 3 games. **Action:** Before each move, ask yourself: 'Is every piece protected?' Let's practice 10-15 tactical puzzles focusing on this."
>
> **Evidence:** Games #145, #147, #149 (last 5 days)  
> **Next Check:** I'll evaluate your progress after 5 more games.

---

## How It Works

### 1. Game Analysis (Automatic)
When you finish a game:
```
Game → Stockfish Analysis → Mistake Detection → Concept Tagging
```

**Example:**
- Move 8: Lost 400cp → Tagged: `hanging_pieces`
- Move 15: Lost 200cp → Tagged: `back_rank_mate`
- Move 22: Lost 100cp → Tagged: `king_safety_opening`

### 2. Mastery Updates
For each concept you encountered:
```
Before: mastery = 0.50, confidence = 0.3
Mistake detected → mastery drops to 0.42, confidence increases to 0.35
Due date: 3 days (because mastery is low)
```

### 3. Coaching Selection
System picks top 3 concepts that need work:
```
Priority 1: hanging_pieces (mastery 0.42, 3 mistakes in last 3 games)
Priority 2: back_rank_mate (mastery 0.58, overdue by 2 days)
Priority 3: tactical_forks (mastery 0.65, due tomorrow)
```

### 4. Intervention Tracking
When coach gives advice:
```
Advice: "Practice hanging piece awareness"
Expected outcome: Reduce from 3 → 1.5 per game
Evaluation window: Next 5 games
```

### 5. Outcome Measurement
After 5 games:
```
Actual mistakes: 3 total (0.6 per game)
Baseline: 3 per game
Delta: -2.4 (improvement!)
Outcome: SUCCESS ✅
→ Mastery increases to 0.52
→ Due date shifts to 7 days
```

---

## Concept Taxonomy

We track 29 chess concepts across 6 categories:

### Tactical (8 concepts)
- Hanging Pieces ⭐ (Level 1)
- Tactical Awareness (Level 2)
- Back Rank Mate (Level 2)
- Forks (Level 2)
- Pins & Skewers (Level 3)
- Discovered Attacks (Level 3)
- Removing Defender (Level 3)

### Opening (5 concepts)
- Opening Principles ⭐ (Level 1)
- King Safety (Level 2)
- Center Control (Level 2)
- Development Speed (Level 2)
- Opening Traps (Level 3)

### Positional (5 concepts)
- Pawn Structure (Level 3)
- Piece Activity (Level 3)
- Space Advantage (Level 4)
- Weak Squares (Level 4)
- Piece Exchanges (Level 3)

### Endgame (4 concepts)
- Basic Checkmates ⭐ (Level 1)
- Pawn Endgames (Level 3)
- Rook Endgames (Level 4)
- King Activity (Level 3)

### Strategic (3 concepts)
- Planning (Level 4)
- Prophylaxis (Level 5)
- Initiative & Tempo (Level 4)

### Practical (2 concepts)
- Time Management (Level 2)
- Blunder Checking (Level 2)

⭐ = Beginner-friendly concepts

---

## Using the System

### For Players

**After Each Game:**
```typescript
// Automatic - happens when game completes
POST /api/learning/ingest-game
```

**Get Coaching:**
```typescript
POST /api/walle/postgame
// Returns: insight, target concepts, evidence
```

**Check Your Progress:**
```typescript
GET /api/learning/profile?userId={your_id}
// Returns: mastery scores, strengths, weaknesses
```

**Get Practice Plan:**
```typescript
GET /api/learning/plan?userId={your_id}&window=7
// Returns: 3-5 target concepts, suggested drills
```

### For Developers

**Monitor System Health:**
```bash
curl https://your-worker.dev/api/admin/learning-health
```

**Query Learning Events:**
```sql
SELECT * FROM learning_events 
WHERE userId = 'user_123' 
ORDER BY ts DESC 
LIMIT 20;
```

**Check Intervention Success:**
```sql
SELECT outcome, COUNT(*) 
FROM advice_interventions 
WHERE outcome IS NOT NULL 
GROUP BY outcome;
```

---

## API Reference

### POST /api/learning/ingest-game
Analyze game and update concept states.

**Request:**
```json
{
  "gameId": "game_123",
  "userId": "user_456",
  "pgn": "1. e4 e5 2. Nf3 Nc6...",
  "metadata": {
    "mode": "vs-cpu",
    "cpuLevel": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "conceptsUpdated": ["hanging_pieces", "tactical_awareness"],
  "summary": {
    "hanging_pieces": {
      "mastery": 0.42,
      "delta": -0.08,
      "mistakeCount": 2
    }
  },
  "nextDueConcepts": ["hanging_pieces", "back_rank_mate"]
}
```

### GET /api/learning/plan
Get personalized practice plan.

**Query:** `?userId=user_456&window=7`

**Response:**
```json
{
  "success": true,
  "plan": {
    "targetConcepts": [
      {
        "conceptId": "hanging_pieces",
        "name": "Preventing Hanging Pieces",
        "priority": 8.2,
        "reason": "High mistake frequency: 3 in last 3 games",
        "currentMastery": 0.42
      }
    ],
    "suggestedDrills": [
      "Practice Preventing Hanging Pieces puzzles (10-15 problems)",
      "Play at least 3 games this week and review them"
    ]
  },
  "rationale": "Focus on Preventing Hanging Pieces (mastery: 42%). High mistake frequency..."
}
```

### POST /api/walle/postgame
Generate coaching insights.

**Request:**
```json
{
  "userId": "user_456",
  "gameId": "game_123",
  "includeAdvice": true
}
```

**Response:**
```json
{
  "success": true,
  "insight": "Focus on Preventing Hanging Pieces: In this game, move 8 (Nf6) lost 400 centipawns...",
  "targetConcepts": ["hanging_pieces"],
  "interventionId": "intervention_789",
  "evidence": [
    {
      "gameId": "game_123",
      "moveNum": 8,
      "description": "Nf6 (-400cp)"
    }
  ]
}
```

---

## File Structure

```
ChessChatWeb/
├── worker-api/
│   ├── src/
│   │   ├── learningCore.ts           # Mastery calculation
│   │   ├── gameAnalysis.ts           # Stockfish + concept detection
│   │   ├── learningIngestion.ts     # State updates + interventions
│   │   ├── concepts.json             # 29-concept taxonomy
│   │   ├── index-new.ts              # API endpoints
│   │   └── __tests__/
│   │       └── learningCore.test.ts  # Unit tests
│   └── prisma/
│       ├── schema.prisma             # Database schema
│       └── migrations/
│           └── 20251230_learning_layer_v3/
│               └── migration.sql     # Migration
├── LEARNING_LAYER_V3.md                          # Full specification
├── LEARNING_LAYER_V3_IMPLEMENTATION_SUMMARY.md  # What was built
├── LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md   # Deploy guide
└── LEARNING_LAYER_V3_README.md                  # This file
```

---

## Database Schema

**4 New Tables:**

### user_concept_states
Tracks mastery for each concept per user.
```sql
userId + conceptId (unique)
mastery: 0.0-1.0
confidence: 0.0-1.0
spacedRepDueAt: DateTime
evidenceRefs: JSON (last 10 games)
```

### advice_interventions
Records coaching advice and measures effectiveness.
```sql
conceptsTargeted: JSON
expectedBehavior: Text
evaluationGames: Int (default: 5)
outcome: 'success' | 'partial' | 'failure'
measuredDelta: Float
```

### practice_plans
Weekly plans with target concepts and drills.
```sql
planStart/planEnd: DateTime
targetConcepts: JSON
suggestedDrills: JSON
adherenceScore: Float
```

### learning_events
Audit log of all learning actions.
```sql
eventType: 'GAME_INGESTED' | 'CONCEPT_UPDATED' | 'ADVICE_ISSUED' | 'ADVICE_EVALUATED'
payload: JSON
```

---

## Testing

### Run Unit Tests
```bash
cd worker-api
npm test learningCore.test.ts
```

### Manual Testing
```bash
# 1. Start local worker
npm run dev

# 2. Play a test game and get PGN

# 3. Ingest game
curl -X POST http://localhost:8787/api/learning/ingest-game \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test_game_1",
    "userId": "test_user_1",
    "pgn": "1. e4 e5 2. Nf3 Nc6..."
  }'

# 4. Get practice plan
curl "http://localhost:8787/api/learning/plan?userId=test_user_1&window=7"

# 5. Generate coaching
curl -X POST http://localhost:8787/api/walle/postgame \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_1",
    "gameId": "test_game_1",
    "includeAdvice": true
  }'
```

---

## Deployment

See [LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md](./LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md) for full deployment guide.

**Quick Deploy:**
```bash
# 1. Run migration
cd worker-api
npx prisma migrate deploy

# 2. Deploy worker
npm run deploy

# 3. Verify health
curl https://your-worker.dev/api/admin/learning-health
```

---

## Monitoring

### Health Check
```bash
curl https://your-worker.dev/api/admin/learning-health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "learning": {
    "totalConceptStates": 150,
    "totalInterventions": 45,
    "recentActivity": 12,
    "interventionSuccessRate": 67
  }
}
```

### Key Metrics
- **Concept States:** Should grow with active users
- **Recent Activity:** Events in last hour
- **Success Rate:** % of interventions marked "success"
- **Average Mastery:** Across all concepts (should improve over time)

---

## FAQ

**Q: How often should I check my practice plan?**  
A: Weekly. The system generates a 7-day plan with 3-5 focus areas.

**Q: What if I disagree with the coaching advice?**  
A: Use `POST /api/learning/feedback` to mark advice as "not helpful". The system will adapt.

**Q: How long until I see improvement?**  
A: Typically 10-15 games per concept. The system tracks progress automatically.

**Q: Can I see my full learning history?**  
A: Yes, via `GET /api/learning/profile?userId={your_id}`

**Q: Does this affect CPU move selection?**  
A: NO. Learning influences coaching only, not moves. Stockfish determines all CPU moves.

**Q: What if a concept isn't relevant to me?**  
A: The system auto-adjusts. If you consistently perform well on a concept, it deprioritizes it.

---

## Troubleshooting

### Issue: Game not analyzed
**Check:**
1. Is gameId valid in database?
2. Is Stockfish worker running?
3. Check `/api/admin/learning-health` for errors

### Issue: No concept states created
**Check:**
1. Was `POST /api/learning/ingest-game` called?
2. Check database: `SELECT * FROM user_concept_states WHERE userId = '...'`
3. Review learning_events log

### Issue: Practice plan empty
**Reason:** Not enough games played yet.  
**Solution:** Play 3-5 games to build initial profile.

### Issue: Coaching advice generic
**Reason:** System needs more data to be specific.  
**Solution:** After 10+ games, advice becomes highly personalized.

---

## Contributing

### Adding New Concepts
1. Edit `worker-api/src/concepts.json`
2. Add concept detector in `gameAnalysis.ts`
3. Update tests
4. Document in this README

### Improving Detectors
- See `gameAnalysis.ts` functions: `detectHangingPiece`, `detectBackRankMate`, etc.
- Add more sophisticated pattern matching
- Keep rule-based (no ML required)

### Enhancing Coaching
- Update `handleWallePostgame` in `index-new.ts`
- Integrate full Wall-E AI for narrative
- Add more contextual advice

---

## Support

**Documentation:**
- [Full Specification](./LEARNING_LAYER_V3.md)
- [Implementation Summary](./LEARNING_LAYER_V3_IMPLEMENTATION_SUMMARY.md)
- [Deployment Checklist](./LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md)

**Technical:**
- Worker logs: `npx wrangler tail`
- Database: `npx prisma studio`
- Tests: `npm test`

---

## License

Part of ChessChat project. See main LICENSE file.

---

**🎓 Welcome to Learning Layer V3 - True Adaptive Chess Coaching!**
