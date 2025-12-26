# Wall-E Learning System V2 - Quick Start Guide

**For**: Developers & AI Agents  
**Version**: 2.0  
**Last Updated**: December 20, 2025

---

## 🚀 Quick Start (5 Minutes)

### Understanding the System

Wall-E V2 transforms chess mistakes into **structured learning data** with:
- **MistakeEvent**: Structured data about what went wrong
- **MistakeSignature**: Stable patterns that persist across games
- **EnhancedCoachingPlan**: Adaptive training with spaced repetition
- **KnowledgeVault**: Educational content matched to patterns

### Architecture at a Glance

```
Game → Mistakes Detected → Signatures Updated → Plan Generated → UI Shows Learning
       (Phase 2)            (Phase 3)            (Phase 4)         (Phase 5)
```

---

## 🔧 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `types.ts` | Data model (Phase 1) | +150 |
| `mistakeDetector.ts` | Event extraction (Phase 2) | 322 |
| `signatureEngine.ts` | Pattern clustering (Phase 3) | 297 |
| `trainingPlanner.ts` | Coaching plans (Phase 4) | 310 |
| `vaultRetrieval.ts` | Knowledge integration (Phase 6) | 325 |
| `PostGameCoaching.tsx` | UI display (Phase 5) | +150 |
| `CoachingReport.css` | UI styling (Phase 5) | +300 |

---

## 💡 How to Use the System

### As a Developer

#### 1. Reading Learning Data
```typescript
import { getEnhancedLearningSystem } from './lib/coaching/enhancedLearningSystem';

const learningSystem = getEnhancedLearningSystem();
const insights = learningSystem.getPlayerInsights();

console.log(insights.profile.tacticalRating); // 0-100
console.log(insights.profile.commonMistakes); // Top 5 patterns
```

#### 2. Analyzing a Game
```typescript
import { coachingEngine } from './lib/coaching';

const report = await coachingEngine.analyzeGame(
  moveHistory,
  playerColor,
  { gameId: 'game_123', collectTrainingData: true }
);

// V2 enhanced data available:
if (report.learningData) {
  console.log(report.learningData.events);         // MistakeEvent[]
  console.log(report.learningData.signatures);     // MistakeSignature[]
  console.log(report.learningData.coachingPlan);   // EnhancedCoachingPlan
  console.log(report.learningData.debugInfo);      // Learning pipeline details
}
```

#### 3. Accessing Signatures Directly
```typescript
import { getSignatureEngine } from './lib/coaching/signatureEngine';

const engine = getSignatureEngine();
const signatures = engine.getSortedSignatures(); // Sorted by priority

signatures.forEach(sig => {
  console.log(`${sig.title}: ${sig.masteryScore}/100 mastery`);
  console.log(`Occurred ${sig.occurrences} times`);
});
```

#### 4. Generating Coaching Plans
```typescript
import { getTrainingPlanner } from './lib/coaching/trainingPlanner';

const planner = getTrainingPlanner();
const plan = planner.generatePlan(signatures);

console.log(plan.primaryFocus.title);          // Main focus
console.log(plan.nextGameObjective);           // Clear goal
console.log(plan.rotationSchedule);            // Next 5 games
```

#### 5. Knowledge Vault Retrieval
```typescript
import { getVaultEngine } from './lib/coaching/vaultRetrieval';

const vault = getVaultEngine();
const chunks = await vault.retrieve(signature, 3); // Top 3 chunks

chunks.forEach(chunk => {
  console.log(chunk.topic);        // e.g., "Fork Tactics"
  console.log(chunk.content);      // Educational text
  console.log(chunk.examples);     // Concrete examples
});
```

---

## 🎯 Common Tasks

### Task 1: Add a New Knowledge Chunk
```typescript
import { getVaultEngine } from './lib/coaching/vaultRetrieval';

const vault = getVaultEngine();
vault.addToLocalVault({
  id: 'custom_pattern_123',
  category: 'tactics',
  topic: 'Windmill Tactic',
  content: 'A windmill is a powerful tactical pattern...',
  examples: ['Rook on 7th rank, bishop checks...'],
  relatedPrinciples: ['piece-coordination'],
  difficulty: 'advanced',
});
```

### Task 2: Reset a Player's Profile
```typescript
import { getEnhancedLearningSystem } from './lib/coaching/enhancedLearningSystem';

const system = getEnhancedLearningSystem();
system.resetProfile(); // Clears all learning data
```

### Task 3: Export Learning Data
```typescript
const system = getEnhancedLearningSystem();
const data = system.exportPlayerData();
console.log(JSON.stringify(data, null, 2));
// Can be saved to file or sent to server
```

### Task 4: Check Debug Information
```typescript
const report = await coachingEngine.analyzeGame(...);

if (report.learningData?.debugInfo) {
  console.log('Events detected:', report.learningData.debugInfo.detectedEvents.length);
  console.log('Signatures updated:', report.learningData.debugInfo.signatureUpdates.length);
  console.log('Planner logic:', report.learningData.debugInfo.plannerRationale);
  console.log('Heuristics:', report.learningData.debugInfo.appliedHeuristics);
  console.log('Vault:', report.learningData.debugInfo.vaultRetrievals);
}
```

---

## 🐛 Debugging

### Problem: Signatures Not Persisting
**Check**: `localStorage.getItem('chess_mistake_signatures')`
```typescript
const stored = localStorage.getItem('chess_mistake_signatures');
console.log(JSON.parse(stored || '[]'));
```

### Problem: Mastery Not Updating
**Debug**: Enable console logs in signatureEngine
```typescript
// In signatureEngine.ts, add:
console.log('Processing event:', event.id);
console.log('Updated mastery:', signature.masteryScore);
```

### Problem: UI Not Showing Learning Data
**Check**: Verify report structure
```typescript
console.log('Has learningData:', 'learningData' in report);
console.log('Learning events:', report.learningData?.events.length);
```

---

## 📊 Key Metrics

### Mastery Score Calculation
```
newScore = currentScore * 0.9 + observation * 0.1
where observation = 100 (success) or 0 (failure)
```

### Time Decay
```
decayedScore = score * (0.95 ^ daysSinceLastSeen)
5% decay per day
```

### Priority Score
```
priority = (masteryFactor * 0.4 + recencyFactor * 0.3 + 
           frequencyFactor * 0.2 + successFactor * 0.1) * 10
```

---

## 🎨 UI Components

### Displaying Mastery Bars
```tsx
<div className="mastery-bar">
  <div 
    className="mastery-fill" 
    style={{ 
      width: `${signature.masteryScore}%`,
      backgroundColor: signature.masteryScore >= 70 ? '#4ade80' :
                       signature.masteryScore >= 40 ? '#fbbf24' : '#ef4444'
    }}
  />
  <span className="mastery-label">{signature.masteryScore.toFixed(0)}% Mastery</span>
</div>
```

### Showing Next Game Focus
```tsx
{report.learningData?.coachingPlan && (
  <div className="next-game-focus">
    <h3>🎯 Focus for Next Game</h3>
    <h4>{report.learningData.coachingPlan.primaryFocus.title}</h4>
    <p>{report.learningData.coachingPlan.nextGameObjective}</p>
  </div>
)}
```

---

## 🧪 Testing

### Manual Test Flow
1. ✅ Play 3 games → Check signatures appear
2. ✅ Repeat same mistake → Check occurrences increment
3. ✅ Play 3 games with focus → Check rotation happens
4. ✅ Open debug panel → Verify pipeline data
5. ✅ Export data → Verify JSON structure

### Console Tests
```javascript
// Test signature creation
const engine = getSignatureEngine();
console.log('Signatures:', engine.getAllSignatures().length);

// Test planner
const planner = getTrainingPlanner();
const plan = planner.generatePlan(engine.getSortedSignatures());
console.log('Primary focus:', plan.primaryFocus.title);

// Test vault
const vault = getVaultEngine();
vault.retrieve(engine.getSortedSignatures()[0]).then(chunks => {
  console.log('Retrieved chunks:', chunks.length);
});
```

---

## 📦 Storage Schema

### localStorage Keys
- `chess_mistake_signatures`: MistakeSignature[]
- `chess_player_profile`: PlayerProfile
- `chess_game_history`: GameHistory[]
- `chess_knowledge_vault_custom`: KnowledgeChunk[]

### Size Estimates
- Signatures (50 games): ~10-15KB
- Player profile: ~5KB
- Game history (50): ~50KB
- Custom vault: ~5KB
- **Total**: ~75KB

---

## 🚢 Deployment

### Build & Deploy
```bash
# Build
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=chesschat-web

# Check deployment
curl https://chesschat.uk
```

### Build Output
```
✓ dist/assets/index-DBQvci-y.js  297.08 kB │ gzip: 84.22 kB
✓ built in 3.65s
```

---

## 🔗 Related Documentation

- **Full Documentation**: [WALLE_LEARNING_SYSTEM_V2.md](WALLE_LEARNING_SYSTEM_V2.md)
- **V1 System (Legacy)**: [WALL_E_LEARNING_SYSTEM.md](WALL_E_LEARNING_SYSTEM.md)
- **API Reference**: See Phase sections in V2 doc
- **Architecture Diagrams**: See V2 doc "Architecture Overview"

---

## ❓ FAQ

**Q: Where is the data stored?**  
A: 100% client-side in browser localStorage. No server transmission.

**Q: Can I add new mistake categories?**  
A: Yes, edit the `MistakeCategory` type in types.ts. Categories: opening, tactics, strategy, endgame, time, psychology.

**Q: How do I change the mastery decay rate?**  
A: Edit `decayRate` in MistakeSignature (default 0.95). Or modify `applyTimeDecay()` in signatureEngine.ts.

**Q: Can I use a remote knowledge vault?**  
A: Yes! Pass endpoint to `getVaultEngine('https://api.example.com/vault')`.

**Q: How do I reset the learning system for testing?**  
A: Call `localStorage.clear()` or use the "Reset Profile" button in UI.

**Q: What's the minimum number of games for good insights?**  
A: ~10 games for pattern recognition, ~20 for reliable coaching plans.

---

## 🎓 Learning More

**Understand the system in 3 steps**:
1. Read Phase 1-2 in V2 doc (data model + detection)
2. Play with signature engine in browser console
3. Trace a game analysis in debugger

**Key concepts**:
- **Event**: Single mistake instance
- **Signature**: Stable pattern across games
- **Mastery**: 0-100 score with EMA + decay
- **Spaced Repetition**: Rotation to prevent fatigue
- **Vault**: Educational content library

---

**Happy Coding! 🤖♟️**

For questions or issues, see [WALLE_LEARNING_SYSTEM_V2.md](WALLE_LEARNING_SYSTEM_V2.md) for detailed explanations.
