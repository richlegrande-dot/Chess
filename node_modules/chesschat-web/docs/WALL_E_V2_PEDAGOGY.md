# Wall-E v2 Pedagogy - Chess Coaching System

**Date**: December 26, 2025  
**Version**: 2.0  
**Status**: Production Ready

---

## 🎯 Overview

Wall-E v2 transforms the coaching system from reactive advice to pedagogically structured coaching based on chess teaching principles.

### Key Improvements

1. **Personalized Strategy Selection** - Adapts teaching method based on player level
2. **Mistake Fatigue Prevention** - Avoids repeating same advice
3. **Mastery-Gated Learning** - Doesn't introduce new concepts until old ones stabilize
4. **Concept Spiral** - Reintroduces concepts at deeper levels
5. **Tactical → Strategic Progression** - Guides players from basics to advanced

---

## 📚 Pedagogical Design Principles

### 1. Teach ONE Concept at a Time

**Problem**: Overwhelming players with multiple improvement areas dilutes focus.

**Solution**: Wall-E selects a single focus pattern per session based on:
- Highest occurrence count
- Lowest mastery score
- Recent performance trends

**Implementation**:
```typescript
function selectFocusPattern(
  context: CoachingContext,
  fatigueDetected: boolean
): MistakePattern | null
```

### 2. Pattern Correction Over Move Critique

**Problem**: Criticizing individual moves doesn't build transferable skills.

**Solution**: Wall-E identifies recurring mistake patterns and addresses the underlying weakness.

**Example**:
- ❌ "You blundered your queen on move 23"
- ✅ "You've left pieces undefended in 5 of your last 10 games. Before moving, check: Is my piece safe?"

### 3. Cause → Consequence → Correction

**Problem**: Generic advice ("play better") doesn't teach.

**Solution**: Every coaching message follows:
1. **Cause**: What the player did wrong
2. **Consequence**: Why it led to a bad position
3. **Correction**: Specific action to improve

**Implementation**:
```typescript
function generateCauseConsequenceCorrection(
  pattern: MistakePattern,
  teachingMethod: string
): { cause, consequence, correction, refinement }
```

### 4. Verbosity Decreases with Mastery

**Problem**: Experienced players don't need lengthy explanations.

**Solution**: Verbosity scales inversely with mastery score:
- **Detailed** (mastery < 0.4): Full explanations with examples
- **Moderate** (mastery 0.4-0.7): Balanced advice
- **Concise** (mastery > 0.7): Brief reminders

**Implementation**:
```typescript
function determineVerbosity(
  context: CoachingContext,
  focusPattern: MistakePattern | null
): 'detailed' | 'moderate' | 'concise'
```

---

## 🧠 Coaching Heuristics

### Heuristic 1: Mistake Fatigue Detection

**Purpose**: Avoid repeating same advice if player isn't responding.

**Threshold**: Same pattern addressed 3+ times in last 10 sessions.

**Action**: Switch focus to second-priority pattern.

```typescript
function detectMistakeFatigue(context: CoachingContext): boolean
```

**Example**:
- Games 1-5: "Focus on hanging pieces"
- Games 6-10: "Focus on hanging pieces" (fatigue threshold reached)
- Games 11+: "Let's work on weak squares instead"

### Heuristic 2: Mastery Gate

**Purpose**: Don't introduce new concepts until current concept stabilizes.

**Gate Rule**: 
- If top pattern has mastery < 0.6 AND occurred in last 3 games → Gate CLOSED
- Otherwise → Gate OPEN

```typescript
function applyMasteryGate(context: CoachingContext): boolean
```

**Example**:
- Player mastery for "hanging pieces": 0.4
- Last occurrence: 2 games ago
- Gate: CLOSED ❌ (reinforce current concept)

### Heuristic 3: Concept Spiral

**Purpose**: Reintroduce concepts at increasing depth as player advances.

**Teaching Methods**:
1. **Introduce** (occurrences ≤ 2): First encounter
2. **Reinforce** (mastery < 0.5): Repetition with examples
3. **Deepen** (mastery 0.5-0.8): Advanced nuances
4. **Maintain** (mastery > 0.8): Occasional reminders

```typescript
function determineTeachingMethod(
  context: CoachingContext,
  focusPattern: MistakePattern | null
): 'introduce' | 'reinforce' | 'deepen' | 'maintain'
```

**Example Progression**:
```
Phase 1 (Introduce):
  "Hanging pieces means leaving them undefended. This loses material."

Phase 2 (Reinforce):
  "Before moving, ask: Is my piece safe? Will it be safe after my opponent's reply?"

Phase 3 (Deepen):
  "Even when pieces look safe, check for tactical shots. Can opponent fork/pin/skewer?"

Phase 4 (Maintain):
  "Keep checking piece safety. You've mastered this!"
```

### Heuristic 4: Loss Aversion Bias Correction

**Purpose**: Detect and correct overly defensive play after losses.

**Detection**: 2+ losses in last 3 games.

**Correction**: Encourage normal, aggressive play.

```typescript
function correctForLossAversionBias(
  context: CoachingContext
): { hasBias: boolean; suggestion: string }
```

### Heuristic 5: Tactical → Strategic Progression

**Purpose**: Guide players from tactical basics to strategic mastery.

**Progression Rule**:
- Accuracy < 70% OR tactical errors dominant → **Focus on tactics**
- Accuracy > 80% AND strategic mistakes present → **Focus on strategy**
- Otherwise → **Balanced approach**

```typescript
function applyTacticalStrategicProgression(
  context: CoachingContext
): 'tactical' | 'strategic' | 'balanced'
```

---

## 🎓 Player Level Classification

Wall-E classifies players into 4 levels:

### Beginner
- Accuracy < 60%
- High mistake diversity (8+ unique types)
- **Coaching**: Detailed explanations, fundamentals focus

### Intermediate
- Accuracy 60-75%
- Average mastery < 0.5
- **Coaching**: Moderate detail, pattern reinforcement

### Advanced
- Accuracy > 75%
- Average mastery 0.5-0.8
- **Coaching**: Concise advice, refinements

### Maintenance
- Accuracy > 85%
- Average mastery > 0.8
- **Coaching**: Brief reminders, challenge seeking

**Implementation**:
```typescript
function determinePlayerLevel(
  context: CoachingContext
): 'beginner' | 'intermediate' | 'advanced' | 'maintenance'
```

---

## 🔄 Strategy Selection Flow

```
┌─────────────────────────────────────┐
│   Fetch Learning History            │
│   - Recent games (10)               │
│   - Top mistakes (3)                │
│   - Learning metrics                │
│   - Coaching memory                 │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Determine Player Level            │
│   (beginner/intermediate/advanced)  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Detect Mistake Fatigue            │
│   (same advice 3+ times?)           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Apply Mastery Gate                │
│   (can introduce new concept?)      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Select Focus Pattern              │
│   (top unmastered or second if      │
│    fatigue detected)                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Determine Teaching Method         │
│   (introduce/reinforce/deepen)      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Set Verbosity Level               │
│   (detailed/moderate/concise)       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Generate Advice Template          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Compose Final Advice              │
│   (fill template with specifics)    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Track Advice Issued               │
│   (for fatigue detection)           │
└─────────────────────────────────────┘
```

---

## 🔧 Integration with Wall-E Engine

Wall-E engine (`functions/lib/walleEngine.ts`) integrates heuristics v2 in the chat method:

```typescript
async chat(context, userMessage, gameContext): Promise<WallEChatResponse> {
  // Fetch learning history
  const learningHistory = await this.fetchLearningHistory(prisma, userId);
  
  // Build heuristics context
  const heuristicsCtx = this.buildHeuristicsContext(learningHistory);
  
  // Select coaching strategy
  const strategy = selectCoachingStrategy(heuristicsCtx);
  
  // Check for bias
  const biasCheck = correctForLossAversionBias(heuristicsCtx);
  
  // Compose advice
  let response = composeAdvice(strategy, heuristicsCtx);
  
  // Add bias correction if needed
  if (biasCheck.hasBias) {
    response += `\n\n💡 ${biasCheck.suggestion}`;
  }
  
  // Track advice issued
  if (strategy.focusPattern) {
    const adviceRecord = trackAdviceIssued(strategy.focusPattern, response);
    await this.updateCoachingMemory(prisma, userId, adviceRecord);
  }
  
  // Add personalized references (≥2 required)
  response = augmentWithPersonalization(response, references, evidence);
  
  return { response, confidenceScore, historyEvidence, ... };
}
```

---

## 📊 Advice Evolution Example

**Player Journey**: "Hanging Pieces" Pattern

### Game 5 (Beginner, Introduce)
```
Strategy: beginner / introduce
Verbosity: detailed

"Let's learn about Hanging Pieces. When you leave pieces undefended, your 
opponent can capture them for free, losing material. Before each move, 
double-check: Is my piece protected?"
```

### Game 15 (Beginner → Intermediate, Reinforce)
```
Strategy: intermediate / reinforce
Verbosity: moderate

"Hanging Pieces needs more work. In 3 of your last 10 games, you left pieces 
undefended. Focus on: Before moving, ask 'Will my piece be safe after opponent's 
reply?'"
```

### Game 30 (Intermediate, Deepen)
```
Strategy: intermediate / deepen
Verbosity: moderate

"You understand piece safety, but watch for tactical vulnerabilities. Even defended 
pieces can be targets for forks, pins, and skewers. Calculate forcing moves before 
committing."
```

### Game 45 (Advanced, Maintain)
```
Strategy: advanced / maintain
Verbosity: concise

"Piece safety is solid. Keep applying it. You've left only 1 piece hanging in your 
last 10 games—great improvement!"
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Test strategy selection
describe('selectCoachingStrategy', () => {
  it('selects beginner strategy for new players', ...)
  it('applies mistake fatigue penalty', ...)
  it('respects mastery gate', ...)
});
```

### Integration Tests
See `tests/learning-simulation.test.ts` for 50-game progression validation.

### Manual Verification
1. Seed player with 3 mistake patterns
2. Play 20 games, making same mistakes
3. Verify advice evolves (introduce → reinforce → deepen)
4. Verify fatigue detection switches focus
5. Verify mastery gate prevents new concepts

---

## 📈 Success Metrics

### Coaching Quality
- **Advice diversity**: Different advice across phases (not static)
- **Fatigue prevention**: Max 3 repetitions per pattern before switching
- **Mastery correlation**: Advice method matches mastery score

### Player Improvement
- **Mistake recurrence**: Decreases over time
- **Advice follow-through**: Increases over time
- **Confidence score**: Correlates with accuracy improvement

---

## 🔒 Guarantees

1. **No Hallucination**: All advice references actual stored patterns
2. **Pedagogically Sound**: Follows established teaching principles
3. **Adaptable**: Adjusts to player level and progress
4. **Fatigue-Resistant**: Avoids repetitive advice
5. **Evidence-Based**: Every strategy decision backed by data

---

## 📝 API Changes

### Chat Endpoint (`/api/chat`)

**Response Enhancement**:
```typescript
{
  response: string,              // Generated advice
  confidenceScore: number,       // 0-1
  sourcesUsed: string[],         // ['coaching_heuristics_v2', ...]
  learningApplied: boolean,
  historyEvidence: {             // REQUIRED
    personalizedReferenceCount: number,
    ...
  },
  personalizedReferences: [      // REQUIRED (≥2)
    { kind, text, source },
    ...
  ]
}
```

---

## 🚀 Deployment

### Prerequisites
- Prisma schema includes `CoachingMemory` model
- Wall-E engine v2 deployed
- DATABASE_URL configured (optional, graceful degradation)

### Migration
No breaking changes. v2 is backward compatible with v1 responses.

### Rollback
If needed, revert to commit before heuristics v2 integration.

---

## 📚 Related Documentation

- [Learning Quality Signals](./LEARNING_SIGNALS.md)
- [Progression Metrics](./PROGRESSION_METRICS.md)
- [50-Game Simulation](../tests/learning-simulation.test.ts)
- [Wall-E Implementation](../WALL_E_IMPLEMENTATION.md)

---

**Document Version**: 1.0  
**Last Updated**: December 26, 2025  
**Maintained By**: ChessChat Development Team
