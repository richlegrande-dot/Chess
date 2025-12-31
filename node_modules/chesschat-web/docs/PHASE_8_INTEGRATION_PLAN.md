# Phase 8: CoachEngine Integration with Game Analysis

**Status**: 🚀 READY TO START  
**Started**: December 18, 2025  
**Objective**: Integrate CoachEngine knowledge retrieval into game analysis workflow

## Overview

Phase 8 connects the CoachEngine (Phase 7) with the actual game analysis pipeline, bringing intelligent coaching insights directly into the post-game chat experience.

## Goals

1. **Enhance PostGameChat** with CoachEngine-powered suggestions
2. **Auto-generate coaching insights** based on game context
3. **Provide quick-action coaching** buttons for common themes
4. **Display relevant knowledge** alongside game analysis
5. **Track coaching effectiveness** (future: Phase 8.5)

## Architecture

### Current Flow
```
User plays game → Game ends → PostGameChat → AI chat about game
```

### Enhanced Flow (Phase 8)
```
User plays game → Game ends → PostGameChat
  ├─→ AI chat about game
  ├─→ CoachEngine analyzes position/moves
  ├─→ Suggests relevant knowledge (tactics, openings, endgames)
  └─→ Quick coaching buttons ("Show me tactics", "Opening tips", etc.)
```

## Implementation Plan

### 1. Add CoachEngine Integration to PostGameChat

**File**: `src/components/PostGameChat.tsx`

**New Features**:
- "Get Coaching Insights" button
- Auto-triggered coaching on game load (based on game phase)
- Quick coaching actions:
  - "Tactical Tips" → search_knowledge for tactics
  - "Opening Advice" → thematic_coaching for opening
  - "Endgame Guidance" → thematic_coaching for endgame
- Display coaching results in chat alongside AI responses

### 2. Create Coaching Panel Component

**New File**: `src/components/CoachingPanel.tsx`

```tsx
interface CoachingPanelProps {
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  playerColor: 'white' | 'black';
  onCoachingRequest: (theme: string) => void;
}
```

Features:
- Quick action buttons based on game phase
- Recent coaching insights display
- "Learn More" links to specific knowledge chunks

### 3. Enhanced Game Context

**Update**: `src/store/gameStore.ts`

Add fields:
```typescript
gamePhase: 'opening' | 'middlegame' | 'endgame';
detectedThemes: string[]; // ['tactics', 'pin', 'king-safety']
coachingHistory: CoachingInsight[];
```

### 4. Coaching API Integration

**Update**: `src/lib/api.ts`

Add coaching methods to main API:
```typescript
api.coaching = {
  getInsights: (gameContext) => { /* calls CoachEngine */ },
  searchTactics: (position) => { /* tactical search */ },
  getThematicGuidance: (theme) => { /* thematic coaching */ },
};
```

### 5. UI Enhancements

**Update**: `src/styles/PostGameChat.css`

Add styles for:
- Coaching panel sidebar
- Knowledge chunk cards
- Quick action buttons
- Source attribution badges

### 6. Mock Backend Support

**Update**: `mock-backend.ts`

Ensure all CoachEngine endpoints work:
- ✅ POST /api/admin/coach (already works)
- Need to expose for non-admin use or create public variant

## User Experience Flow

### Scenario 1: Tactical Game
```
1. User finishes game with several tactical opportunities
2. PostGameChat loads → Auto-detects "tactical themes"
3. Shows button: "🎯 See Tactical Lessons"
4. User clicks → CoachEngine searches for relevant tactics
5. Displays: Pin, Fork, Discovered Attack lessons
6. User can ask follow-up questions to AI
```

### Scenario 2: Opening Mistake
```
1. User loses in opening phase
2. PostGameChat detects "opening" phase, poor evaluation
3. Shows: "📚 Opening Principles Review"
4. Displays: Development, Center Control, King Safety
5. User can ask: "What should I have done differently?"
```

### Scenario 3: Endgame Conversion
```
1. User reaches endgame with advantage
2. Shows: "♔ Endgame Technique Tips"
3. Displays: King Activity, Passed Pawns, Opposition
4. User practices with coaching guidance
```

## Success Criteria

- [x] CoachEngine integrated with PostGameChat
- [ ] Coaching insights auto-generated on game load
- [ ] Quick action buttons functional
- [ ] Knowledge chunks displayed with proper formatting
- [ ] Source attribution shown
- [ ] Works with mock backend
- [ ] Smooth user experience (no lag)
- [ ] Mobile-responsive coaching panel

## Technical Considerations

### Performance
- Cache coaching results per game
- Lazy-load coaching panel (code-split)
- Debounce coaching API calls

### Data Flow
```
PostGameChat
  ↓
useCoaching hook
  ↓
api.coaching.getInsights()
  ↓
/api/admin/coach (or new public endpoint)
  ↓
CoachEngine.generateAdvice()
  ↓
KnowledgeService.searchChunks()
  ↓
Return relevant chunks
```

### Error Handling
- Graceful fallback if CoachEngine unavailable
- Show generic advice if no knowledge matches
- Handle network errors with retry logic

## Implementation Steps

### Step 1: Create Coaching Hook (15 min)
```bash
src/hooks/useCoaching.ts
```

### Step 2: Create CoachingPanel Component (30 min)
```bash
src/components/CoachingPanel.tsx
src/styles/CoachingPanel.css
```

### Step 3: Integrate with PostGameChat (20 min)
- Add coaching panel to layout
- Wire up quick action buttons
- Display coaching results

### Step 4: Add Game Phase Detection (15 min)
- Analyze move count
- Detect opening/middlegame/endgame
- Store in game state

### Step 5: Test Integration (20 min)
- Test with mock backend
- Verify all coaching actions work
- Check UI responsiveness

### Step 6: Polish UX (20 min)
- Add loading states
- Smooth animations
- Error messages
- Empty states

**Total Estimated Time**: ~2 hours

## Files to Create

```
src/
├── hooks/
│   └── useCoaching.ts           (NEW)
├── components/
│   ├── CoachingPanel.tsx        (NEW)
│   └── PostGameChat.tsx         (MODIFIED)
├── styles/
│   ├── CoachingPanel.css        (NEW)
│   └── PostGameChat.css         (MODIFIED)
├── store/
│   └── gameStore.ts             (MODIFIED)
└── lib/
    └── api.ts                   (MODIFIED)
```

## Future Enhancements (Phase 8.5)

1. **Coaching History Tracking**
   - Store which insights user viewed
   - Track effectiveness (did user improve?)
   - Personalize recommendations

2. **Adaptive Coaching**
   - Adjust complexity based on player rating
   - Focus on weakest areas
   - Progressive difficulty

3. **Multi-Step Coaching**
   - "Show me examples" → pulls specific game positions
   - "Explain more" → deeper dive into concept
   - "Quiz me" → tactical puzzles from knowledge base

4. **Visual Coaching**
   - Highlight key squares on board
   - Annotate diagrams with coaching tips
   - Arrow overlays for piece movement

## Dependencies

- ✅ Phase 7 (CoachEngine) - Complete
- ✅ Phase 6 (Knowledge Vault) - Populated with content
- ✅ Mock Backend - Running with coach endpoint
- ✅ Admin Portal - CoachEngine test interface works

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance lag with large knowledge base | Medium | High | Cache results, lazy-load chunks |
| UI clutter | Low | Medium | Collapsible panel, clean design |
| Mock backend not matching prod | Medium | Low | Use same data format, test thoroughly |
| Coaching not relevant | Medium | High | Tune relevance scoring, add filters |

## Testing Strategy

1. **Unit Tests**: useCoaching hook logic
2. **Integration Tests**: API calls, data flow
3. **UI Tests**: Button clicks, panel display
4. **E2E Tests**: Full game → coaching flow
5. **Manual Testing**: Play games, verify insights

## Success Metrics

- Coaching panel loads in < 500ms
- Relevant insights in > 80% of games
- User engagement (clicks on coaching buttons)
- Positive user feedback

---

**Next**: Begin implementation with Step 1 (useCoaching hook)
