# Learning Quality Signals - Coaching Effectiveness Metrics

**Date**: December 26, 2025  
**Version**: 1.0  
**Module**: `functions/lib/learningAudit.ts`

---

## 🎯 Purpose

Detect whether Wall-E coaching quality is actually improving over time using derived metrics from real gameplay data.

**Key Constraint**: ALL signals must be computable from database state alone. No logs, no dashboards, no external analytics.

---

## 📊 Core Signals

### 1. Mistake Recurrence Rate

**Definition**: Percentage of mistakes that repeat in the rolling 10-game window.

**Formula**:
```
recurrenceRate = (mistakes appearing 2+ times in last 10 games) / (total unique mistakes) × 100
```

**Interpretation**:
- **High (>60%)**: Player repeating same mistakes frequently
- **Medium (30-60%)**: Some patterns being corrected
- **Low (<30%)**: Strong correction of past mistakes

**Goal**: DECREASE over time (lower is better)

**Implementation**:
```typescript
function computeMistakeRecurrence(
  games: GameMetrics[],
  mistakes: MistakePattern[]
): number
```

---

### 2. Mistake Resolution Rate

**Definition**: Percentage of patterns that have been resolved (mastery > 0.8 OR absent 60+ days).

**Formula**:
```
resolutionRate = (resolved patterns) / (total patterns) × 100

where resolved = masteryScore > 0.8 OR lastOccurrence > 60 days ago
```

**Interpretation**:
- **High (>50%)**: Many patterns successfully corrected
- **Medium (20-50%)**: Gradual improvement
- **Low (<20%)**: Patterns persisting

**Goal**: INCREASE over time (higher is better)

**Implementation**:
```typescript
function computeMistakeResolution(mistakes: MistakePattern[]): number
```

---

### 3. Advice Follow-Through Rate

**Definition**: Percentage of advice that led to pattern correction.

**Formula**:
```
followThroughRate = (advice followed) / (total advice given) × 100
```

**Data Source**:
```typescript
{
  adviceFollowedCount: number,    // From CoachingMemory
  adviceIgnoredCount: number,     // From CoachingMemory
  successfulInterventions: number // From CoachingMemory
}
```

**Interpretation**:
- **High (>60%)**: Player responding well to coaching
- **Medium (30-60%)**: Mixed response
- **Low (<30%)**: Advice not being followed

**Goal**: INCREASE over time (higher is better)

**Implementation**:
```typescript
function computeAdviceFollowThrough(
  coachingMemory: any,
  games: GameMetrics[],
  mistakes: MistakePattern[]
): number
```

---

### 4. Tactical Error Delta

**Definition**: Change in tactical mistakes before vs after coaching (negative = improvement).

**Formula**:
```
delta = (recent tactical errors per game) - (older tactical errors per game)
```

**Window**:
- **Recent**: Last 50% of games
- **Older**: First 50% of games

**Interpretation**:
- **Negative (<-1.0)**: Strong improvement
- **Near zero (-0.5 to 0.5)**: Stable
- **Positive (>0.5)**: Regression

**Goal**: NEGATIVE (improvement)

**Implementation**:
```typescript
function computeTacticalErrorDelta(games: GameMetrics[]): number
```

---

### 5. Game Accuracy Trend (EMA)

**Definition**: Exponential moving average of accuracy over time.

**Formula**:
```
EMA[t] = α × accuracy[t] + (1 - α) × EMA[t-1]

where α = 0.2 (20% weight on new values)
```

**Interpretation**:
- **Rising trend**: Player improving
- **Flat trend**: Plateau
- **Falling trend**: Regression

**Goal**: INCREASE over time

**Implementation**:
```typescript
function computeAccuracyTrend(games: GameMetrics[]): number
```

---

## 🔍 Supporting Metrics

### Total Games Analyzed
- Count of games in analysis window
- Used for data quality assessment

### Active Mistake Patterns
- Patterns that occurred in last 30 days
- Indicates current focus areas

### Resolved Mistake Patterns
- Patterns with mastery > 0.8 OR absent 60+ days
- Measures long-term success

### Average Mistakes Per Game
- Total mistakes / total games
- General skill indicator

### Improvement Velocity
- Rate of change of accuracy (d/dt)
- Calculated via linear regression
- Positive = improving, negative = regressing

---

## 📈 Trend Indicators

### Is Improving
```typescript
isImproving = (improvementVelocity > 0.5) && (mistakeResolutionRate > 20)
```

### Is Regressing
```typescript
isRegressing = (improvementVelocity < -0.5) && (mistakeRecurrenceRate > 50)
```

### Is Stagnant
```typescript
isStagnant = !isImproving && !isRegressing
```

---

## 🗂️ Data Quality Assessment

```typescript
function assessDataQuality(gameCount, patternCount): DataQuality {
  if (gameCount < 5 || patternCount < 2) return 'insufficient';
  if (gameCount < 10 || patternCount < 3) return 'limited';
  if (gameCount < 25 || patternCount < 5) return 'sufficient';
  return 'excellent';
}
```

**Thresholds**:
- **Insufficient**: < 5 games OR < 2 patterns
- **Limited**: < 10 games OR < 3 patterns
- **Sufficient**: < 25 games OR < 5 patterns
- **Excellent**: ≥ 25 games AND ≥ 5 patterns

---

## 🔄 Signal Computation Flow

```
┌────────────────────────────────────┐
│  Fetch Player Data                 │
│  - TrainingGame (last 50)          │
│  - MistakeSignature (all)          │
│  - CoachingMemory                  │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Parse Game Metrics                │
│  - Extract accuracy                │
│  - Extract mistake types           │
│  - Extract timestamps              │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Compute Core Signals              │
│  - Mistake recurrence rate         │
│  - Mistake resolution rate         │
│  - Advice follow-through rate      │
│  - Tactical error delta            │
│  - Accuracy trend (EMA)            │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Compute Supporting Metrics        │
│  - Improvement velocity            │
│  - Active/resolved patterns        │
│  - Average mistakes per game       │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Determine Trend Indicators        │
│  - isImproving / isRegressing      │
│  - isStagnant                      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Assess Data Quality               │
│  - insufficient / limited          │
│  - sufficient / excellent          │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Return LearningQualitySignals     │
└────────────────────────────────────┘
```

---

## 🔌 API Exposure

### GET `/api/wall-e/metrics?userId=xxx&signals=true`

**Response**:
```json
{
  "success": true,
  "signals": {
    "userId": "user123",
    "computedAt": "2025-12-26T10:00:00Z",
    "mistakeRecurrenceRate": 35.5,
    "mistakeResolutionRate": 42.3,
    "adviceFollowThroughRate": 58.1,
    "tacticalErrorDelta": -1.2,
    "gameAccuracyTrend": 72.4,
    "totalGamesAnalyzed": 50,
    "activeMistakePatterns": 3,
    "resolvedMistakePatterns": 2,
    "avgMistakesPerGame": 4.2,
    "improvementVelocity": 0.8,
    "isImproving": true,
    "isRegressing": false,
    "isStagnant": false,
    "dataQuality": "excellent",
    "gamesInWindow": 50,
    "patternsTracked": 5
  }
}
```

### GET `/api/wall-e/metrics?userId=xxx&signals=true&persist=true`

Same as above, but also persists snapshot to `LearningMetric` table.

---

## 💾 Persistence

Signals are persisted as snapshots in `LearningMetric`:

```typescript
await prisma.learningMetric.create({
  data: {
    userId,
    sessionStart: computedAt,
    sessionEnd: computedAt,
    gameCount: totalGamesAnalyzed,
    mistakesIdentified: activeMistakePatterns,
    mistakesCorrected: resolvedMistakePatterns,
    insights: JSON.stringify([
      'Mistake recurrence: 35.5%',
      'Resolution rate: 42.3%',
      'Advice follow-through: 58.1%',
      'Accuracy trend: 72.4',
      'Status: IMPROVING',
    ]),
    progress: JSON.stringify({
      mistakeRecurrenceRate: 35.5,
      mistakeResolutionRate: 42.3,
      adviceFollowThroughRate: 58.1,
      tacticalErrorDelta: -1.2,
      gameAccuracyTrend: 72.4,
      improvementVelocity: 0.8,
      dataQuality: 'excellent',
    }),
  },
});
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('computeLearningSignals', () => {
  it('computes recurrence rate correctly', ...)
  it('detects improvement trend', ...)
  it('handles insufficient data gracefully', ...)
});
```

### Integration Tests
```typescript
describe('50-game simulation', () => {
  it('shows decreasing recurrence rate over time', ...)
  it('shows increasing resolution rate', ...)
});
```

### Manual Verification
1. Seed 50 games with intentional patterns
2. Compute signals at game 10, 25, 50
3. Verify:
   - Recurrence decreases
   - Resolution increases
   - Follow-through improves
   - Accuracy trend rises

---

## 📊 Example Signal Evolution

### Phase 1: Early Learning (Games 1-15)
```json
{
  "mistakeRecurrenceRate": 75.0,
  "mistakeResolutionRate": 10.0,
  "adviceFollowThroughRate": 30.0,
  "tacticalErrorDelta": 0.0,
  "gameAccuracyTrend": 55.2,
  "improvementVelocity": 0.1,
  "isImproving": false,
  "isStagnant": true
}
```

### Phase 2: Mid Learning (Games 16-35)
```json
{
  "mistakeRecurrenceRate": 45.0,
  "mistakeResolutionRate": 35.0,
  "adviceFollowThroughRate": 52.0,
  "tacticalErrorDelta": -0.8,
  "gameAccuracyTrend": 68.5,
  "improvementVelocity": 0.6,
  "isImproving": true,
  "isStagnant": false
}
```

### Phase 3: Advanced (Games 36-50)
```json
{
  "mistakeRecurrenceRate": 25.0,
  "mistakeResolutionRate": 60.0,
  "adviceFollowThroughRate": 70.0,
  "tacticalErrorDelta": -1.5,
  "gameAccuracyTrend": 78.3,
  "improvementVelocity": 0.9,
  "isImproving": true,
  "isRegressing": false
}
```

---

## 🔒 Guarantees

1. **No Hallucination**: All signals derived from stored data
2. **Computable**: No external dependencies required
3. **Monotonic**: Trends reflect actual changes in data
4. **Data-Gated**: Returns 'insufficient' if not enough data
5. **Auditable**: Every signal can be manually verified from DB

---

## 🚨 Alert Thresholds

### Warning Conditions
- Recurrence rate > 60% after 20+ games
- Resolution rate < 15% after 30+ games
- Follow-through rate < 25% after 20+ games
- Regression detected (isRegressing = true)

### Success Conditions
- Recurrence rate < 30%
- Resolution rate > 50%
- Follow-through rate > 60%
- Improvement velocity > 0.5

---

## 📝 Related Documentation

- [Wall-E v2 Pedagogy](./WALL_E_V2_PEDAGOGY.md)
- [Progression Metrics](./PROGRESSION_METRICS.md)
- [Learning Simulation Tests](../tests/learning-simulation.test.ts)

---

**Module**: `functions/lib/learningAudit.ts`  
**Exposed Via**: `/api/wall-e/metrics?signals=true`  
**Last Updated**: December 26, 2025
