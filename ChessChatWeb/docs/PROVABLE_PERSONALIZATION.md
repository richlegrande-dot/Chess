# Provable Personalization System

**Status**: ✅ Implemented  
**Date**: December 26, 2025  
**Version**: 1.0.0

---

## Executive Summary

Wall-E's coaching responses now include **provable references** to the user's stored gameplay history, ensuring that advice is demonstrably personalized and not generic.

**Core Requirement**: Every coaching response must include ≥2 explicit personalized references sourced from:
- User's last 10 games
- User's top 3 mistake patterns

---

## Why This Matters

### The Problem
Without this system:
- Generic AI advice could be served to all users
- No verification that learning history is actually used
- Users can't see evidence of personalization
- Testing personalization is difficult

### The Solution
With provable personalization:
- Every response includes explicit history-based references
- Machine-verifiable evidence block in responses
- CI tests enforce the ≥2 reference requirement
- Users see clear evidence of learning loop working

---

## Architecture

### PersonalizedReference Type
```typescript
interface PersonalizedReference {
  kind: 'last10games' | 'topMistakePattern';
  text: string;  // Human-readable reference
  source: {
    gameId?: string;
    patternKey?: string;
    gameIds?: string[];  // For aggregated references
  };
}
```

### HistoryEvidence Block
```typescript
interface HistoryEvidence {
  lastGamesUsed: number;           // <= 10
  gameIdsUsed: string[];           // Game IDs referenced
  topMistakePatternsUsed: string[]; // Pattern keys referenced
  personalizedReferenceCount: number; // Must be >= 2
  insufficientHistory: boolean;
  insufficientReason?: string;
}
```

### Data Flow
```
User Request
    ↓
Fetch Learning History (Prisma)
    ├─ Last 10 games
    ├─ Top 3 mistake patterns
    └─ Player profile
    ↓
Build PersonalizationContext
    ↓
Generate Personalized References
    ├─ Extract game patterns
    ├─ Extract mistake patterns
    └─ Create explicit references
    ↓
Augment Response
    ├─ Add "Based on your history:" section
    └─ Include ≥2 explicit references
    ↓
Validate Personalization
    ├─ Check: ≥2 references present?
    ├─ Check: Evidence block complete?
    └─ Check: References appear in text?
    ↓
Return Response + Evidence
```

---

## Implementation

### Core Files

**1. `functions/lib/personalizedReferences.ts`**
- `buildPersonalizedReferences()` - Extracts references from history
- `validatePersonalization()` - Enforces ≥2 reference rule
- `augmentWithPersonalization()` - Adds references to response
- `formatReferences()` - Formats for human reading

**2. `functions/lib/walleEngine.ts`**
- Enhanced `chat()` with personalization guard
- Enhanced `analyzeGame()` with personalization guard
- Returns `historyEvidence` and `personalizedReferences` in all responses

**3. `functions/api/chat.ts`**
- Returns `historyEvidence` and `personalizedReferences` fields

**4. `functions/api/analyze-game.ts`**
- Returns `historyEvidence` and `personalizedReferences` fields

---

## Examples

### Sufficient History (≥10 games, ≥3 patterns)

**Request**:
```json
POST /api/chat
{
  "message": "What should I work on?",
  "userId": "player-123"
}
```

**Response**:
```json
{
  "success": true,
  "response": "Based on your recent performance...\n\n**Based on your history:** In 5 of your last 10 games, you struggled with tactical misses. Your #1 recurring mistake pattern is \"Leaving Pieces En Prise\" (seen 15 times: Leaving pieces undefended).\n\n...",
  "confidenceScore": 0.85,
  "sourcesUsed": ["knowledge_base", "player_history"],
  "learningApplied": true,
  "historyEvidence": {
    "lastGamesUsed": 10,
    "gameIdsUsed": ["g1", "g2", "g3", "g4", "g5"],
    "topMistakePatternsUsed": ["hanging_pieces", "back_rank"],
    "personalizedReferenceCount": 3,
    "insufficientHistory": false
  },
  "personalizedReferences": [
    {
      "kind": "last10games",
      "text": "In 5 of your last 10 games, you struggled with tactical misses.",
      "source": { "gameIds": ["g1", "g2", "g3", "g4", "g5"] }
    },
    {
      "kind": "topMistakePattern",
      "text": "Your #1 recurring mistake pattern is \"Leaving Pieces En Prise\" (seen 15 times: Leaving pieces undefended).",
      "source": { "patternKey": "hanging_pieces" }
    },
    {
      "kind": "topMistakePattern",
      "text": "Your #2 recurring mistake pattern is \"Back Rank Weakness\" (seen 8 times: Missing back rank tactics).",
      "source": { "patternKey": "back_rank" }
    }
  ]
}
```

### Insufficient History (< 2 games)

**Request**:
```json
POST /api/chat
{
  "message": "Give me advice",
  "userId": "newbie-456"
}
```

**Response**:
```json
{
  "success": true,
  "response": "Welcome! Focus on chess fundamentals...\n\n*Note: I currently have only 1 game(s) recorded, so my coaching is based on general chess principles. Play more games so I can provide increasingly personalized advice!*",
  "confidenceScore": 0.4,
  "sourcesUsed": ["knowledge_base"],
  "learningApplied": false,
  "historyEvidence": {
    "lastGamesUsed": 1,
    "gameIdsUsed": ["g1"],
    "topMistakePatternsUsed": [],
    "personalizedReferenceCount": 0,
    "insufficientHistory": true,
    "insufficientReason": "only 1 game(s) recorded, no mistake patterns identified yet"
  },
  "personalizedReferences": []
}
```

---

## Reference Types

### Game-Based References

**1. Recurring Mistake Aggregation**
```
"In 3 of your last 10 games, you struggled with tactical misses."
```
Source: Aggregates mistake types across recent games

**2. Result Pattern**
```
"In your last 7 completed games: 3 wins, 3 losses, 1 draw."
```
Source: Game results from history

**3. Performance Trend**
```
"Your accuracy improved from 75% to 85% over your last 10 games."
```
Source: Metrics from game history

### Pattern-Based References

**1. Top Mistake Pattern (#1)**
```
"Your #1 recurring mistake is 'Leaving Pieces En Prise' (15 occurrences)."
```
Source: MistakeSignature table, top by occurrenceCount

**2. Secondary Mistake Pattern (#2/#3)**
```
"Your #2 mistake pattern is 'Back Rank Weakness' (8 times: Missing back rank tactics)."
```
Source: MistakeSignature table, sorted by occurrenceCount

**3. Pattern with Description**
```
"Your #1 recurring mistake pattern is 'Fork Vulnerability' (seen 5 times: Susceptible to knight forks)."
```
Source: MistakeSignature with description field

---

## Validation Rules

### Sufficient History
When user has ≥10 games OR ≥3 mistake patterns:
- ✅ Response MUST include ≥2 personalized references
- ✅ `historyEvidence.personalizedReferenceCount >= 2`
- ✅ `historyEvidence.insufficientHistory === false`
- ✅ References MUST appear in response text

### Insufficient History
When user has <2 games AND <1 pattern:
- ✅ `historyEvidence.insufficientHistory === true`
- ✅ `insufficientReason` explains what's missing
- ✅ Response acknowledges limited history
- ✅ System uses best available data

---

## Testing

### Unit Tests

**File**: `functions/lib/personalizedReferences.test.ts`

**Coverage**:
- ✅ Build references from 10+ games + 3+ patterns
- ✅ Handle insufficient history gracefully
- ✅ Extract game result references
- ✅ Extract top mistake pattern references
- ✅ Validate personalization rules
- ✅ Format references for human reading
- ✅ Augment responses with personalization

### Integration Tests

**File**: `tests/provable-personalization.test.ts`

**Coverage**:
- ✅ Chat endpoint with sufficient history
- ✅ Game analysis endpoint with sufficient history
- ✅ Chat endpoint with insufficient history
- ✅ Analysis endpoint with insufficient history
- ✅ Evidence block structure validation
- ✅ Reference count validation

### CI Enforcement

**File**: `.github/workflows/ci.yml`

**Checks**:
1. Unit tests for personalization system
2. Verify Wall-E imports personalization module
3. Verify chat.ts returns historyEvidence
4. Verify analyze-game.ts returns historyEvidence
5. Block merge if validation fails

---

## Database Requirements

### Required Tables

**PlayerProfile**
```prisma
model PlayerProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  skillRatings      Json     // { overall, tactical, positional }
  behavioralPatterns Json    // Play style data
  gamesPlayed       Int      @default(0)
  improvementRate   Float    @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**TrainingGame**
```prisma
model TrainingGame {
  id        String   @id @default(cuid())
  userId    String
  fen       String
  moves     String   // JSON array
  analysis  String   // JSON with mistakes
  metrics   String   // JSON with accuracy, blunders
  result    String?  // win/loss/draw
  timestamp DateTime @default(now())
  
  @@index([userId, timestamp])
}
```

**MistakeSignature**
```prisma
model MistakeSignature {
  id               String   @id @default(cuid())
  userId           String
  signatureKey     String
  title            String
  category         String
  occurrenceCount  Int
  patternDetails   String   // JSON
  examplePositions String   // JSON
  relatedConcepts  String   // JSON
  lastSeen         DateTime
  createdAt        DateTime @default(now())
  
  @@unique([userId, signatureKey])
  @@index([userId, occurrenceCount])
}
```

---

## Deployment Checklist

### Pre-Deployment
- [x] PersonalizedReference system implemented
- [x] HistoryEvidence block added to responses
- [x] Wall-E engine updated with guards
- [x] chat.ts returns evidence
- [x] analyze-game.ts returns evidence
- [x] Unit tests written
- [x] Integration tests written
- [x] CI workflow updated
- [x] Documentation complete

### Post-Deployment
- [ ] Verify historyEvidence in production responses
- [ ] Monitor personalizedReferenceCount metrics
- [ ] Check insufficientHistory rate for new users
- [ ] Validate reference text quality
- [ ] Test with real user data
- [ ] Monitor CI for personalization failures

---

## Troubleshooting

### Issue: References Not Generated

**Symptom**: `personalizedReferenceCount === 0` even with sufficient history

**Check**:
1. Verify database has ≥10 games for user
2. Verify database has ≥1 mistake pattern
3. Check game records have `mistakes` field populated
4. Check mistake patterns have `occurrenceCount > 0`

**Fix**:
```typescript
// Ensure games include mistakes
const game = {
  userId: 'test-user',
  mistakes: [
    { type: 'tactical_miss', move: 'Nc6' }
  ]
};
```

### Issue: Validation Fails

**Symptom**: CI fails with "Only 1 personalized reference found"

**Check**:
1. Verify `buildPersonalizedReferences()` returns ≥2 references
2. Check that both game and pattern references are built
3. Verify `augmentWithPersonalization()` includes all references

**Fix**:
Ensure sufficient data sources:
- At least 3-4 games with mistakes
- At least 2-3 mistake patterns with occurrences

### Issue: Generic Responses

**Symptom**: Response doesn't mention specific games or patterns

**Check**:
1. Verify `augmentWithPersonalization()` is called
2. Check that references are being formatted into text
3. Verify response includes "Based on your history:" section

**Fix**:
```typescript
// Ensure augmentation happens
const augmented = augmentWithPersonalization(
  baseResponse,
  references,
  evidence
);
```

---

## Future Enhancements

### Phase 2: Enhanced References
- [ ] Opening repertoire references ("You've played Italian 8 times")
- [ ] Time management references ("Average 15s/move in last 10 games")
- [ ] Phase-specific patterns ("Endgame accuracy: 72% vs midgame: 85%")

### Phase 3: Adaptive Coaching
- [ ] Reference selection based on user question
- [ ] Prioritize most relevant patterns for current game
- [ ] Dynamic reference count (more for complex queries)

### Phase 4: UI Integration
- [ ] Display reference sources visually
- [ ] Click to view referenced games
- [ ] Show pattern evolution over time
- [ ] Reference confidence scores

---

## API Contract

### Chat Endpoint

**Request**:
```typescript
POST /api/chat
{
  message: string;
  gameContext?: {
    accuracy?: number;
    blunders?: number;
    mistakes?: number;
  };
  userId?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  response: string;
  confidenceScore: number;
  sourcesUsed: string[];
  learningApplied: boolean;
  learningEnabled: boolean;
  historyEvidence: HistoryEvidence;      // REQUIRED
  personalizedReferences: PersonalizedReference[]; // REQUIRED
}
```

### Game Analysis Endpoint

**Request**:
```typescript
POST /api/analyze-game
{
  pgn: string;
  moveHistory: string[];
  playerColor: string;
  cpuLevel?: number;
  result?: string;
  userId?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  analysis: string;
  recommendations: string[];
  personalizedInsights: string[];
  sourcesUsed: string[];
  confidenceScore: number;
  learningEnabled: boolean;
  historyEvidence: HistoryEvidence;      // REQUIRED
  personalizedReferences: PersonalizedReference[]; // REQUIRED
}
```

---

## Success Metrics

### Personalization Rate
```
personalizedResponses / totalResponses >= 80%
```
Target: ≥80% of responses include personalized references

### Average References Per Response
```
sum(personalizedReferenceCount) / totalResponses
```
Target: ≥2.5 references per response (sufficient history)

### Insufficient History Rate
```
insufficientHistoryResponses / totalResponses
```
Target: <20% (most users have sufficient history)

### CI Pass Rate
```
successfulBuilds / totalBuilds
```
Target: 100% (personalization guards never fail)

---

## Maintenance

### Weekly
- Monitor personalizedReferenceCount distribution
- Check for validation failures in CI
- Review insufficientHistory reasons

### Monthly
- Analyze reference quality (manual sampling)
- Update reference generation logic based on feedback
- Add new reference types as data grows

### Quarterly
- Review personalization metrics vs user satisfaction
- Optimize reference selection algorithms
- Expand test coverage for edge cases

---

## Contact & Support

**Implementation Team**: GitHub Copilot  
**Repository**: richlegrande-dot/Chess  
**Documentation**: `docs/PROVABLE_PERSONALIZATION.md`  
**Tests**: `functions/lib/personalizedReferences.test.ts`, `tests/provable-personalization.test.ts`  

**Key Files**:
- `functions/lib/personalizedReferences.ts` - Core system
- `functions/lib/walleEngine.ts` - Integration
- `functions/api/chat.ts` - Chat endpoint
- `functions/api/analyze-game.ts` - Analysis endpoint
- `.github/workflows/ci.yml` - CI enforcement

---

**Status**: ✅ Ready for Production  
**Version**: 1.0.0  
**Last Updated**: December 26, 2025
