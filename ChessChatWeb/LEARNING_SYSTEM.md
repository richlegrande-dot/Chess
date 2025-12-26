# 🧠 Chess AI Learning System

## Overview

The Chess AI Learning System is an advanced feature for CPU levels 7-8 that enables the AI to learn from previous games and improve over time. The system stores game outcomes, position evaluations, and opening preferences in browser localStorage, creating a personalized opponent that adapts to your playing style.

## Features

### 1. **Position Memory**
- Stores up to 1,000 positions with their outcomes
- Remembers best moves that led to wins
- Only uses learned moves with 55%+ win rate (level 7) or 65%+ (level 8)
- Minimum 3 games played before trusting a learned position

### 2. **Opening Book Expansion**
- Automatically tracks opening sequences (first 6 moves)
- Records win rates for each opening line
- Prioritizes successful openings in future games
- Combines with static opening book for comprehensive coverage

### 3. **Game Outcome Tracking**
- Records every game result (win/loss/draw)
- Tracks performance by CPU level
- Maintains statistics: total games, wins, losses, draws
- Calculates win rates for levels 7 and 8

### 4. **Adaptive Learning**
- CPU becomes stronger as it plays more games
- Learns which positions are critical
- Remembers tactical patterns that worked
- Avoids moves that previously led to losses

## How It Works

### Game Flow

1. **Move Selection Priority** (Levels 7-8):
   ```
   1. Check for learned position (high-confidence)
   2. Check learned opening lines
   3. Check static opening book
   4. Fall back to minimax AI search
   ```

2. **Game Recording**:
   - After each game ends, records:
     - Final outcome (win/loss/draw)
     - Opening moves used
     - Final position
     - Move count
   - Updates statistics immediately

3. **Learning From Experience**:
   - Winning positions get higher confidence
   - Losing positions reduce confidence
   - Neutral positions (draws) maintain balance

### Visual Indicators

**🧠 Learned Position Banner**
- Appears when CPU uses a learned move
- Shows for 3 seconds
- Purple gradient background
- Position: Top-left of screen

**Learning Statistics Panel**
- Available in Debug/Troubleshooting panel
- Shows:
  - Total games played
  - Wins, losses, draws
  - Overall win rate
  - Level 7 win rate
  - Level 8 win rate

## Storage Details

### localStorage Keys
- `chess_learning_database`: Main learning data

### Data Structure
```typescript
{
  gameHistory: GameOutcome[],        // Last 500 games
  learnedPositions: {...},           // Up to 1000 positions
  openingLines: {...},               // Opening sequences
  tacticalPatterns: [...],           // Up to 200 patterns
  statistics: {
    totalGames: number,
    wins: number,
    losses: number,
    draws: number,
    lastUpdated: timestamp
  }
}
```

### Storage Limits
- **Max Games**: 500 most recent
- **Max Positions**: 1,000 best-performing
- **Max Patterns**: 200 most successful
- Automatic pruning when limits exceeded

## Performance Impact

- **Minimal**: Learning only activates for levels 7-8
- **Instant learned moves**: 0.1s response when using stored knowledge
- **No slowdown**: Standard AI speed when no learned move available
- **localStorage**: ~1-2MB typical storage size

## Usage

### Basic Play
1. Select CPU Level 7 or 8
2. Start a new game
3. Play normally - AI learns automatically
4. Check statistics in Debug panel

### Viewing Progress
1. Click "Debug/Troubleshooting" button
2. Scroll to "🧠 Learning Statistics" section
3. See total games and win rates

### Resetting Learning Data
Currently no UI button - use browser console:
```javascript
import { clearLearningData } from './lib/learningAI';
clearLearningData();
```

## Learning Strategy

### Early Games (1-10 games)
- CPU explores different openings
- Builds position database
- Low confidence in learned moves
- Mostly uses standard AI

### Mid-term (10-50 games)
- Starts recognizing patterns
- Uses learned openings more frequently
- Builds tactical pattern library
- 20-30% learned moves

### Long-term (50+ games)
- Strong position memory
- Preferred opening repertoire established
- High-confidence learned moves
- 40-60% learned moves in familiar positions

## Technical Architecture

### Core Modules

1. **learningDatabase.ts**
   - localStorage management
   - Data persistence
   - Pruning algorithms
   - Statistics tracking

2. **learningAI.ts**
   - Move selection with learning
   - Game recording
   - Learning stats export
   - Integration with standard AI

3. **CoachingMode.tsx**
   - UI integration
   - Visual indicators
   - Statistics display
   - Game outcome detection

### Key Functions

- `findBestMoveWithLearning()`: Enhanced move selection
- `recordGameForLearning()`: Save game outcome
- `getLearningStats()`: Retrieve statistics
- `learningDB.recordPosition()`: Store position+move
- `learningDB.getLearnedMove()`: Retrieve learned move

## Future Enhancements

Potential improvements:
- Export/import learning data
- Learning data visualization
- Tactical pattern recognition
- Player style analysis
- Weakness exploitation
- Reset button in UI
- Learning rate controls

## Troubleshooting

### Learning Not Working
- Ensure playing level 7 or 8
- Check browser localStorage is enabled
- Verify localStorage quota not exceeded
- Check browser console for errors

### Statistics Not Updating
- Complete full games (to checkmate/draw)
- Wait 1-2 seconds after game ends
- Refresh debug panel
- Check if game was recorded in console logs

### Performance Issues
- Clear learning data if > 1000 games
- Disable learning temporarily (play levels 1-6)
- Check browser localStorage size
- Clear browser cache

## Best Practices

1. **Play Complete Games**: AI learns best from finished games
2. **Vary Your Play**: Different openings help AI learn more
3. **Check Statistics**: Monitor improvement over time
4. **Be Patient**: Learning improves gradually
5. **Challenge Yourself**: AI gets stronger as you play more

## Known Limitations

- No cross-device sync (localStorage only)
- Cannot export/import learning data yet
- No visualization of learned positions
- Limited to 1,000 positions
- Only works for levels 7-8

## Implementation Notes

### Why Levels 7-8 Only?
- Lower levels designed for consistent difficulty
- Learning requires depth 4-5 search (slower)
- Advanced players benefit most from adaptation
- Keeps beginner experience simple

### Why localStorage?
- No backend required
- Instant access (no network delay)
- Persists across sessions
- Easy to implement
- Privacy-friendly (data stays local)

### Learning Algorithm
- Simple win/loss tracking (not neural network)
- Weighted by game outcomes
- Minimum sample size before trusting
- Confidence-based move selection
- Combines with opening book

---

**Version**: 1.0  
**Last Updated**: December 19, 2025  
**Author**: Chess Chat Development Team
