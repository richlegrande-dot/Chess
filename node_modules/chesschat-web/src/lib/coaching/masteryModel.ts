/**
 * Mastery Model
 * 
 * Evidence-weighted skill tracking that replaces simple count thresholds.
 * Uses exponential moving averages, recency decay, and spaced repetition
 * scheduling to provide more accurate learning progress.
 */

import * as safeStorage from '../storage/safeStorage';

export interface MasteryData {
  mastery: number;        // 0-1, where 1 = mastered
  confidence: number;     // 0-1, based on evidence quality and quantity
  lastSeen: number;       // Timestamp of last occurrence
  dueAt: number;          // When this concept should be reviewed
  streak: number;         // Consecutive games without mistake
  evidenceIds: string[];  // References to supporting evidence
  totalSeen: number;      // Total times encountered
}

export interface MasteryUpdate {
  conceptKey: string;
  wasMistake: boolean;
  severity: number;       // 0-1, where 1 = critical
  evidenceId: string;
  timestamp: number;
}

interface MasteryStore {
  [conceptKey: string]: MasteryData;
}

const STORAGE_KEY = 'learning:mastery';
const STORAGE_VERSION = 1;

// Mastery calculation constants
const MISTAKE_IMPACT_BASE = 0.3;      // Base reduction for any mistake
const SEVERITY_MULTIPLIER = 0.7;       // Additional impact based on severity
const SUCCESS_BOOST = 0.05;            // Small boost for clean games
const CONFIDENCE_DECAY_DAYS = 30;      // Days before confidence starts decaying
const MAX_EVIDENCE_REFS = 10;          // Keep most recent N evidence IDs
const INITIAL_CONFIDENCE = 0.3;        // Starting confidence for new concepts

// Spaced repetition intervals (in days)
const SR_INTERVALS = [1, 3, 7, 14, 30, 60, 120];

/**
 * Load mastery data from storage
 */
function loadMasteryStore(): MasteryStore {
  const data = safeStorage.getItem<MasteryStore>(STORAGE_KEY);
  return data || {};
}

/**
 * Save mastery data to storage
 */
function saveMasteryStore(store: MasteryStore): void {
  safeStorage.setItem(STORAGE_KEY, store, {
    version: STORAGE_VERSION,
    maxBytes: 1024 * 1024 // 1MB limit for mastery data
  });
}

/**
 * Calculate confidence based on evidence quantity and recency
 */
function calculateConfidence(data: MasteryData, now: number): number {
  const baseConfidence = Math.min(data.totalSeen / 10, 1.0); // Max confidence at 10 sightings
  
  // Apply recency decay
  const daysSinceLastSeen = (now - data.lastSeen) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0, 1 - (daysSinceLastSeen / CONFIDENCE_DECAY_DAYS));
  
  return baseConfidence * recencyFactor;
}

/**
 * Calculate next review date using spaced repetition
 */
function calculateNextReview(mastery: number, streak: number): number {
  const masteryLevel = Math.floor(mastery * SR_INTERVALS.length);
  const intervalIndex = Math.min(masteryLevel + Math.floor(streak / 3), SR_INTERVALS.length - 1);
  const daysUntilReview = SR_INTERVALS[intervalIndex];
  
  return Date.now() + (daysUntilReview * 24 * 60 * 60 * 1000);
}

/**
 * Update mastery for a concept based on performance
 */
export function updateMastery(update: MasteryUpdate): MasteryData {
  const store = loadMasteryStore();
  const existing = store[update.conceptKey];
  const now = update.timestamp;
  
  // Initialize if new concept
  if (!existing) {
    const initial: MasteryData = {
      mastery: update.wasMistake ? 0 : 0.5,
      confidence: INITIAL_CONFIDENCE,
      lastSeen: now,
      dueAt: calculateNextReview(update.wasMistake ? 0 : 0.5, 0),
      streak: update.wasMistake ? 0 : 1,
      evidenceIds: [update.evidenceId],
      totalSeen: 1
    };
    
    store[update.conceptKey] = initial;
    saveMasteryStore(store);
    return initial;
  }
  
  // Update existing mastery using exponential moving average
  let newMastery = existing.mastery;
  let newStreak = existing.streak;
  
  if (update.wasMistake) {
    // Mistake reduces mastery
    const impactAmount = MISTAKE_IMPACT_BASE + (update.severity * SEVERITY_MULTIPLIER);
    newMastery = Math.max(0, existing.mastery - impactAmount);
    newStreak = 0;
  } else {
    // Success increases mastery (slower than mistakes decrease it)
    newMastery = Math.min(1, existing.mastery + SUCCESS_BOOST);
    newStreak = existing.streak + 1;
  }
  
  // Add evidence reference (keep most recent N)
  const evidenceIds = [update.evidenceId, ...existing.evidenceIds].slice(0, MAX_EVIDENCE_REFS);
  
  const updated: MasteryData = {
    mastery: newMastery,
    confidence: calculateConfidence(existing, now),
    lastSeen: now,
    dueAt: calculateNextReview(newMastery, newStreak),
    streak: newStreak,
    evidenceIds,
    totalSeen: existing.totalSeen + 1
  };
  
  store[update.conceptKey] = updated;
  saveMasteryStore(store);
  
  return updated;
}

/**
 * Get mastery data for a specific concept
 */
export function getMastery(conceptKey: string): MasteryData | null {
  const store = loadMasteryStore();
  return store[conceptKey] || null;
}

/**
 * Get all concepts sorted by priority for practice
 * Priority = (1 - mastery) * confidence + overdueBoost
 */
export function getPracticePriorities(): Array<{ conceptKey: string; priority: number; data: MasteryData }> {
  const store = loadMasteryStore();
  const now = Date.now();
  const results: Array<{ conceptKey: string; priority: number; data: MasteryData }> = [];
  
  for (const [conceptKey, data] of Object.entries(store)) {
    // Recalculate confidence based on current time
    const currentConfidence = calculateConfidence(data, now);
    
    // Base priority: concepts with low mastery and high confidence
    let priority = (1 - data.mastery) * currentConfidence;
    
    // Boost priority if overdue for review
    if (now > data.dueAt) {
      const daysOverdue = (now - data.dueAt) / (1000 * 60 * 60 * 24);
      priority += Math.min(daysOverdue / 7, 0.5); // Max boost of 0.5
    }
    
    results.push({ conceptKey, priority, data });
  }
  
  // Sort by priority (highest first)
  results.sort((a, b) => b.priority - a.priority);
  
  return results;
}

/**
 * Get statistics about overall learning progress
 */
export function getLearningStats(): {
  totalConcepts: number;
  masteredConcepts: number;
  inProgressConcepts: number;
  needsReviewConcepts: number;
  averageMastery: number;
} {
  const store = loadMasteryStore();
  const now = Date.now();
  
  let totalMastery = 0;
  let masteredCount = 0;
  let inProgressCount = 0;
  let needsReviewCount = 0;
  
  for (const data of Object.values(store)) {
    totalMastery += data.mastery;
    
    if (data.mastery >= 0.8) {
      masteredCount++;
    } else if (data.mastery >= 0.3) {
      inProgressCount++;
    }
    
    if (now > data.dueAt) {
      needsReviewCount++;
    }
  }
  
  const totalConcepts = Object.keys(store).length;
  
  return {
    totalConcepts,
    masteredConcepts: masteredCount,
    inProgressConcepts: inProgressCount,
    needsReviewConcepts: needsReviewCount,
    averageMastery: totalConcepts > 0 ? totalMastery / totalConcepts : 0
  };
}

/**
 * Apply recency decay to all concepts (call periodically, e.g., on app load)
 */
export function applyRecencyDecay(): void {
  const store = loadMasteryStore();
  const now = Date.now();
  let updated = false;
  
  for (const [key, data] of Object.entries(store)) {
    const newConfidence = calculateConfidence(data, now);
    if (newConfidence !== data.confidence) {
      store[key] = { ...data, confidence: newConfidence };
      updated = true;
    }
  }
  
  if (updated) {
    saveMasteryStore(store);
  }
}

/**
 * Clear all mastery data (for testing or reset)
 */
export function clearAllMastery(): void {
  safeStorage.clearNamespace('learning');
}
