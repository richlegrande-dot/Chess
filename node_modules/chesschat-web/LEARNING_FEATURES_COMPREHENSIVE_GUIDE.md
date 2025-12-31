# 🧠 Learning Features - Comprehensive System Guide

**Date:** December 30, 2025  
**Purpose:** Complete reference for all learning, personalization, and coaching features  
**Audience:** AI agents, developers, and system operators

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Learning Subsystems](#learning-subsystems)
4. [Database Schema](#database-schema)
5. [Data Flow & Lifecycle](#data-flow--lifecycle)
6. [Personalization Engine](#personalization-engine)
7. [Wall-E AI Coach](#wall-e-ai-coach)
8. [Browser-Based Learning (CPU Levels 7-8)](#browser-based-learning-cpu-levels-7-8)
9. [API Endpoints](#api-endpoints)
10. [Key Algorithms](#key-algorithms)
11. [Testing & Validation](#testing--validation)
12. [Operational Considerations](#operational-considerations)

---

## System Overview

The ChessChat learning system provides **multi-layered adaptive intelligence** that learns from player behavior, game history, and mistake patterns to deliver personalized coaching. The system operates across three distinct layers:

### Layer 1: Browser-Based Learning (localStorage)
- **Scope:** CPU opponent AI (levels 7-8)
- **Storage:** Browser localStorage (1-2MB)
- **Purpose:** AI learns winning positions, openings, and tactics from games
- **Persistence:** Per-device, survives page refreshes

### Layer 2: Server-Based Learning (PostgreSQL)
- **Scope:** Player coaching, game analysis, personalized insights
- **Storage:** PostgreSQL via Prisma (unlimited)
- **Purpose:** Long-term skill tracking, mistake pattern analysis, progress metrics
- **Persistence:** Cloud-based, cross-device

### Layer 3: Coaching Intelligence (Wall-E Engine)
- **Scope:** AI-powered chess coach
- **Implementation:** Self-contained (NO API keys required)
- **Purpose:** Personalized coaching based on player history (≥2 provable references per response)
- **Data Sources:** Knowledge base + learning history from Layer 2

---

## Architecture Components

```
┌────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)               │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ CoachingMode.tsx │  │ chessAI.ts       │  │ gameStore.ts │ │
│  │ (Game UI)        │  │ (Minimax/API)    │  │ (State Mgmt) │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ learningEngine.ts│  │ learningDatabase │  │ cpuTelemetry │ │
│  │ (CPU Learning)   │  │ (localStorage)   │  │ (Tracking)   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              ▼ HTTPS
┌────────────────────────────────────────────────────────────────┐
│           CLOUDFLARE PAGES FUNCTIONS (Serverless API)          │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ /api/chat        │  │ /api/analyze-game│  │ /api/wall-e/*│ │
│  │ (Wall-E Chat)    │  │ (Wall-E Analysis)│  │ (Learning)   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            shared/walleEngine.ts (Coach AI)              │  │
│  │  • Personalized coaching (≥2 history references)         │  │
│  │  • Game analysis with player insights                    │  │
│  │  • Progress tracking & pedagogical heuristics            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ▼ SQL
┌────────────────────────────────────────────────────────────────┐
│              POSTGRESQL (via Prisma Accelerate)                │
├────────────────────────────────────────────────────────────────┤
│  • PlayerProfile (skill ratings, play style, progress)         │
│  • TrainingGame (50-game rolling window)                       │
│  • MistakeSignature (recurring error patterns)                 │
│  • LearningMetric (session performance tracking)               │
│  • CoachingMemory (aggregated insights for Wall-E)             │
└────────────────────────────────────────────────────────────────┘
```

---

## Learning Subsystems

### 1. CPU Learning System (Browser-Based)

**Purpose:** Make CPU opponent (levels 7-8) smarter over time by learning from games.

**Location:** `src/lib/learningEngine.ts`, `src/lib/learningDatabase.ts`

**Features:**
- **Position Memory:** Stores up to 1,000 positions with win/loss outcomes
- **Opening Book Expansion:** Learns successful opening lines (first 6-8 moves)
- **Tactical Pattern Recognition:** Identifies recurring patterns (pins, forks, skewers)
- **Game Outcome Tracking:** Records all game results with metadata

**Storage Structure (localStorage):**
```typescript
{
  version: 1,
  positions: {
    "rnbqkbnr/pppppppp/...": {
      fen: string,
      evaluationBias: number,      // -100 to +100
      timesPlayed: number,
      wins: number,
      losses: number,
      draws: number,
      lastPlayed: timestamp,
      bestMoveFound: string        // SAN notation
    }
  },
  openings: {
    "e4,e5,Nf3,Nc6": {
      moves: string[],
      winRate: number,              // 0-1
      gamesPlayed: number,
      lastPlayed: timestamp
    }
  },
  gameHistory: [
    {
      id: string,
      date: timestamp,
      cpuLevel: number,
      result: 'win' | 'loss' | 'draw',
      moveCount: number,
      openingMoves: string[],
      criticalPositions: string[]   // FEN strings
    }
  ],
  tacticalPatterns: [
    {
      patternType: 'pin' | 'fork' | 'skewer' | ...,
      position: string,             // FEN
      move: { from, to, promotion },
      successRate: number,          // 0-1
      timesUsed: number
    }
  ],
  statistics: {
    totalGames: number,
    wins: number,
    losses: number,
    draws: number,
    lastUpdated: timestamp
  }
}
```

**Move Selection Priority (Levels 7-8):**
1. Check learned position (high confidence: 55%+ win rate level 7, 65%+ level 8)
2. Check learned opening lines
3. Check static opening book
4. Fall back to minimax AI

**Confidence Thresholds:**
- **Level 7:** Requires 55%+ win rate and ≥3 games played
- **Level 8:** Requires 65%+ win rate and ≥3 games played

**Visual Feedback:**
- Purple banner: "🧠 Learned Position" (appears for 3 seconds)
- Debug panel: Shows learning statistics

---

### 2. Player Profile & Skill Tracking (Server-Based)

**Purpose:** Track player skill progression, behavior patterns, and learning metrics over time.

**Location:** `prisma/schema.prisma` → `PlayerProfile` model

**Database Schema:**
```prisma
model PlayerProfile {
  id                 String   @id @default(cuid())
  userId             String   @unique
  
  // Skill ratings (JSON)
  skillRatings       String   @default("{}")
  
  // Learning metrics
  gamesPlayed        Int      @default(0)
  improvementRate    Float    @default(0.0)  // Points per 10 games
  strengthAreas      String   @default("[]") // JSON array
  weaknessAreas      String   @default("[]") // JSON array
  
  // Behavioral patterns
  playStyle          String   @default("balanced")  // aggressive | defensive | balanced | positional
  commonMistakes     String   @default("[]")
  favoriteOpenings   String   @default("[]")
  
  // Progress tracking
  ratingHistory      String   @default("[]")  // [{ date, rating }]
  milestones         String   @default("[]")  // [{ achievement, date }]
  behavioralPatterns String   @default("{}")
  
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

**Computed Metrics:**
- **Improvement Rate:** Points gained per 10 games (exponential moving average)
- **Play Style:** Derived from move tempo, piece activity, aggression metrics
- **Strength/Weakness Areas:** Tactical, positional, endgame, opening, time management

---

### 3. Training Game Window (50-Game Rolling Buffer)

**Purpose:** Maintain recent game history for pattern analysis without unbounded storage growth.

**Location:** `prisma/schema.prisma` → `TrainingGame` model

**Database Schema:**
```prisma
model TrainingGame {
  id        String   @id @default(cuid())
  userId    String
  gameIndex Int      // 0-49 (rolling window position)
  
  // Game data
  pgn       String   @default("")
  fen       String   // Current or final position
  moves     String   @default("[]")  // JSON array
  result    String   // win | loss | draw
  analysis  String   @default("{}")  // JSON: mistakes, missed opportunities
  metrics   String   @default("{}")  // JSON: accuracy, blunders, time usage
  timestamp DateTime @default(now())
  
  @@unique([userId, gameIndex])
  @@index([userId, timestamp])
}
```

**Rolling Window Logic:**
- New game replaces oldest game (circular buffer)
- `gameIndex = totalGames % 50`
- Always maintains up to 50 most recent games
- Automatic pruning prevents storage bloat

**Analysis Structure (JSON):**
```typescript
{
  mistakes: [
    {
      moveNumber: number,
      san: string,
      fen: string,
      evaluation: { before: number, after: number },
      bestMove: string,
      explanation: string,
      category: 'tactical' | 'positional' | 'endgame' | 'opening'
    }
  ],
  missedOpportunities: [...],
  strongMoves: [...]
}
```

**Metrics Structure (JSON):**
```typescript
{
  accuracy: number,         // 0-100
  blunders: number,
  mistakes: number,
  inaccuracies: number,
  avgMoveTime: number,      // seconds
  timePressureMoves: number,
  tacticalSuccess: number,  // 0-100
  positionalScore: number   // 0-100
}
```

---

### 4. Mistake Signature System

**Purpose:** Track recurring error patterns to provide targeted coaching.

**Location:** `prisma/schema.prisma` → `MistakeSignature` model

**Database Schema:**
```prisma
model MistakeSignature {
  id               String   @id @default(cuid())
  userId           String
  signatureKey     String   @unique  // e.g., "hanging_pieces", "back_rank_weakness"
  
  // Classification
  category         String   // tactical | positional | endgame | opening
  title            String   // "Leaving pieces undefended"
  description      String   // Detailed explanation
  
  // Pattern data (JSON)
  patternDetails   String   @default("{}")  // { triggers: [...], solutions: [...] }
  examplePositions String   @default("[]")  // [{ fen, move, explanation }]
  relatedConcepts  String   @default("[]")  // ["piece protection", "tactical awareness"]
  
  // Tracking
  occurrenceCount  Int      @default(1)
  lastOccurrence   DateTime @default(now())
  confidenceScore  Float    @default(0.5)   // 0-1: How confident we are this is a real pattern
  masteryScore     Float    @default(0.0)   // 0-1: Player's mastery of this concept
  
  @@unique([userId, category, title])
  @@index([userId, occurrenceCount])
}
```

**Example Signatures:**
| Key | Category | Title | Description |
|-----|----------|-------|-------------|
| hanging_pieces | tactical | Leaving pieces undefended | Regularly fails to notice undefended pieces |
| back_rank_weakness | tactical | Back rank mate threats | Doesn't secure king's back rank |
| premature_attack | positional | Attacking before development | Launches attacks without completing development |
| weak_pawn_structure | positional | Creating weak pawn structures | Creates isolated/doubled pawns unnecessarily |
| time_pressure_blunders | tactical | Blunders under time pressure | Makes tactical errors when clock is low |

**Detection Algorithm:**
1. Analyze each mistake in TrainingGame
2. Extract features: move category, position type, time remaining, piece involved
3. Compare with existing signatures (pattern matching)
4. If match found (similarity > 70%), increment occurrence count
5. If no match, create new signature with confidence=0.3
6. Increase confidence as pattern repeats (max 1.0 after 5+ occurrences)

---

### 5. Learning Metrics & Progress Tracking

**Purpose:** Compute progression signals from training window for coaching feedback.

**Location:** `functions/lib/learningProgress.ts`, `prisma/schema.prisma` → `LearningMetric` model

**Database Schema:**
```prisma
model LearningMetric {
  id                 String   @id @default(cuid())
  userId             String
  
  // Session info
  sessionStart       DateTime
  sessionEnd         DateTime
  gameCount          Int      @default(0)
  
  // Performance
  mistakesIdentified Int      @default(0)
  mistakesCorrected  Int      @default(0)
  totalMoves         Int      @default(0)
  
  // Insights (JSON)
  insights           String   @default("[]")  // [{ type, message, confidence }]
  progress           String   @default("{}")  // { improvementAreas: [], regressionAreas: [] }
  
  @@index([userId, sessionStart])
}
```

**Computed Progression Metrics:**
```typescript
interface ProgressionMetrics {
  confidenceScore: number;        // 0-100: EMA of accuracy + logistic clamp
  improvementVelocity: number;    // -100 to +100: Linear regression slope
  conceptStabilityScore: number;  // 0-100: Consistency in avoiding mistakes
  regressionRiskScore: number;    // 0-100: Recent pattern spike detection
  top3Patterns: TopMistakePattern[];
  gamesAnalyzed: number;
  lastUpdated: Date;
}
```

**Metrics Explained:**

1. **Confidence Score (0-100):**
   - Exponential moving average (EMA) of accuracy over last 10 games
   - Logistic clamp: `100 / (1 + e^(-(EMA - 50) / 10))`
   - Stabilizes extreme values, emphasizes trends

2. **Improvement Velocity (-100 to +100):**
   - Linear regression slope of accuracy series
   - Positive = improving, negative = declining
   - Normalized to -100/+100 range

3. **Concept Stability Score (0-100):**
   - Measures how consistently player avoids past mistakes
   - Compares recent mistake rate to historical baseline
   - High score = mastery, low score = still struggling

4. **Regression Risk Score (0-100):**
   - Detects recent spikes in mistake patterns
   - Compares last 5 games to previous 20 games
   - High score = warning of performance decline

---

### 6. Coaching Memory (Aggregated Insights)

**Purpose:** Rolling aggregate of coaching insights for Wall-E's long-term learning loop.

**Location:** `prisma/schema.prisma` → `CoachingMemory` model

**Database Schema:**
```prisma
model CoachingMemory {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  
  // Aggregated insights (JSON)
  openingTroubleSpots     String   @default("[]")  // Most problematic openings
  blunderTypes            String   @default("[]")  // tactical | positional | time-pressure
  timeTroublePatterns     String   @default("{}")  // When player struggles with time
  positionTypeWeaknesses  String   @default("[]")  // open | closed | tactical
  
  // Rolling windows (JSON)
  recentTakeaways         String   @default("[]")  // Last 10-20 coaching insights
  adviceIssued            String   @default("[]")  // Track advice to evaluate later
  
  // Performance trends (JSON)
  accuracyTrend           String   @default("[]")  // [{ date, accuracy }]
  improvementAreas        String   @default("[]")  // Areas showing improvement
  regressionAreas         String   @default("[]")  // Areas getting worse
  
  // Coaching effectiveness
  adviceFollowedCount     Int      @default(0)
  adviceIgnoredCount      Int      @default(0)
  successfulInterventions Int      @default(0)     // Advice → improvement correlation
  
  lastUpdated             DateTime @default(now())
}
```

**Update Frequency:** After every game analysis or coaching session

**Retention Policy:**
- `recentTakeaways`: Last 20 items
- `adviceIssued`: Last 50 items
- `accuracyTrend`: Last 100 data points
- Automatic pruning on update

---

## Data Flow & Lifecycle

### Game Completion → Learning Update Flow

```
1. Game Ends (CoachingMode.tsx)
   ├─→ Save to localStorage (CPU learning)
   │   └─→ learningDatabase.recordGame()
   │       ├─→ Update position evaluations
   │       ├─→ Update opening book
   │       └─→ Prune old data (keep 1000 positions)
   │
   └─→ POST /api/analyze-game (Wall-E analysis)
       └─→ walleEngine.analyzeGame()
           ├─→ Fetch PlayerProfile
           ├─→ Fetch recent TrainingGames (last 10)
           ├─→ Fetch top MistakeSignatures (top 5)
           ├─→ Analyze game with coachEngine
           ├─→ Build personalized references (≥2 required)
           ├─→ Save to TrainingGame table (rolling window)
           ├─→ Update MistakeSignatures (increment occurrences)
           ├─→ Update PlayerProfile (games played, improvement rate)
           ├─→ Update CoachingMemory (aggregates)
           └─→ Return analysis + historyEvidence

2. Player Requests Coaching
   └─→ POST /api/chat (Wall-E chat)
       └─→ walleEngine.chat()
           ├─→ Fetch learning history
           ├─→ Build PersonalizationContext
           ├─→ Build personalized references (≥2 required)
           ├─→ Generate coaching response
           ├─→ Validate personalization (≥2 check)
           ├─→ Track advice issued (CoachingMemory)
           └─→ Return response + historyEvidence
```

---

## Personalization Engine

**Location:** `shared/personalizedReferences.ts`

**Purpose:** Enforce that EVERY coaching response includes ≥2 provable personalized references to stored history.

### Core Algorithm

```typescript
function buildPersonalizedReferences(
  context: PersonalizationContext
): { references: PersonalizedReference[], evidence: HistoryEvidence } {
  
  const refs: PersonalizedReference[] = [];
  
  // 1. Extract references from last 10 games
  if (context.recentGames.length >= 2) {
    const gameRef = buildGameReferences(context.recentGames);
    refs.push(...gameRef);
  }
  
  // 2. Extract references from top 3 mistake patterns
  if (context.topMistakePatterns.length >= 1) {
    const patternRef = buildPatternReferences(context.topMistakePatterns);
    refs.push(...patternRef);
  }
  
  // 3. Build evidence object
  const evidence = {
    lastGamesUsed: context.recentGames.length,
    gameIdsUsed: context.recentGames.map(g => g.id),
    topMistakePatternsUsed: context.topMistakePatterns.map(p => p.key),
    personalizedReferenceCount: refs.length,
    insufficientHistory: refs.length < 2,
    insufficientReason: refs.length < 2 
      ? `only ${context.recentGames.length} game(s), ${context.topMistakePatterns.length} patterns`
      : undefined
  };
  
  return { references: refs, evidence };
}
```

### Reference Types

**1. Last 10 Games References:**
```typescript
{
  kind: 'last10games',
  text: "In 7 of your last 10 games, you struggled with back-rank tactics.",
  source: {
    gameIds: ['game-1', 'game-2', ...]
  }
}
```

**2. Top Mistake Pattern References:**
```typescript
{
  kind: 'topMistakePattern',
  text: "Your #1 recurring mistake is leaving pieces en prise (15 times).",
  source: {
    patternKey: 'hanging_pieces'
  }
}
```

### Validation Rules

```typescript
function validatePersonalization(
  response: string,
  evidence: HistoryEvidence
): boolean {
  
  // HARD REQUIREMENT: ≥2 personalized references
  if (evidence.personalizedReferenceCount < 2 && !evidence.insufficientHistory) {
    throw new Error('PERSONALIZATION FAILURE: <2 references but sufficient history');
  }
  
  // Insufficient history must be explicitly stated
  if (evidence.insufficientHistory) {
    const hasDisclaimer = response.includes('I currently have') || 
                          response.includes('only') ||
                          response.includes('Play more games');
    if (!hasDisclaimer) {
      throw new Error('Missing insufficient history disclaimer');
    }
  }
  
  return true;
}
```

### Response Augmentation

```typescript
function augmentWithPersonalization(
  baseResponse: string,
  references: PersonalizedReference[],
  evidence: HistoryEvidence
): string {
  
  if (evidence.insufficientHistory) {
    return baseResponse + `\n\n*Note: ${evidence.insufficientReason}. Play more games for personalized advice!*`;
  }
  
  const formattedRefs = formatReferences(references);
  return baseResponse + `\n\n**Based on your history:**\n${formattedRefs}`;
}
```

---

## Wall-E AI Coach

**Location:** `shared/walleEngine.ts`, `shared/coachEngine.ts`, `shared/coachHeuristicsV2.ts`

**Purpose:** Self-contained AI chess coach (NO API keys required) that provides personalized coaching based on player history.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WallEEngine                              │
│  • Main entry point for chat() and analyzeGame()           │
│  • Fetches learning history from database                  │
│  • Enforces ≥2 personalized references                     │
│  • Tracks advice issued for future evaluation              │
└─────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 PersonalizationEngine                       │
│  • buildPersonalizedReferences()                           │
│  • validatePersonalization()                               │
│  • augmentWithPersonalization()                            │
└─────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   CoachEngine                               │
│  • analyzePosition() - Static position evaluation          │
│  • suggestMove() - Tactical/strategic advice               │
│  • explainConcept() - Teaching fundamentals                │
└─────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              CoachHeuristicsV2 (Pedagogical)                │
│  • selectCoachingStrategy() - Adaptive coaching approach   │
│  • applyTacticalStrategicProgression() - Skill-based focus │
│  • correctForLossAversionBias() - Psychological adjustment │
│  • composeAdvice() - Structured response generation        │
└─────────────────────────────────────────────────────────────┘
```

### Key Functions

**1. chat() - Personalized Chat**
```typescript
async chat(
  context: WallEContext,
  userMessage: string,
  gameContext?: any
): Promise<WallEChatResponse> {
  
  // 1. Fetch learning history
  const history = await this.fetchLearningHistory(prisma, userId);
  
  // 2. Build personalization context
  const personalizationCtx = this.buildPersonalizationContext(history);
  
  // 3. Build personalized references (≥2 required)
  const { references, evidence } = buildPersonalizedReferences(personalizationCtx);
  
  // 4. Select coaching strategy (heuristics V2)
  const strategy = selectCoachingStrategy({
    improvementRate: history.profile.improvementRate,
    gamesPlayed: history.profile.gamesPlayed,
    topMistakes: history.topMistakes
  });
  
  // 5. Generate response
  const response = await coachEngine.chat(userMessage, strategy);
  
  // 6. Augment with personalization
  const finalResponse = augmentWithPersonalization(response, references, evidence);
  
  // 7. Validate (throws if <2 refs)
  validatePersonalization(finalResponse, evidence);
  
  // 8. Track advice issued
  await trackAdviceIssued(prisma, userId, finalResponse);
  
  return {
    response: finalResponse,
    confidenceScore: strategy.confidence,
    sourcesUsed: ['knowledge_base', 'learning_history'],
    learningApplied: true,
    historyEvidence: evidence,
    personalizedReferences: references
  };
}
```

**2. analyzeGame() - Game Analysis**
```typescript
async analyzeGame(
  context: WallEContext,
  pgn: string,
  moves: any[],
  metadata: any
): Promise<WallEAnalysisResponse> {
  
  // 1-3. Same as chat() (fetch history, build context, build references)
  
  // 4. Analyze game with CoachEngine
  const analysis = await coachEngine.analyzeGame(pgn, moves);
  
  // 5. Extract mistake patterns
  const mistakes = extractMistakePatterns(analysis);
  
  // 6. Save to TrainingGame (rolling window)
  await saveTrainingGame(prisma, userId, { pgn, analysis, mistakes });
  
  // 7. Update MistakeSignatures
  await updateMistakeSignatures(prisma, userId, mistakes);
  
  // 8. Update PlayerProfile
  await updatePlayerProfile(prisma, userId, analysis.metrics);
  
  // 9. Augment with personalization
  const personalizedInsights = augmentWithPersonalization(
    analysis.insights,
    references,
    evidence
  );
  
  return {
    analysis: analysis.summary,
    recommendations: analysis.recommendations,
    personalizedInsights,
    sourcesUsed: ['static_analysis', 'learning_history'],
    confidenceScore: 85,
    historyEvidence: evidence,
    personalizedReferences: references
  };
}
```

### Pedagogical Heuristics (V2)

**Location:** `shared/coachHeuristicsV2.ts`

**Coaching Strategies:**
```typescript
type CoachingStrategy = 
  | 'beginner-fundamentals'      // 0-10 games: Opening principles, piece values
  | 'pattern-recognition'        // 10-30 games: Tactical motifs, common mistakes
  | 'strategic-concepts'         // 30-100 games: Pawn structures, positional play
  | 'advanced-refinement'        // 100+ games: Specific weaknesses, advanced tactics
  | 'maintenance';               // High skill: Fine-tuning, specific scenarios
```

**Selection Logic:**
```typescript
function selectCoachingStrategy(context: HeuristicsContext): Strategy {
  const { gamesPlayed, improvementRate, topMistakes } = context;
  
  if (gamesPlayed < 10) return 'beginner-fundamentals';
  if (gamesPlayed < 30) return 'pattern-recognition';
  if (gamesPlayed < 100) return 'strategic-concepts';
  
  // Advanced players: Focus on specific weaknesses
  const hasPersistentMistakes = topMistakes.some(m => m.occurrenceCount > 10);
  if (hasPersistentMistakes) return 'advanced-refinement';
  
  return 'maintenance';
}
```

**Tactical/Strategic Progression:**
```typescript
function applyTacticalStrategicProgression(
  advice: string,
  skillLevel: number
): string {
  
  // Skill 0-30: 80% tactics, 20% strategy
  // Skill 30-60: 60% tactics, 40% strategy
  // Skill 60+: 40% tactics, 60% strategy
  
  const tacticalWeight = Math.max(0.4, 0.8 - (skillLevel / 150));
  const strategicWeight = 1 - tacticalWeight;
  
  return composeBalancedAdvice(advice, tacticalWeight, strategicWeight);
}
```

---

## Browser-Based Learning (CPU Levels 7-8)

### Visual Indicators

**1. Learned Position Banner:**
```
┌────────────────────────────────────────┐
│ 🧠 CPU used learned position!          │
│ (Position seen 12 times, 75% win rate) │
└────────────────────────────────────────┘
```
- Appears for 3 seconds
- Purple gradient background
- Position: Top-left of board

**2. Learning Statistics Panel (Debug Panel):**
```
🧠 Learning Statistics
──────────────────────
Total Games: 127
Wins: 68 (53.5%)
Losses: 42 (33.1%)
Draws: 17 (13.4%)

Level 7 Stats:
  Games: 85
  Win Rate: 51.8%

Level 8 Stats:
  Games: 42
  Win Rate: 57.1%

Learned Positions: 847 / 1000
Opening Lines: 23
Tactical Patterns: 156
```

### Learning Curve

**Early Games (1-10):**
- CPU explores different openings randomly
- Builds position database with low confidence
- Mostly uses standard minimax AI
- ~5% learned moves

**Mid-Term (10-50 games):**
- Starts recognizing successful patterns
- Uses learned openings 30-40% of time
- Builds tactical pattern library
- ~25% learned moves

**Long-Term (50+ games):**
- Strong position memory established
- Preferred opening repertoire
- High-confidence learned moves (65%+)
- ~50% learned moves in familiar positions

### Storage Management

**Auto-Pruning Logic:**
```typescript
function prunePositions(positions: LearnedPosition[]): void {
  if (Object.keys(positions).length > MAX_POSITIONS) {
    // Sort by value: winRate * timesPlayed * recency
    const sorted = Object.entries(positions)
      .map(([fen, pos]) => ({
        fen,
        value: pos.winRate * pos.timesPlayed * (1 / (Date.now() - pos.lastPlayed))
      }))
      .sort((a, b) => b.value - a.value);
    
    // Keep top 800, discard bottom 200
    const keep = sorted.slice(0, 800).map(x => x.fen);
    
    // Update positions object
    for (const fen in positions) {
      if (!keep.includes(fen)) {
        delete positions[fen];
      }
    }
  }
}
```

---

## API Endpoints

### Learning Data Endpoints

**1. POST /api/wall-e/games**
- **Purpose:** Save completed game for analysis
- **Auth:** Required (user token)
- **Body:**
  ```json
  {
    "pgn": "string",
    "moves": ["e4", "e5", ...],
    "result": "win" | "loss" | "draw",
    "metadata": { cpuLevel, duration, ... }
  }
  ```
- **Response:**
  ```json
  {
    "gameId": "string",
    "analysisId": "string",
    "mistakesIdentified": 3,
    "newPatternsDetected": 1
  }
  ```

**2. GET /api/wall-e/profile/:userId**
- **Purpose:** Fetch player profile and learning stats
- **Auth:** Required
- **Response:**
  ```json
  {
    "profile": { ...PlayerProfile },
    "statistics": {
      "gamesPlayed": 127,
      "improvementRate": 2.3,
      "currentSkillLevel": 1450,
      "topStrengths": ["tactics", "endgame"],
      "topWeaknesses": ["time management", "opening theory"]
    },
    "recentProgress": {
      "confidenceScore": 72,
      "improvementVelocity": 5.2,
      "conceptStabilityScore": 68,
      "regressionRiskScore": 12
    }
  }
  ```

**3. GET /api/wall-e/mistakes/:userId**
- **Purpose:** Fetch top mistake patterns
- **Auth:** Required
- **Query:** `?limit=10`
- **Response:**
  ```json
  {
    "mistakes": [
      {
        "id": "string",
        "signatureKey": "hanging_pieces",
        "category": "tactical",
        "title": "Leaving pieces undefended",
        "occurrenceCount": 15,
        "masteryScore": 0.3,
        "examples": [...]
      }
    ],
    "totalPatterns": 23
  }
  ```

**4. GET /api/wall-e/games/:userId**
- **Purpose:** Fetch recent training games
- **Auth:** Required
- **Query:** `?limit=10&offset=0`
- **Response:**
  ```json
  {
    "games": [
      {
        "id": "string",
        "pgn": "string",
        "result": "win",
        "metrics": { accuracy: 87, blunders: 1, ... },
        "timestamp": "2025-12-30T12:00:00Z"
      }
    ],
    "total": 127,
    "hasMore": true
  }
  ```

**5. GET /api/wall-e/insights/:userId**
- **Purpose:** Get learning insights and recommendations
- **Auth:** Required
- **Response:**
  ```json
  {
    "insights": [
      {
        "type": "improvement",
        "message": "Your tactical accuracy improved 12% in last 10 games",
        "confidence": 0.85
      },
      {
        "type": "warning",
        "message": "Time pressure mistakes increased in recent games",
        "confidence": 0.72
      }
    ],
    "recommendations": [
      "Focus on securing pieces before attacking",
      "Practice bullet games to improve time management"
    ]
  }
  ```

---

## Key Algorithms

### 1. Exponential Moving Average (EMA) for Accuracy

```typescript
function computeEMA(series: number[], alpha: number = 0.2): number {
  let ema = series[0];
  for (let i = 1; i < series.length; i++) {
    ema = alpha * series[i] + (1 - alpha) * ema;
  }
  return ema;
}
```

**Usage:** Smooth accuracy trends, reduce noise from outlier games.

### 2. Linear Regression for Improvement Velocity

```typescript
function linearRegression(points: { x: number, y: number }[]): { slope: number, intercept: number } {
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}
```

**Usage:** Detect improvement or regression trends over time.

### 3. Pattern Similarity Matching

```typescript
function computeSimilarity(mistake1: Mistake, mistake2: Mistake): number {
  // Feature extraction
  const features1 = extractFeatures(mistake1);
  const features2 = extractFeatures(mistake2);
  
  // Cosine similarity
  const dotProduct = features1.reduce((sum, f, i) => sum + f * features2[i], 0);
  const magnitude1 = Math.sqrt(features1.reduce((sum, f) => sum + f * f, 0));
  const magnitude2 = Math.sqrt(features2.reduce((sum, f) => sum + f * f, 0));
  
  return dotProduct / (magnitude1 * magnitude2);
}
```

**Usage:** Group similar mistakes into patterns.

### 4. Logistic Clamp for Confidence Score

```typescript
function logisticClamp(value: number, midpoint: number = 50, steepness: number = 10): number {
  return 100 / (1 + Math.exp(-(value - midpoint) / steepness));
}
```

**Usage:** Smooth extreme values, emphasize middle ranges.

---

## Testing & Validation

### Unit Tests

**1. Personalization Tests** (`personalizedReferences.test.ts`)
- ✅ Builds references from 10+ games
- ✅ Builds references from 3+ patterns
- ✅ Handles insufficient history (<2 games)
- ✅ Validates ≥2 reference requirement
- ✅ Augments responses correctly
- ✅ Formats references for display

**2. Learning Progress Tests** (`learningProgress.test.ts`)
- ✅ Computes confidence score from accuracy series
- ✅ Calculates improvement velocity (slope)
- ✅ Measures concept stability
- ✅ Detects regression risk
- ✅ Identifies top 3 patterns

**3. Database Tests** (`learningDatabase.test.ts`)
- ✅ Saves game outcomes to localStorage
- ✅ Prunes old positions (max 1000)
- ✅ Updates opening book
- ✅ Records tactical patterns
- ✅ Computes win rates correctly

### Integration Tests

**1. Learning Simulation** (`learning-simulation.test.ts`)
- Simulates 100 games with random outcomes
- Verifies position learning over time
- Checks opening book expansion
- Validates auto-pruning logic

**2. Coaching Flow** (`learningIntegration.test.ts`)
- Tests full flow: game → analysis → coaching
- Verifies database updates (TrainingGame, MistakeSignature)
- Validates personalization in responses
- Checks CoachingMemory aggregation

### Seed Data

**Test Database Seed** (`scripts/seed-learning-data.ts`)
- Creates 10 sample games
- Generates 3 mistake patterns (hanging_pieces, back_rank, time_pressure)
- Populates PlayerProfile with realistic data
- **Usage:** `npm run seed-learning`

---

## Operational Considerations

### Storage Requirements

**Browser localStorage:**
- **Per User:** 1-2 MB
- **Growth Rate:** ~10 KB per game
- **Auto-Pruning:** At 1000 positions
- **Backup:** No automatic backup (device-specific)

**PostgreSQL Database:**
- **Per User:** 50-100 KB (50 games + metadata)
- **Growth Rate:** Fixed (rolling window)
- **Retention:** Unlimited (cloud-backed)
- **Backup:** Automatic (Prisma Accelerate)

### Performance Impact

**Frontend (Browser Learning):**
- **Learning Check:** <1ms per move
- **localStorage Read:** ~5ms
- **Position Save:** ~10ms
- **Total Impact:** Negligible (<1% of move time)

**Backend (Wall-E):**
- **Database Query:** 20-50ms (Prisma Accelerate)
- **Personalization:** 5-10ms
- **Response Generation:** 50-100ms
- **Total API Latency:** 100-200ms

### Privacy & Data Security

**Browser Data:**
- **Storage:** Client-side only (localStorage)
- **Scope:** Per-device, per-browser
- **Clearing:** User can clear browser data
- **Sharing:** Not shared across devices

**Server Data:**
- **Storage:** Encrypted at rest (PostgreSQL)
- **Access:** User-scoped (userId required)
- **Sharing:** No cross-user access
- **Deletion:** Full GDPR compliance (delete on request)

### Monitoring & Observability

**Key Metrics to Track:**
1. Average personalized references per response
2. Insufficient history rate (%)
3. Pattern detection accuracy
4. Coaching effectiveness (advice followed rate)
5. Database query latency (p50, p95, p99)
6. localStorage usage per user

**Logging Events:**
- Game saved (localStorage + DB)
- Pattern detected (new signature created)
- Advice issued (CoachingMemory tracked)
- Learning history fetched (cache hit/miss)
- Insufficient history warning

---

## Future Enhancements

### Planned Features

1. **Spaced Repetition System**
   - Track when mistakes last occurred
   - Surface forgotten patterns periodically
   - Adaptive review scheduling

2. **Opening Repertoire Builder**
   - Analyze opening choices over time
   - Suggest repertoire gaps
   - Generate opening study plans

3. **Performance Prediction**
   - Predict future rating based on trends
   - Estimate games needed to reach goal
   - Identify fastest improvement areas

4. **Social Learning**
   - Compare patterns with similar-rated players
   - Anonymized aggregate insights
   - Peer benchmarking

5. **Advanced Pattern Detection**
   - Time-series analysis (when mistakes occur)
   - Position-type clustering (weak in closed positions?)
   - Opponent-style adaptation (struggles vs aggressive play?)

---

## Quick Reference Card

| Feature | Layer | Storage | Key Files |
|---------|-------|---------|-----------|
| CPU Learning (Levels 7-8) | Browser | localStorage (1-2MB) | `learningEngine.ts`, `learningDatabase.ts` |
| Player Profile | Server | PostgreSQL | `PlayerProfile` model, `walleEngine.ts` |
| Training Games | Server | PostgreSQL (50-game window) | `TrainingGame` model |
| Mistake Patterns | Server | PostgreSQL | `MistakeSignature` model, `learningProgress.ts` |
| Coaching Memory | Server | PostgreSQL | `CoachingMemory` model |
| Personalization | Server | Runtime (computed) | `personalizedReferences.ts` |
| Wall-E Coach | Server | Stateless (queries DB) | `walleEngine.ts`, `coachEngine.ts` |

---

## Contact & Support

**Documentation:**
- [Learning System Overview](LEARNING_SYSTEM.md)
- [Wall-E Implementation Guide](WALL_E_IMPLEMENTATION.md)
- [Agent Context Summary](AGENT_CONTEXT_SUMMARY.md)

**Key Contacts:**
- Frontend Learning: `src/lib/learningEngine.ts`
- Backend Learning: `functions/lib/walleEngine.ts`
- Database Schema: `prisma/schema.prisma`

**Support Channels:**
- GitHub Issues: Technical bugs
- Discord: Community discussions
- Email: Support inquiries

---

**Version:** 2.0  
**Last Updated:** December 30, 2025  
**Status:** ✅ Production Ready
