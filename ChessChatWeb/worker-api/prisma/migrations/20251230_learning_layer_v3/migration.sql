-- Learning Layer V3 Migration
-- Adds concept-based mastery tracking with closed-loop learning

-- User concept states for mastery tracking
CREATE TABLE IF NOT EXISTS "user_concept_states" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "mistakeRateEMA" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "successRateEMA" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "spacedRepDueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  "lastPracticedAt" TIMESTAMP(3),
  "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "conceptId")
);

CREATE INDEX IF NOT EXISTS "user_concept_states_userId_mastery_idx" ON "user_concept_states"("userId", "mastery");
CREATE INDEX IF NOT EXISTS "user_concept_states_userId_spacedRepDueAt_idx" ON "user_concept_states"("userId", "spacedRepDueAt");

-- Advice interventions for tracking coaching effectiveness
CREATE TABLE IF NOT EXISTS "advice_interventions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "gameId" TEXT,
  "conceptsTargeted" JSONB NOT NULL,
  "adviceText" TEXT NOT NULL,
  "messageHash" TEXT NOT NULL,
  "expectedBehavior" TEXT NOT NULL,
  "measurementCriteria" JSONB NOT NULL,
  "evaluationGames" INTEGER NOT NULL DEFAULT 5,
  "gamesEvaluated" INTEGER NOT NULL DEFAULT 0,
  "outcome" TEXT,
  "measuredDelta" DOUBLE PRECISION,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "advice_interventions_userId_createdAt_idx" ON "advice_interventions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "advice_interventions_userId_outcome_idx" ON "advice_interventions"("userId", "outcome");

-- Practice plans for weekly focus
CREATE TABLE IF NOT EXISTS "practice_plans" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "planStart" TIMESTAMP(3) NOT NULL,
  "planEnd" TIMESTAMP(3) NOT NULL,
  "targetConcepts" JSONB NOT NULL,
  "suggestedDrills" JSONB NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "adherenceScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "practice_plans_userId_planStart_idx" ON "practice_plans"("userId", "planStart");

-- Learning event log for observability
CREATE TABLE IF NOT EXISTS "learning_events" (
  "id" TEXT PRIMARY KEY,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_events_ts_idx" ON "learning_events"("ts" DESC);
CREATE INDEX IF NOT EXISTS "learning_events_userId_ts_idx" ON "learning_events"("userId", "ts");

-- Update game_analyses to store concept-tagged mistakes
ALTER TABLE "game_analyses" ADD COLUMN IF NOT EXISTS "conceptsEncountered" JSONB;

-- Comments for documentation
COMMENT ON TABLE "user_concept_states" IS 'Tracks user mastery of individual chess concepts with spaced repetition';
COMMENT ON TABLE "advice_interventions" IS 'Records coaching advice and measures its effectiveness over time';
COMMENT ON TABLE "practice_plans" IS 'Weekly practice plans generated from concept states';
COMMENT ON TABLE "learning_events" IS 'Audit log of all learning system actions';
