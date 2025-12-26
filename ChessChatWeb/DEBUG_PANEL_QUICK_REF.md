# Enhanced Debug Panel - Quick Reference Card

## 🚀 Quick Access
**Location**: Bottom of Coaching Mode page  
**Button**: "Show Analytics Panel"  
**Keyboard**: None (click only)

## 📊 Panel Sections (Top to Bottom)

### 1. 🤖 CPU Status
```
✓ CPU Color: ⚪ White / ⚫ Black
✓ Difficulty: Level 1-8
✓ Thinking: ⏳ Yes / ✓ No
✓ In Flight: 🔒 Locked / 🔓 Ready
✓ Last Error: ❌ Error / ✓ None
```
**Actions**:
- 🚀 Force CPU Move - Manually trigger CPU
- 🔄 Reset CPU State - Emergency recovery

### 2. 🎮 Game State
```
Mode, Turn, Moves, Board Version, Status
```

### 3. 📜 Move History
Each move shows:
- `#1` Move number
- `⚪/⚫` Player
- `e2-e4` Move notation
- `📚/🧠/🎲` Source (opening/heuristic/random)

### 4. ❌ Move Errors (if any)
```
12:34:56 PM | e2→e5 | Illegal move: piece blocked
```

### 5. 📍 Position Details
```
FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR...
PGN: 1. e4 e5 2. Nf3 Nc6...
```

### 6. 🛠️ Debug Actions
- 📋 Log All - Console.log full state
- 📝 Copy PGN - Clipboard
- 🎯 Copy FEN - Clipboard
- 📦 Export JSON - Structured debug data
- 🗑️ Clear Errors - Reset error list

## 🎯 Common Use Cases

### CPU Not Responding?
1. Open panel
2. Check "CPU Thinking" status
3. Check "In Flight" status
4. Look for errors in CPU Status section
5. Try "🔄 Reset CPU State"
6. If still stuck, try "🚀 Force CPU Move"

### Move Failed?
1. Open panel
2. Scroll to "❌ Move Errors" section
3. Find most recent error
4. Read the reason
5. Check timestamp matches your attempt

### Need to Debug?
1. Open panel
2. Click "📋 Log All to Console"
3. Open browser DevTools (F12)
4. Check Console tab
5. Copy/paste state for analysis

### Reporting a Bug?
1. Open panel
2. Click "📦 Export Debug JSON"
3. Paste JSON into bug report
4. Include:
   - What you were doing
   - What you expected
   - What actually happened

## 🎨 Status Colors

| Color | Meaning | Example |
|-------|---------|---------|
| 🟢 Green | Success/Ready | CPU Idle, No Errors |
| 🟡 Yellow | Active/Processing | CPU Thinking |
| 🟠 Orange | Warning | In-Flight Locked |
| 🔴 Red | Error | CPU Error |
| ⚪ White | White pieces/turn | Player/CPU color |
| ⚫ Black | Black pieces/turn | Player/CPU color |

## 💡 Pro Tips

### Performance
- Panel auto-updates in real-time
- Only shows last 10 errors (keeps UI fast)
- Move history scrolls smoothly

### Clipboard
- All "Copy" buttons use browser clipboard
- Requires HTTPS or localhost
- Shows confirmation alert

### Debugging
- Console.log shows full state object
- JSON export is ready for bug reports
- FEN/PGN can be loaded in other chess tools

### Keyboard
- `ESC` doesn't close (use ✕ button)
- Panel scrolls independently
- Background clicks don't close panel

## ⚡ Shortcuts

| Action | Steps |
|--------|-------|
| Open Panel | Click "Show Analytics Panel" |
| Close Panel | Click ✕ in top-right |
| Force Move | CPU Status → 🚀 Force CPU Move |
| Reset CPU | CPU Status → 🔄 Reset CPU State |
| Copy PGN | Debug Actions → 📝 Copy PGN |
| Copy FEN | Debug Actions → 🎯 Copy FEN |
| Console Log | Debug Actions → 📋 Log All |
| Export Data | Debug Actions → 📦 Export JSON |
| Clear Errors | Debug Actions → 🗑️ Clear Errors |

## 🔧 Troubleshooting the Panel

### Panel Won't Open?
- Check browser console for errors
- Refresh page (Ctrl+R)
- Clear browser cache

### Buttons Don't Work?
- Check if CPU is thinking (wait)
- Check if it's CPU's turn
- Try refreshing page

### Data Not Updating?
- Close and reopen panel
- Check if game is active
- Verify moves are being made

---

**Print this card or keep it handy for quick debugging!**
