# ChessChatWeb User Guide

**Last Updated**: December 18, 2025  
**Version**: 1.0.0

Welcome to ChessChatWeb! This guide will help you get started playing chess, analyzing your games, and learning from AI coaching.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Playing a Game](#playing-a-game)
3. [Post-Game Analysis](#post-game-analysis)
4. [Coaching Insights](#coaching-insights)
5. [Tips & Best Practices](#tips--best-practices)
6. [Troubleshooting](#troubleshooting)

## Getting Started

### Accessing ChessChatWeb

**Production**: Navigate to your deployed URL (e.g., `https://your-app.pages.dev`)

**Local Development**: `http://localhost:3000`

### First Steps

1. The chess board loads automatically when you open the app
2. You play as **White** (bottom of board)
3. AI plays as **Black** (top of board)
4. Make your first move to start!

## Playing a Game

### Making Moves

**Two Ways to Move**:

1. **Click-Click Method**:
   - Click the piece you want to move
   - Click the destination square
   - If promotion is needed (pawn reaching 8th rank), select the piece type

2. **Drag-and-Drop**:
   - Click and hold a piece
   - Drag it to the destination
   - Release to complete the move

### Game Controls

#### New Game Button
- Starts a fresh game
- Resets the board to starting position
- Clears chat history

#### Resign Button
- Forfeit the current game
- Immediately transitions to post-game analysis
- Use when the position is clearly lost

#### Settings Button (⚙️)
- Select different AI models
- Adjust game preferences
- View app information

### AI Models

ChessChatWeb supports multiple AI models:

| Model | Strength | Response Time | Best For |
|-------|----------|---------------|----------|
| GPT-4 | Strong | Medium | Competitive games |
| GPT-3.5 | Moderate | Fast | Quick practice |
| Claude 3.5 Sonnet | Strong | Medium | Positional play |
| Gemini Pro | Moderate | Fast | Learning games |

**How to Select**:
1. Click ⚙️ Settings
2. Choose "AI Model"
3. Select your preferred model
4. Start a new game for changes to take effect

### Game End Conditions

Games end when:
- **Checkmate**: One king is under attack and cannot escape
- **Stalemate**: Player to move has no legal moves but isn't in check
- **Resignation**: You click the "Resign" button
- **Threefold Repetition**: Same position occurs three times (automatic)
- **Fifty-Move Rule**: 50 moves without captures or pawn moves (automatic)

## Post-Game Analysis

After a game ends, you'll automatically enter **Game Analysis Mode**.

### Chat with AI

Ask questions about your game:

**Good Questions**:
- "Where did I make mistakes?"
- "What are better alternatives for move 12?"
- "How could I have won?"
- "Explain this position in simple terms"
- "What opening did we play?"

**AI Capabilities**:
- Analyzes the entire game (PGN)
- Identifies tactical mistakes
- Suggests improvements
- Explains strategic concepts
- Provides move-by-move breakdowns

### Quick Questions

Pre-made question buttons for common analysis:
- **Where did I make mistakes?** - Pinpoints critical errors
- **What are better alternatives?** - Suggests improvements
- **How could I have won?** - Winning lines you missed
- **Explain like I'm 8 years old** - Simplified explanations

### Game Summary

Displays:
- **Result**: Win (1-0), Loss (0-1), or Draw (½-½)
- **Moves**: Total number of moves played
- **AI Model**: Which AI opponent you played against

## Coaching Insights

### Opening the Coaching Panel

1. Complete a game
2. Click **🧠 Coaching** button in post-game chat
3. Coaching panel slides in from the right

### Quick Topics

**Opening Phase** (first 15 moves):
- 📚 Opening Principles
- ♔ King Safety  
- ⚔️ Center Control

**Middlegame** (moves 15-40):
- 🎯 Tactical Motifs
- 🎭 Pin & Fork
- ⚡ Discovered Attacks

**Endgame** (10 or fewer pieces):
- ♚ King Activity
- 🏁 Passed Pawns
- 🎓 Opposition

### Understanding Coaching Results

**Knowledge Chunks**:
- Expert-written chess concepts
- Sourced from chess books and courses
- Relevant to your game phase

**Expand for Details**:
- Click "▼ More" to see full explanation
- View tags (e.g., "tactics", "endgame")
- See source attribution

**Coaching Guidance**:
- Contextual advice based on game phase
- Related concepts
- Confidence score (how well the advice matches)

### Using Coaching Effectively

1. **Start with Quick Topics**: Use pre-made buttons to explore
2. **Search Specific Concepts**: Type "lucena position" or "discovered check"
3. **Connect to Your Game**: Ask chat "How does this apply to move 15?"
4. **Study Related Chunks**: If you see "Pin", explore "Skewer" next

## Tips & Best Practices

### Improving Your Chess

1. **Analyze Every Game**: Use post-game chat to understand mistakes
2. **Focus on Fundamentals**: 
   - Control the center
   - Develop pieces quickly
   - Castle early
   - Don't move the same piece twice in opening
3. **Learn Patterns**: Use Coaching Panel to study tactical motifs
4. **Play Different Models**: Experience varied playing styles
5. **Ask "Why?"**: Don't just ask "What move?" ask "Why is this better?"

### Making the Most of AI Analysis

**Specific Questions Get Better Answers**:
- ❌ "What happened?"
- ✅ "Why was moving my queen to e5 on move 15 a mistake?"

**Ask Follow-Up Questions**:
- AI: "You should have developed your bishop"
- You: "Where should the bishop have gone?"

**Use PGN Notation**:
- AI understands "move 12" or "12. Nf3"
- Refer to specific moves for detailed analysis

### Performance Tips

- **Close Coaching Panel** when not in use (saves resources)
- **Clear Chat** periodically if conversation gets long
- **Refresh Page** if AI responses slow down

## Troubleshooting

### Common Issues

#### "No Valid Moves Available"

**Cause**: You're in checkmate or stalemate  
**Solution**: Game is over. Click "Back to Game" to start new game.

#### AI Takes Too Long

**Cause**: Model may be busy or rate-limited  
**Solution**: 
1. Wait 30 seconds
2. If no response, refresh page
3. Try different AI model in settings

#### Move Won't Register

**Cause**: Illegal move attempted  
**Solution**:
- Check if your king is in check (must move king or block)
- Verify piece movement rules (knights move L-shape, bishops diagonal, etc.)
- Try clicking the piece first, then destination square

#### Coaching Panel Empty

**Cause**: Knowledge Vault may be empty or disconnected  
**Solution**:
- Contact admin to populate Knowledge Vault
- Try different search terms
- Refresh page and reopen coaching panel

#### Chat Not Responding

**Cause**: Network issue or AI API timeout  
**Solution**:
1. Check internet connection
2. Wait 10 seconds and retry
3. Refresh page if problem persists
4. Check [System Health](http://localhost:3000/admin) (if admin)

### Getting Help

**Questions or Issues?**
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (coming soon)
2. Contact your system administrator
3. Report bugs on GitHub (if open source)

### Browser Compatibility

**Supported Browsers**:
- ✅ Chrome/Edge (90+)
- ✅ Firefox (88+)
- ✅ Safari (14+)
- ❌ Internet Explorer (not supported)

**Mobile Support**:
- Fully responsive design
- Touch-friendly controls
- Works on iOS and Android

---

## Quick Reference

### Keyboard Shortcuts

Currently none implemented (future enhancement).

### Chess Notation

- **Files**: a-h (columns)
- **Ranks**: 1-8 (rows)
- **Square**: e4 (file + rank)
- **Move**: e2e4 or e4 (destination)
- **Capture**: exd5 (pawn on e file captures on d5)
- **Check**: + (e.g., Qh5+)
- **Checkmate**: # (e.g., Qh7#)
- **Castle Kingside**: O-O
- **Castle Queenside**: O-O-O

### Common Chess Terms

- **Pin**: Piece cannot move without exposing king/queen
- **Fork**: Piece attacks two pieces simultaneously
- **Skewer**: Like pin but valuable piece is in front
- **Discovered Attack**: Moving piece reveals attack from behind
- **Opening**: First ~15 moves, develop pieces
- **Middlegame**: Main battle, tactics and strategy
- **Endgame**: Few pieces left, king becomes active

---

**Ready to Play?** Start a new game and enjoy! 🎉

**Next**: See [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for admin features.
