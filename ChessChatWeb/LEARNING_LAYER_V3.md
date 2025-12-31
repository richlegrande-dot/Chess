# Learning Layer V3 - Production-Grade Closed-Loop Learning System

**Version:** 3.0  
**Date:** December 30, 2025  
**Status:** SPECIFICATION & IMPLEMENTATION GUIDE

---

## Executive Summary

This document specifies the **Learning Layer V3** architecture that transforms ChessChat from a tracking system into a true closed-loop learning system. The system:

1. **Learns from outcomes**: Tracks mistake patterns and coaching effectiveness
2. **Adapts coaching**: Changes future advice based on what worked
3. **Measures improvement**: Quantifies concept mastery and tracks progress
4. **Remains auditable**: Every decision is traceable and evidence-based

### Key Changes from Current System

| Current State | Learning Layer V3 |
|--------------|-------------------|
| Flat metrics (blunders/mistakes/inaccuracies) | Concept-based mastery model with prerequisites |
| Heuristic mistake detection | Stockfish eval delta + rule-based concept tagging |
| Wall-E gives advice (no tracking) | AdviceIntervention tracking with outcome measurement |
| Local CPU "learning" influences moves | Server-side learning only, local state is UX-only |
| No closed loop | Coaching adapts based on measured effectiveness |

---

## PART 1: CORE LEARNING MODEL - CONCEPT-BASED MASTERY

### 1.1 Concept Taxonomy (Static)

Chess concepts are organized hierarchically with difficulty levels and prerequisites.

**Concept Categories:**
- **Tactical** (hanging pieces, forks, pins, skewers, discovered attacks, back rank mates, etc.)
- **Positional** (king safety, pawn structure, piece activity, space advantage, weak squares)
- **Opening** (opening principles, development, center control, castling timing)
- **Endgame** (basic checkmates, pawn endgames, rook endgames, opposition)
- **Strategic** (planning, prophylaxis, piece coordination, initiative)

**Concept Definition Structure:**
```typescript
interface ChessConcept {
  id: string;              // e.g., "hanging_pieces"
  name: string;            // "Preventing Hanging Pieces"
  category: ConceptCategory;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[]; // concept IDs that should be mastered first
  detectionRules: string;  // JSON blob describing how to detect in games
}
```

**Example Concepts:**
```json
[
  {
    "id": "hanging_pieces",
    "name": "Preventing Hanging Pieces",
    "category": "tactical",
    "description": "Ensuring all pieces remain protected",
    "difficulty": 1,
    "prerequisites": [],
    "detectionRules": "{\"type\":\"piece_en_prise\",\"captureValue\":\">0\"}"
  },
  {
    "id": "back_rank_mate",
    "name": "Back Rank Mate Recognition",
    "category": "tactical",
    "description": "Recognizing and preventing back rank mate threats",
    "difficulty": 2,
    "prerequisites": ["hanging_pieces"],
    "detectionRules": "{\"type\":\"mate_threat\",\"pattern\":\"back_rank\"}"
  },
  {
    "id": "tactical_forks",
    "name": "Fork Tactics",
    "category": "tactical",
    "description": "Creating and avoiding fork opportunities",
    "difficulty": 2,
    "prerequisites": ["hanging_pieces"],
    "detectionRules": "{\"type\":\"double_attack\",\"pieceTypes\":[\"knight\",\"queen\"]}"
  },
  {
    "id": "king_safety_opening",
    "name": "King Safety in Opening",
    "category": "opening",
    "description": "Castling at the right time and avoiding king exposure",
    "difficulty": 2,
    "prerequisites": ["opening_principles"],
    "detectionRules": "{\"type\":\"king_exposure\",\"phase\":\"opening\"}"
  }
]
```

**Storage:** Concepts can be stored as JSON in the codebase (`concepts.json`) or as a `ChessConcept` DB table if dynamic editing is needed. For MVP, static JSON is sufficient.

---

### 1.2 UserConceptState (Per-User, Per-Concept)

Tracks each user's mastery of each concept using a Bayesian-inspired scoring model.

**Schema:**
```prisma
model UserConceptState {
  id                  String   @id @default(uuid())
  userId              String
  conceptId           String   // e.g., "hanging_pieces"
  
  // Mastery tracking
  mastery             Float    @default(0.5)  // 0.0 to 1.0
  confidence          Float    @default(0.0)  // 0.0 to 1.0 (amount of data)
  
  // Performance metrics (Exponential Moving Average)
  mistakeRateEMA      Float    @default(0.0)  // mistakes per game
  successRateEMA      Float    @default(0.0)  // successful avoidances per game
  
  // Spaced repetition
  spacedRepDueAt      DateTime @default(now())
  lastSeenAt          DateTime?
  lastPracticedAt     DateTime?
  
  // Evidence trail (last N game IDs or mistake IDs)
  evidenceRefs        Json     @default("[]") // Array of {gameId, moveNum, delta}
  
  // Metadata
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@unique([userId, conceptId])
  @@index([userId, mastery])
  @@index([userId, spacedRepDueAt])
  @@map("user_concept_states")
}
```

**Mastery Calculation:**
- **Initial state:** mastery = 0.5, confidence = 0.0
- **After mistake:** mastery decreases (weighted by confidence), confidence increases
- **After success:** mastery increases (weighted by confidence), confidence increases
- **Formula:**
  ```typescript
  function updateMastery(
    currentMastery: number,
    currentConfidence: number,
    outcome: 'mistake' | 'success'
  ): { mastery: number; confidence: number } {
    const learningRate = 1 - currentConfidence; // Less confident = faster update
    const delta = outcome === 'mistake' ? -0.15 : +0.10;
    const adjustedDelta = delta * learningRate;
    
    const newMastery = Math.max(0, Math.min(1, currentMastery + adjustedDelta));
    const newConfidence = Math.min(1, currentConfidence + 0.05);
    
    return { mastery: newMastery, confidence: newConfidence };
  }
  ```

**Spaced Repetition Due Date:**
- Based on mastery level and last practice date
- Low mastery: due sooner (3 days)
- Medium mastery: due in 1 week
- High mastery: due in 2-4 weeks
- Formula:
  ```typescript
  function calculateDueDate(mastery: number, lastPracticedAt: Date): Date {
    const baseDays = mastery < 0.5 ? 3 : mastery < 0.75 ? 7 : 14;
    const jitter = Math.random() * baseDays * 0.2; // ±20% variation
    return new Date(lastPracticedAt.getTime() + (baseDays + jitter) * 86400000);
  }
  ```

---

### 1.3 AdviceIntervention (Coaching Action Tracking)

Every coaching action is logged and evaluated for effectiveness.

**Schema:**
```prisma
model AdviceIntervention {
  id                  String   @id @default(uuid())
  userId              String
  gameId              String?  // Game where advice was given
  
  // What was advised
  conceptsTargeted    Json     // Array of concept IDs
  adviceText          String   // Summary of advice (not full response)
  messageHash         String   // Hash for deduplication
  
  // Expected outcome
  expectedBehavior    String   // "avoid hanging pieces in next 5 games"
  measurementCriteria Json     // What to measure and thresholds
  
  // Evaluation window
  evaluationGames     Int      @default(5)  // Next N games to evaluate
  gamesEvaluated      Int      @default(0)  // Progress counter
  
  // Outcomes (filled after evaluation)
  outcome             String?  // "success" | "partial" | "failure" | "unknown"
  measuredDelta       Float?   // Numeric change in target metric
  followUpRequired    Boolean  @default(false)
  
  // Metadata
  createdAt           DateTime @default(now())
  evaluatedAt         DateTime?
  
  @@index([userId, createdAt])
  @@index([userId, outcome])
  @@map("advice_interventions")
}
```

**Lifecycle:**
1. **Creation:** When Wall-E gives advice, create intervention record
2. **Tracking:** Mark next N games as part of evaluation window
3. **Measurement:** After N games, compute delta in target metric
4. **Outcome:** Mark as success/partial/failure based on thresholds
5. **Adaptation:** Use outcome to adjust coaching style

**Example:**
```json
{
  "id": "intervention_123",
  "userId": "user_456",
  "gameId": "game_789",
  "conceptsTargeted": ["hanging_pieces", "tactical_awareness"],
  "adviceText": "Focus on checking all pieces before moving",
  "messageHash": "abc123...",
  "expectedBehavior": "Reduce hanging piece mistakes by 50%",
  "measurementCriteria": {
    "metric": "hanging_pieces_per_game",
    "baseline": 2.5,
    "target": 1.25,
    "threshold": 1.5
  },
  "evaluationGames": 5,
  "gamesEvaluated": 5,
  "outcome": "success",
  "measuredDelta": -1.3,
  "followUpRequired": false,
  "createdAt": "2025-12-30T10:00:00Z",
  "evaluatedAt": "2025-12-30T15:30:00Z"
}
```

---

### 1.4 PracticePlan (Weekly Plan Generator)

Generated plans guide players on what to focus on.

**Schema:**
```prisma
model PracticePlan {
  id                String   @id @default(uuid())
  userId            String
  
  // Plan window
  planStart         DateTime
  planEnd           DateTime
  
  // Target concepts (top 3-5)
  targetConcepts    Json     // Array of {conceptId, priority, reason}
  
  // Suggested exercises
  suggestedDrills   Json     // Array of drill descriptions/IDs
  
  // Status
  completed         Boolean  @default(false)
  adherenceScore    Float?   // 0.0-1.0 based on actual practice
  
  // Metadata
  createdAt         DateTime @default(now())
  
  @@index([userId, planStart])
  @@map("practice_plans")
}
```

**Generation Logic:**
1. Query all `UserConceptState` for user
2. Find concepts where `spacedRepDueAt <= now()`
3. Sort by: mastery (lower first), due date (overdue first), difficulty (easier first)
4. Select top 3-5 concepts
5. Generate drill suggestions based on concept type
6. Store plan with 7-day window

**Example Plan:**
```json
{
  "id": "plan_123",
  "userId": "user_456",
  "planStart": "2025-12-30",
  "planEnd": "2026-01-06",
  "targetConcepts": [
    {
      "conceptId": "hanging_pieces",
      "priority": 1,
      "reason": "Mastery 0.42, last mistake 2 days ago",
      "currentMastery": 0.42
    },
    {
      "conceptId": "back_rank_mate",
      "priority": 2,
      "reason": "Due for review, mastery 0.68",
      "currentMastery": 0.68
    },
    {
      "conceptId": "king_safety_opening",
      "priority": 3,
      "reason": "Prerequisite for advanced opening concepts",
      "currentMastery": 0.55
    }
  ],
  "suggestedDrills": [
    "Play 3 games focusing on double-checking piece protection",
    "Review games where you lost material",
    "Practice puzzle set: tactical awareness level 2"
  ]
}
```

---

## PART 2: STOCKFISH-BASED GAME ANALYSIS

### 2.1 Analysis Pipeline

**Goal:** Convert PGN into concept-tagged mistake events using Stockfish evaluations.

**Flow:**
1. Parse PGN into move list
2. Replay each move and get Stockfish eval before/after
3. Compute centipawn loss (eval delta)
4. Classify mistakes:
   - **Blunder:** delta <= -300cp
   - **Mistake:** delta <= -150cp
   - **Inaccuracy:** delta <= -50cp
5. Tag each mistake with concept(s) using rule-based detectors
6. Store in `GameAnalysis` with structured mistake objects

**Stockfish Integration:**
```typescript
async function analyzePosition(fen: string, depth: number = 18): Promise<{
  score: number;      // centipawns
  mate: number | null; // mate in N moves (null if no mate)
  bestMove: string;   // UCI notation
}> {
  const stockfish = getStockfishEngine();
  const result = await stockfish.getBestMove(fen, depth);
  return {
    score: result.evaluation,
    mate: result.mate,
    bestMove: result.move
  };
}
```

**Mistake Classification:**
```typescript
interface MistakeEvent {
  moveNumber: number;
  side: 'white' | 'black';
  moveUCI: string;
  moveSAN: string;
  fen: string;
  
  // Evaluation
  evalBefore: number;
  evalAfter: number;
  delta: number;
  
  // Classification
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  
  // Concept tagging
  concepts: string[];  // Array of concept IDs
  
  // Context
  phase: 'opening' | 'middlegame' | 'endgame';
  moveType: string;    // 'capture', 'check', 'castle', 'quiet', etc.
}
```

---

### 2.2 Concept Detection Rules

**Rule-Based Detectors** (cheap, fast, deterministic):

#### Hanging Piece Detector
```typescript
function detectHangingPiece(chess: Chess, move: string): boolean {
  // Apply move
  chess.move(move);
  
  // Check if any of our pieces are unprotected and attacked
  const pieces = chess.board().flat().filter(p => p && p.color === chess.turn());
  
  for (const piece of pieces) {
    const square = getSquare(piece);
    const attackers = chess.attackers(!chess.turn(), square);
    const defenders = chess.attackers(chess.turn(), square);
    
    if (attackers.length > 0 && defenders.length === 0) {
      return true; // Piece is hanging
    }
  }
  
  chess.undo();
  return false;
}
```

#### Back Rank Mate Detector
```typescript
function detectBackRankMate(chess: Chess, move: string): boolean {
  chess.move(move);
  
  // Check if king is on back rank with blocked escape squares
  const king = findKing(chess.turn());
  const backRank = chess.turn() === 'w' ? 1 : 8;
  
  if (king.rank === backRank) {
    const escapeSquares = getAdjacentSquares(king);
    const blockedSquares = escapeSquares.filter(sq => 
      !chess.get(sq) || chess.get(sq).color === chess.turn()
    );
    
    if (blockedSquares.length >= 2) {
      // Check for mate threat from opponent's rook/queen on file
      const threats = chess.attackers(!chess.turn(), king.square);
      if (threats.some(t => ['r', 'q'].includes(chess.get(t).type))) {
        chess.undo();
        return true;
      }
    }
  }
  
  chess.undo();
  return false;
}
```

#### Fork Detector
```typescript
function detectFork(chess: Chess, move: string): boolean {
  chess.move(move);
  
  // Find opponent's move that attacks 2+ valuable pieces
  const opponentMoves = chess.moves({ verbose: true });
  
  for (const oppMove of opponentMoves) {
    const targetSquare = oppMove.to;
    const attackedPieces = chess.attackers(chess.turn(), targetSquare);
    
    if (attackedPieces.length >= 2) {
      const values = attackedPieces.map(sq => getPieceValue(chess.get(sq)));
      if (values.reduce((a, b) => a + b, 0) >= 6) {
        chess.undo();
        return true; // Fork opportunity for opponent
      }
    }
  }
  
  chess.undo();
  return false;
}
```

#### King Safety Detector
```typescript
function detectKingSafetyIssue(chess: Chess, move: string): boolean {
  chess.move(move);
  
  const king = findKing(chess.turn());
  const phase = getGamePhase(chess);
  
  if (phase === 'opening' || phase === 'middlegame') {
    // Check if king is exposed
    const attackers = chess.attackers(!chess.turn(), king.square);
    const pawnShield = getPawnShield(chess, king);
    
    if (attackers.length >= 2 || pawnShield < 2) {
      chess.undo();
      return true;
    }
  }
  
  chess.undo();
  return false;
}
```

**Concept Mapping:**
```typescript
function tagMistakeWithConcepts(mistake: MistakeEvent, chess: Chess): string[] {
  const concepts: string[] = [];
  
  // Run all detectors
  if (detectHangingPiece(chess, mistake.moveUCI)) {
    concepts.push('hanging_pieces');
  }
  
  if (detectBackRankMate(chess, mistake.moveUCI)) {
    concepts.push('back_rank_mate');
  }
  
  if (detectFork(chess, mistake.moveUCI)) {
    concepts.push('tactical_forks');
  }
  
  if (detectKingSafetyIssue(chess, mistake.moveUCI)) {
    concepts.push('king_safety_opening');
  }
  
  // If no specific concept detected, use generic tags
  if (concepts.length === 0) {
    if (mistake.severity === 'blunder') {
      concepts.push('tactical_awareness');
    } else if (mistake.phase === 'opening') {
      concepts.push('opening_principles');
    } else if (mistake.phase === 'endgame') {
      concepts.push('endgame_technique');
    } else {
      concepts.push('positional_play');
    }
  }
  
  return concepts;
}
```

---

### 2.3 Updating GameAnalysis Schema

**Enhanced GameAnalysis:**
```prisma
model GameAnalysis {
  id                String     @id @default(uuid())
  gameId            String     @unique
  status            String     @default("pending")
  
  // Stockfish evaluation timeline
  evaluations       Json?      // Array of {moveNum, fen, eval, bestMove}
  
  // Mistake events (concept-tagged)
  mistakes          Json?      // Array of MistakeEvent objects
  
  // Aggregate metrics
  avgCentipawnLoss  Float?
  accuracyScore     Float?
  
  // Concept summary
  conceptsEncountered Json?    // Array of {conceptId, count}
  
  // Metadata
  analyzedAt        DateTime?
  analysisDuration  Int?
  error             String?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  
  game              GameRecord @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("game_analyses")
}
```

---

## PART 3: CLOSED-LOOP LEARNING

### 3.1 Learning Update Cycle (After Each Game)

**Trigger:** POST `/api/learning/ingest-game`

**Process:**
1. **Analyze game** with Stockfish (get mistake events)
2. **Extract concepts** from mistakes
3. **Update UserConceptState** for each concept:
   - If concept appeared in mistake: decrement mastery
   - If concept was handled well (no mistakes): increment mastery
   - Update confidence, EMAs, evidence refs
4. **Update spaced repetition** due dates
5. **Check pending interventions**: If any interventions are in evaluation window, update progress
6. **Return summary** of concepts updated

**Implementation:**
```typescript
async function ingestGame(
  userId: string,
  gameId: string,
  mistakes: MistakeEvent[]
): Promise<{
  conceptsUpdated: string[];
  summary: { [conceptId: string]: { mastery: number; delta: number } };
}> {
  const conceptCounts: { [id: string]: { mistakes: number; total: number } } = {};
  
  // Count concept occurrences
  for (const mistake of mistakes) {
    for (const conceptId of mistake.concepts) {
      if (!conceptCounts[conceptId]) {
        conceptCounts[conceptId] = { mistakes: 1, total: 1 };
      } else {
        conceptCounts[conceptId].mistakes += 1;
        conceptCounts[conceptId].total += 1;
      }
    }
  }
  
  // Also count "successful" concepts (those tested but no mistake)
  // (This requires position analysis to detect "opportunities" - simplified for MVP)
  
  const summary: any = {};
  
  // Update each concept state
  for (const [conceptId, counts] of Object.entries(conceptCounts)) {
    const state = await prisma.userConceptState.findUnique({
      where: { userId_conceptId: { userId, conceptId } }
    });
    
    if (!state) {
      // Create new state
      await prisma.userConceptState.create({
        data: {
          userId,
          conceptId,
          mastery: 0.5,
          confidence: 0.0,
          mistakeRateEMA: counts.mistakes,
          successRateEMA: 0,
          spacedRepDueAt: new Date(Date.now() + 3 * 86400000), // 3 days
          evidenceRefs: JSON.stringify([{ gameId, mistakes: counts.mistakes }])
        }
      });
      
      summary[conceptId] = { mastery: 0.5, delta: 0 };
    } else {
      // Update existing state
      const outcome = counts.mistakes > 0 ? 'mistake' : 'success';
      const { mastery, confidence } = updateMastery(
        state.mastery,
        state.confidence,
        outcome
      );
      
      const newMistakeEMA = state.mistakeRateEMA * 0.8 + counts.mistakes * 0.2;
      const newDueAt = calculateDueDate(mastery, new Date());
      
      // Update evidence refs (keep last 10)
      const evidence = JSON.parse(state.evidenceRefs);
      evidence.push({ gameId, mistakes: counts.mistakes, moveNums: [] });
      const newEvidence = evidence.slice(-10);
      
      await prisma.userConceptState.update({
        where: { id: state.id },
        data: {
          mastery,
          confidence,
          mistakeRateEMA: newMistakeEMA,
          spacedRepDueAt: newDueAt,
          lastSeenAt: new Date(),
          evidenceRefs: JSON.stringify(newEvidence),
          updatedAt: new Date()
        }
      });
      
      summary[conceptId] = { mastery, delta: mastery - state.mastery };
    }
  }
  
  return {
    conceptsUpdated: Object.keys(conceptCounts),
    summary
  };
}
```

---

### 3.2 Coaching Selection (Using Concept States)

**Goal:** Wall-E coaching targets the top 3 "due now" concepts with evidence-based advice.

**Selection Logic:**
```typescript
async function selectCoachingTargets(userId: string): Promise<{
  concepts: Array<{
    conceptId: string;
    name: string;
    mastery: number;
    reason: string;
    evidence: any[];
  }>;
}> {
  // Get all concept states
  const states = await prisma.userConceptState.findMany({
    where: { userId },
    orderBy: [
      { spacedRepDueAt: 'asc' },
      { mastery: 'asc' }
    ]
  });
  
  // Filter to "due now" concepts
  const now = new Date();
  const dueStates = states.filter(s => s.spacedRepDueAt <= now);
  
  // If not enough due, include lowest mastery
  const candidates = dueStates.length >= 3 
    ? dueStates 
    : [...dueStates, ...states.filter(s => !dueStates.includes(s))].slice(0, 5);
  
  // Sort by priority: mastery (lower first), due date (overdue first)
  candidates.sort((a, b) => {
    const aOverdue = Math.max(0, now.getTime() - a.spacedRepDueAt.getTime());
    const bOverdue = Math.max(0, now.getTime() - b.spacedRepDueAt.getTime());
    
    if (aOverdue > 0 && bOverdue === 0) return -1;
    if (bOverdue > 0 && aOverdue === 0) return 1;
    
    return a.mastery - b.mastery;
  });
  
  // Take top 3
  const targets = candidates.slice(0, 3);
  
  // Load concept definitions
  const concepts = loadConceptTaxonomy();
  
  return {
    concepts: targets.map(state => {
      const concept = concepts.find(c => c.id === state.conceptId);
      const evidence = JSON.parse(state.evidenceRefs);
      
      return {
        conceptId: state.conceptId,
        name: concept?.name || state.conceptId,
        mastery: state.mastery,
        reason: generateReason(state, evidence),
        evidence: evidence.slice(-3) // Last 3 pieces of evidence
      };
    })
  };
}

function generateReason(state: any, evidence: any[]): string {
  const daysSince = (Date.now() - new Date(state.lastSeenAt).getTime()) / 86400000;
  const recentMistakes = evidence.slice(-3).reduce((sum, e) => sum + e.mistakes, 0);
  
  if (recentMistakes >= 3) {
    return `High mistake frequency: ${recentMistakes} in last 3 games`;
  } else if (state.mastery < 0.5) {
    return `Low mastery (${(state.mastery * 100).toFixed(0)}%) - needs focused practice`;
  } else if (daysSince < 2) {
    return `Recent mistake detected ${daysSince.toFixed(0)} days ago`;
  } else {
    return `Due for review - last seen ${daysSince.toFixed(0)} days ago`;
  }
}
```

**Wall-E Integration:**
```typescript
async function generateCoachingInsight(userId: string, gameId: string): Promise<string> {
  const targets = await selectCoachingTargets(userId);
  
  if (targets.concepts.length === 0) {
    return "No specific areas identified yet. Keep playing!";
  }
  
  const primary = targets.concepts[0];
  
  // Retrieve specific game evidence
  const game = await prisma.gameRecord.findUnique({
    where: { id: primary.evidence[0].gameId },
    include: { GameAnalysis: true }
  });
  
  const mistakes = JSON.parse(game.GameAnalysis.mistakes || '[]');
  const relevantMistake = mistakes.find((m: any) => 
    m.concepts.includes(primary.conceptId)
  );
  
  // Build prompt for Wall-E
  const prompt = `
You are coaching a chess player who needs to improve on: ${primary.name}.

Current mastery: ${(primary.mastery * 100).toFixed(0)}%
Reason: ${primary.reason}

Recent example:
- Game: ${game.id}
- Move ${relevantMistake.moveNumber}: ${relevantMistake.moveSAN}
- Evaluation drop: ${relevantMistake.delta} centipawns
- Issue: ${relevantMistake.concepts.join(', ')}

Provide concise, actionable coaching advice (2-3 sentences) focusing on this concept.
Reference the specific mistake and suggest a practice exercise.
`;
  
  // Call Wall-E
  const response = await callWallE(prompt);
  
  // Create intervention record
  await prisma.adviceIntervention.create({
    data: {
      userId,
      gameId,
      conceptsTargeted: JSON.stringify([primary.conceptId]),
      adviceText: response.slice(0, 200),
      messageHash: hashString(response),
      expectedBehavior: `Reduce ${primary.name} mistakes`,
      measurementCriteria: JSON.stringify({
        metric: `${primary.conceptId}_per_game`,
        baseline: primary.evidence.slice(-5).reduce((sum, e) => sum + e.mistakes, 0) / 5,
        target: 0.5
      }),
      evaluationGames: 5
    }
  });
  
  return response;
}
```

---

### 3.3 Intervention Evaluation (Measuring Effectiveness)

**Trigger:** After each game, check if any interventions are in evaluation window

**Process:**
```typescript
async function evaluateInterventions(userId: string, gameId: string): Promise<void> {
  // Find active interventions for this user
  const interventions = await prisma.adviceIntervention.findMany({
    where: {
      userId,
      gamesEvaluated: { lt: prisma.adviceIntervention.fields.evaluationGames },
      outcome: null
    }
  });
  
  for (const intervention of interventions) {
    // Increment games evaluated
    const newCount = intervention.gamesEvaluated + 1;
    
    if (newCount >= intervention.evaluationGames) {
      // Evaluation window complete - measure outcome
      const criteria = JSON.parse(intervention.measurementCriteria);
      const concepts = JSON.parse(intervention.conceptsTargeted);
      
      // Get games in evaluation window
      const games = await prisma.trainingGame.findMany({
        where: {
          userId,
          createdAt: { gte: intervention.createdAt }
        },
        take: intervention.evaluationGames,
        orderBy: { createdAt: 'asc' },
        include: { GameAnalysis: true }
      });
      
      // Compute actual mistake rate
      let totalMistakes = 0;
      for (const game of games) {
        if (!game.GameAnalysis?.mistakes) continue;
        
        const mistakes = JSON.parse(game.GameAnalysis.mistakes);
        totalMistakes += mistakes.filter((m: any) => 
          m.concepts.some((c: string) => concepts.includes(c))
        ).length;
      }
      
      const actualRate = totalMistakes / games.length;
      const delta = criteria.baseline - actualRate;
      
      // Determine outcome
      let outcome: string;
      if (actualRate <= criteria.target) {
        outcome = 'success';
      } else if (delta > 0) {
        outcome = 'partial';
      } else {
        outcome = 'failure';
      }
      
      // Update intervention
      await prisma.adviceIntervention.update({
        where: { id: intervention.id },
        data: {
          gamesEvaluated: newCount,
          outcome,
          measuredDelta: delta,
          followUpRequired: outcome === 'failure',
          evaluatedAt: new Date()
        }
      });
      
      // Log result
      console.log(
        `[Learning] Intervention ${intervention.id}: ${outcome} ` +
        `(delta: ${delta.toFixed(2)}, rate: ${actualRate.toFixed(2)})`
      );
      
      // If failure, trigger follow-up strategy
      if (outcome === 'failure') {
        await createFollowUpIntervention(userId, concepts, criteria);
      }
    } else {
      // Still in evaluation window
      await prisma.adviceIntervention.update({
        where: { id: intervention.id },
        data: { gamesEvaluated: newCount }
      });
    }
  }
}

async function createFollowUpIntervention(
  userId: string,
  concepts: string[],
  criteria: any
): Promise<void> {
  // Create a new intervention with adjusted strategy
  // e.g., simpler exercises, more repetition, different explanation style
  
  await prisma.adviceIntervention.create({
    data: {
      userId,
      conceptsTargeted: JSON.stringify(concepts),
      adviceText: 'Follow-up coaching with simplified approach',
      messageHash: hashString(`followup_${Date.now()}`),
      expectedBehavior: `Further reduce ${concepts[0]} mistakes`,
      measurementCriteria: JSON.stringify({
        ...criteria,
        target: criteria.target * 1.5 // More lenient target
      }),
      evaluationGames: 5
    }
  });
  
  console.log(`[Learning] Created follow-up intervention for concepts: ${concepts.join(', ')}`);
}
```

---

## PART 4: REMOVE LOCAL CPU LEARNING

### 4.1 Current Local Learning Issues

**Problems:**
- `learningIntegration.ts` uses localStorage-based signature engine
- CPU levels 7-8 have "teaching mode" that biases move selection
- This creates inconsistent behavior across devices
- Not auditable or measurable

**Solution:**
- **Keep:** localStorage for UX (recent games cache, preferences)
- **Remove:** Any localStorage influence on move selection
- **Move:** All learning logic to server-side (Postgres)

### 4.2 Changes Required

**1. Deprecate `learningIntegration.ts`**
- Mark functions as deprecated
- Replace calls with server-based learning API
- Remove `getTeachingOpportunities` from CoachingMode.tsx

**2. Update CoachingMode.tsx**
- Remove conditional logic for levels 7-8 "learning mode"
- Use Stockfish worker API consistently for all levels
- Learning context comes from server, not browser

**3. Stockfish Worker API**
- CPU strength is ONLY determined by Stockfish depth/time
- No move biasing based on user patterns
- Learning Layer influences coaching, not engine moves

**4. Wall-E Coaching**
- All personalization comes from `UserConceptState` queries
- No localStorage reads for coaching context
- Evidence references must be DB records (gameId + moveNum)

---

## PART 5: API ENDPOINTS

### 5.1 POST /api/learning/ingest-game

**Purpose:** Analyze game and update concept states

**Request:**
```typescript
{
  gameId: string;
  userId: string;
  pgn: string;
  metadata?: {
    mode: 'vs-cpu' | 'coaching';
    cpuLevel?: number;
    playerColor: 'white' | 'black';
  };
}
```

**Response:**
```typescript
{
  requestId: string;
  gameId: string;
  analysisId: string;
  conceptsUpdated: string[];
  summary: {
    [conceptId: string]: {
      mastery: number;
      delta: number;
      mistakeCount: number;
    };
  };
  nextDueConcepts: string[];
}
```

**Implementation:**
```typescript
app.post('/api/learning/ingest-game', async (req, res) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  try {
    const { gameId, userId, pgn, metadata } = req.body;
    
    // 1. Analyze game with Stockfish
    const analysis = await analyzeGameWithStockfish(pgn, gameId);
    
    // 2. Update concept states
    const result = await ingestGame(userId, gameId, analysis.mistakes);
    
    // 3. Evaluate pending interventions
    await evaluateInterventions(userId, gameId);
    
    // 4. Get next due concepts
    const dueConcepts = await prisma.userConceptState.findMany({
      where: {
        userId,
        spacedRepDueAt: { lte: new Date() }
      },
      select: { conceptId: true },
      take: 5
    });
    
    // 5. Log
    await logWorkerCall(env, {
      endpoint: '/api/learning/ingest-game',
      method: 'POST',
      success: true,
      latencyMs: Date.now() - startTime,
      mode: metadata?.mode || 'unknown',
      engine: 'stockfish',
      requestJson: { gameId, userId },
      responseJson: { conceptsUpdated: result.conceptsUpdated }
    });
    
    res.json({
      requestId,
      gameId,
      analysisId: analysis.id,
      conceptsUpdated: result.conceptsUpdated,
      summary: result.summary,
      nextDueConcepts: dueConcepts.map(c => c.conceptId)
    });
    
  } catch (error) {
    console.error('[Learning] Ingest error:', error);
    res.status(500).json({ error: 'Analysis failed', requestId });
  }
});
```

---

### 5.2 GET /api/learning/profile

**Purpose:** Get player's learning profile

**Query Params:**
- `userId` (required)

**Response:**
```typescript
{
  userId: string;
  overview: {
    gamesPlayed: number;
    totalConcepts: number;
    masteredConcepts: number;
    needsWorkConcepts: number;
  };
  topWeaknesses: Array<{
    conceptId: string;
    name: string;
    mastery: number;
    recentMistakes: number;
  }>;
  topStrengths: Array<{
    conceptId: string;
    name: string;
    mastery: number;
  }>;
  conceptStates: Array<{
    conceptId: string;
    name: string;
    category: string;
    mastery: number;
    confidence: number;
    dueDate: string;
    lastSeen: string;
  }>;
  recentInterventions: Array<{
    id: string;
    conceptsTargeted: string[];
    outcome: string;
    createdAt: string;
  }>;
}
```

---

### 5.3 GET /api/learning/plan

**Purpose:** Get practice plan for time window

**Query Params:**
- `userId` (required)
- `window` (default: '7d')

**Response:**
```typescript
{
  plan: {
    id: string;
    planStart: string;
    planEnd: string;
    targetConcepts: Array<{
      conceptId: string;
      name: string;
      priority: number;
      reason: string;
      currentMastery: number;
    }>;
    suggestedDrills: string[];
  };
  rationale: string;
}
```

---

### 5.4 POST /api/learning/feedback

**Purpose:** Record user feedback on advice

**Request:**
```typescript
{
  interventionId: string;
  feedback: 'helpful' | 'not_helpful' | 'completed_drill';
  notes?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 5.5 POST /api/walle/postgame

**Purpose:** Generate coaching insights using concept states

**Request:**
```typescript
{
  userId: string;
  gameId: string;
  includeAdvice: boolean;
}
```

**Response:**
```typescript
{
  insight: string;
  targetConcepts: string[];
  interventionId?: string;
  evidence: Array<{
    gameId: string;
    moveNum: number;
    description: string;
  }>;
}
```

---

## PART 6: TESTING & VERIFICATION

### 6.1 Unit Tests

**Concept Update Math:**
```typescript
describe('updateMastery', () => {
  it('decreases mastery on mistake', () => {
    const result = updateMastery(0.6, 0.4, 'mistake');
    expect(result.mastery).toBeLessThan(0.6);
    expect(result.confidence).toBeGreaterThan(0.4);
  });
  
  it('increases mastery on success', () => {
    const result = updateMastery(0.6, 0.4, 'success');
    expect(result.mastery).toBeGreaterThan(0.6);
    expect(result.confidence).toBeGreaterThan(0.4);
  });
  
  it('updates faster when confidence is low', () => {
    const lowConf = updateMastery(0.5, 0.1, 'mistake');
    const highConf = updateMastery(0.5, 0.9, 'mistake');
    
    const lowDelta = Math.abs(0.5 - lowConf.mastery);
    const highDelta = Math.abs(0.5 - highConf.mastery);
    
    expect(lowDelta).toBeGreaterThan(highDelta);
  });
});
```

**Spaced Repetition:**
```typescript
describe('calculateDueDate', () => {
  it('sets shorter interval for low mastery', () => {
    const low = calculateDueDate(0.3, new Date());
    const high = calculateDueDate(0.9, new Date());
    
    expect(low.getTime()).toBeLessThan(high.getTime());
  });
});
```

**Concept Detection:**
```typescript
describe('detectHangingPiece', () => {
  it('detects unprotected piece', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    
    const result = detectHangingPiece(chess, 'f6'); // Hangs e5 pawn
    expect(result).toBe(true);
  });
});
```

---

### 6.2 Integration Tests

**Full Learning Cycle:**
```typescript
describe('Learning Cycle Integration', () => {
  it('ingests games and updates concept mastery', async () => {
    const userId = 'test_user_123';
    
    // Create user and baseline state
    await prisma.userConceptState.create({
      data: {
        userId,
        conceptId: 'hanging_pieces',
        mastery: 0.6,
        confidence: 0.5
      }
    });
    
    // Simulate game with hanging piece mistakes
    const game = createTestGame({
      mistakes: [
        { conceptIds: ['hanging_pieces'], delta: -400 },
        { conceptIds: ['hanging_pieces'], delta: -350 }
      ]
    });
    
    // Ingest
    await ingestGame(userId, game.id, game.mistakes);
    
    // Check mastery decreased
    const updated = await prisma.userConceptState.findUnique({
      where: { userId_conceptId: { userId, conceptId: 'hanging_pieces' } }
    });
    
    expect(updated.mastery).toBeLessThan(0.6);
    expect(updated.confidence).toBeGreaterThan(0.5);
  });
  
  it('creates and evaluates interventions', async () => {
    const userId = 'test_user_456';
    
    // Create intervention
    const intervention = await prisma.adviceIntervention.create({
      data: {
        userId,
        conceptsTargeted: JSON.stringify(['hanging_pieces']),
        adviceText: 'Check all pieces before moving',
        messageHash: 'test_123',
        expectedBehavior: 'Reduce hanging pieces',
        measurementCriteria: JSON.stringify({
          metric: 'hanging_pieces_per_game',
          baseline: 2.0,
          target: 1.0
        }),
        evaluationGames: 3
      }
    });
    
    // Simulate 3 games with improvement
    for (let i = 0; i < 3; i++) {
      const game = createTestGame({
        mistakes: [{ conceptIds: ['hanging_pieces'], delta: -200 }] // Fewer mistakes
      });
      await evaluateInterventions(userId, game.id);
    }
    
    // Check outcome
    const updated = await prisma.adviceIntervention.findUnique({
      where: { id: intervention.id }
    });
    
    expect(updated.outcome).toBe('success');
    expect(updated.measuredDelta).toBeGreaterThan(0);
  });
});
```

---

### 6.3 Deterministic Test Fixtures

**Known PGN with Expected Mistakes:**
```typescript
const TEST_GAMES = {
  hangingPiece: {
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7',
    expectedMistakes: [
      { moveNum: 6, concepts: ['hanging_pieces', 'tactical_awareness'], severity: 'blunder' }
    ]
  },
  backRankMate: {
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5',
    expectedMistakes: []
  }
};

describe('Fixture Tests', () => {
  it('detects hanging piece in Scholar\'s Mate defense', async () => {
    const analysis = await analyzeGameWithStockfish(TEST_GAMES.hangingPiece.pgn, 'test_game_1');
    
    const mistakes = JSON.parse(analysis.mistakes);
    expect(mistakes.length).toBe(1);
    expect(mistakes[0].concepts).toContain('hanging_pieces');
  });
});
```

---

## PART 7: OPERATIONAL OBSERVABILITY

### 7.1 Health Endpoint

**GET /api/admin/learning-health**

```typescript
{
  status: 'healthy' | 'degraded' | 'down';
  database: {
    connected: boolean;
    responseTimeMs: number;
  };
  learning: {
    totalUsers: number;
    totalGames: number;
    totalConceptStates: number;
    lastIngestTimestamp: string;
    recentIngests: number; // Last 1 hour
  };
  interventions: {
    active: number;
    completed: number;
    successRate: number;
  };
}
```

---

### 7.2 Dashboard Queries

**Top Concepts Across Users (Anonymized):**
```sql
SELECT 
  conceptId,
  COUNT(DISTINCT userId) as userCount,
  AVG(mastery) as avgMastery,
  AVG(mistakeRateEMA) as avgMistakeRate
FROM user_concept_states
GROUP BY conceptId
ORDER BY userCount DESC
LIMIT 10;
```

**Advice Success Rate:**
```sql
SELECT 
  outcome,
  COUNT(*) as count,
  AVG(measuredDelta) as avgDelta
FROM advice_interventions
WHERE outcome IS NOT NULL
GROUP BY outcome;
```

**Average Eval Loss Trend:**
```sql
SELECT 
  DATE(createdAt) as date,
  AVG(avgCentipawnLoss) as avgLoss
FROM game_analyses
WHERE analyzedAt IS NOT NULL
GROUP BY DATE(createdAt)
ORDER BY date DESC
LIMIT 30;
```

---

### 7.3 Learning Event Log

**New Table:**
```prisma
model LearningEvent {
  id          String   @id @default(uuid())
  ts          DateTime @default(now())
  userId      String?
  eventType   String   // GAME_INGESTED | CONCEPT_UPDATED | ADVICE_ISSUED | ADVICE_EVALUATED
  payload     Json     // Event-specific data (bounded size)
  
  @@index([ts(sort: Desc)])
  @@index([userId, ts])
  @@map("learning_events")
}
```

**Usage:**
```typescript
await prisma.learningEvent.create({
  data: {
    userId,
    eventType: 'CONCEPT_UPDATED',
    payload: {
      conceptId: 'hanging_pieces',
      oldMastery: 0.6,
      newMastery: 0.52,
      delta: -0.08,
      gameId: 'game_123'
    }
  }
});
```

---

## MIGRATION PLAN

### Phase 1: Schema + Core Learning (Week 1)
1. Add new tables: `UserConceptState`, `AdviceIntervention`, `PracticePlan`, `LearningEvent`
2. Create migrations
3. Implement concept update logic
4. Implement Stockfish analysis pipeline
5. Deploy to staging

### Phase 2: API Endpoints (Week 2)
1. POST `/api/learning/ingest-game`
2. GET `/api/learning/profile`
3. GET `/api/learning/plan`
4. POST `/api/learning/feedback`
5. Update POST `/api/walle/postgame` to use concept states
6. Add tests

### Phase 3: Client Integration (Week 3)
1. Update CoachingMode.tsx to call new endpoints
2. Remove local learning integration (levels 7-8 special handling)
3. Update Wall-E coaching UI to show concept targets
4. Add practice plan UI

### Phase 4: Deprecation & Cleanup (Week 4)
1. Mark old tables as deprecated (`MistakeSignature` logic moved to concepts)
2. Keep `PlayerProfile`, `TrainingGame`, `LearningMetric` for compatibility
3. Create adapters if needed
4. Full regression testing

---

## SUCCESS CRITERIA

### Must Demonstrate True Learning:
- [ ] Concept mastery values change after games
- [ ] Spaced repetition due dates change based on mastery
- [ ] Coaching targets change based on concept states
- [ ] Intervention outcomes are measured and stored
- [ ] Advice adapts when interventions fail (follow-up created)

### System Properties:
- [ ] All learning is server-side (Postgres)
- [ ] All decisions are auditable (evidence refs, event log)
- [ ] No local learning influences move selection
- [ ] Stockfish is the only engine for all CPU levels

### Operational Requirements:
- [ ] Health endpoint reports learning system status
- [ ] Event log captures all learning actions
- [ ] Dashboard queries provide insight into system behavior
- [ ] Tests validate concept updates and intervention evaluation

---

## APPENDIX A: CONCEPT TAXONOMY (FULL LIST)

```json
{
  "concepts": [
    {
      "id": "hanging_pieces",
      "name": "Preventing Hanging Pieces",
      "category": "tactical",
      "difficulty": 1,
      "prerequisites": [],
      "description": "Ensuring all pieces remain protected"
    },
    {
      "id": "tactical_awareness",
      "name": "Tactical Awareness",
      "category": "tactical",
      "difficulty": 2,
      "prerequisites": ["hanging_pieces"],
      "description": "Spotting immediate tactical threats"
    },
    {
      "id": "back_rank_mate",
      "name": "Back Rank Mate Recognition",
      "category": "tactical",
      "difficulty": 2,
      "prerequisites": ["hanging_pieces"],
      "description": "Recognizing and preventing back rank mate threats"
    },
    {
      "id": "tactical_forks",
      "name": "Fork Tactics",
      "category": "tactical",
      "difficulty": 2,
      "prerequisites": ["hanging_pieces"],
      "description": "Creating and avoiding fork opportunities"
    },
    {
      "id": "pins_skewers",
      "name": "Pins and Skewers",
      "category": "tactical",
      "difficulty": 3,
      "prerequisites": ["tactical_awareness"],
      "description": "Using and defending against pins and skewers"
    },
    {
      "id": "discovered_attacks",
      "name": "Discovered Attacks",
      "category": "tactical",
      "difficulty": 3,
      "prerequisites": ["tactical_awareness"],
      "description": "Recognizing discovered attack opportunities"
    },
    {
      "id": "opening_principles",
      "name": "Opening Principles",
      "category": "opening",
      "difficulty": 1,
      "prerequisites": [],
      "description": "Control center, develop pieces, castle early"
    },
    {
      "id": "king_safety_opening",
      "name": "King Safety in Opening",
      "category": "opening",
      "difficulty": 2,
      "prerequisites": ["opening_principles"],
      "description": "Castling timing and avoiding king exposure"
    },
    {
      "id": "opening_traps",
      "name": "Opening Traps",
      "category": "opening",
      "difficulty": 3,
      "prerequisites": ["tactical_awareness", "opening_principles"],
      "description": "Recognizing and avoiding common opening traps"
    },
    {
      "id": "pawn_structure",
      "name": "Pawn Structure",
      "category": "positional",
      "difficulty": 3,
      "prerequisites": ["opening_principles"],
      "description": "Understanding pawn chains, islands, and weaknesses"
    },
    {
      "id": "piece_activity",
      "name": "Piece Activity",
      "category": "positional",
      "difficulty": 3,
      "prerequisites": ["opening_principles"],
      "description": "Maximizing piece mobility and coordination"
    },
    {
      "id": "space_advantage",
      "name": "Space Advantage",
      "category": "positional",
      "difficulty": 4,
      "prerequisites": ["pawn_structure", "piece_activity"],
      "description": "Gaining and exploiting space advantage"
    },
    {
      "id": "weak_squares",
      "name": "Weak Squares",
      "category": "positional",
      "difficulty": 4,
      "prerequisites": ["pawn_structure"],
      "description": "Identifying and exploiting weak squares"
    },
    {
      "id": "basic_checkmates",
      "name": "Basic Checkmates",
      "category": "endgame",
      "difficulty": 1,
      "prerequisites": [],
      "description": "K+Q vs K, K+R vs K, K+2R vs K"
    },
    {
      "id": "pawn_endgames",
      "name": "Pawn Endgames",
      "category": "endgame",
      "difficulty": 3,
      "prerequisites": ["basic_checkmates"],
      "description": "Opposition, key squares, pawn races"
    },
    {
      "id": "rook_endgames",
      "name": "Rook Endgames",
      "category": "endgame",
      "difficulty": 4,
      "prerequisites": ["pawn_endgames"],
      "description": "Lucena, Philidor, rook vs pawn"
    },
    {
      "id": "planning",
      "name": "Strategic Planning",
      "category": "strategic",
      "difficulty": 4,
      "prerequisites": ["piece_activity", "pawn_structure"],
      "description": "Formulating and executing long-term plans"
    },
    {
      "id": "prophylaxis",
      "name": "Prophylactic Thinking",
      "category": "strategic",
      "difficulty": 5,
      "prerequisites": ["planning"],
      "description": "Preventing opponent's plans before executing yours"
    }
  ]
}
```

---

## APPENDIX B: EXAMPLE WORKFLOWS

### Workflow 1: New User Plays First Game

1. User plays game → loses material to hanging pieces
2. POST `/api/learning/ingest-game` analyzes PGN with Stockfish
3. Detects 3 hanging piece mistakes (eval deltas: -400, -350, -300)
4. Creates `UserConceptState` for `hanging_pieces`:
   - mastery: 0.35 (low due to 3 mistakes)
   - confidence: 0.1 (only 1 game)
   - spacedRepDueAt: 3 days from now
5. User plays again → POST `/api/walle/postgame`
6. Wall-E selects `hanging_pieces` as top target (low mastery + recent)
7. Generates coaching: "I noticed you lost pieces on moves 8, 12, and 15. Before each move, ask yourself: 'Is this piece protected?' Let's practice tactical puzzles focusing on piece protection."
8. Creates `AdviceIntervention` with evaluation window = 5 games
9. User plays 5 more games → system tracks hanging piece frequency
10. After 5 games: only 3 hanging pieces total (0.6 per game, down from 3)
11. Intervention outcome: "success" (target was 1.5 per game)
12. Mastery increases to 0.52, due date shifts to 7 days

---

### Workflow 2: Established User Gets Practice Plan

1. User has played 50 games, mastered several concepts
2. GET `/api/learning/profile` shows:
   - Mastered: hanging_pieces (0.85), opening_principles (0.78)
   - Needs work: back_rank_mate (0.42), king_safety_opening (0.38)
3. GET `/api/learning/plan?window=7d` generates plan:
   - Priority 1: back_rank_mate (mastery 0.42, 5 recent mistakes)
   - Priority 2: king_safety_opening (mastery 0.38, overdue by 3 days)
   - Priority 3: tactical_forks (mastery 0.60, due tomorrow)
4. Suggested drills:
   - "Play 3 games focusing on back rank safety (add escape squares)"
   - "Review your last 2 losses where king safety was an issue"
   - "Practice puzzle set: back rank mates (level 2)"
5. User follows plan → plays games with focus
6. System tracks improvement → mastery increases
7. Next week's plan shifts to new concepts (spaced repetition working)

---

## APPENDIX C: DATABASE INDICES FOR PERFORMANCE

```sql
-- UserConceptState queries
CREATE INDEX idx_user_concept_mastery ON user_concept_states(userId, mastery);
CREATE INDEX idx_user_concept_due ON user_concept_states(userId, spacedRepDueAt);

-- AdviceIntervention queries
CREATE INDEX idx_intervention_user_outcome ON advice_interventions(userId, outcome);
CREATE INDEX idx_intervention_eval ON advice_interventions(userId, gamesEvaluated);

-- LearningEvent queries
CREATE INDEX idx_event_user_ts ON learning_events(userId, ts DESC);
CREATE INDEX idx_event_type_ts ON learning_events(eventType, ts DESC);
```

---

**END OF SPECIFICATION**
