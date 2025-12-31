# ChessChat Web - Manual Testing Checklist

## Overview
This checklist provides a systematic approach to manually testing ChessChatWeb. Use this in conjunction with automated tests to ensure comprehensive coverage.

## Pre-Testing Setup
- [ ] Ensure OPENAI_API_KEY is configured if testing AI functionality
- [ ] Test on multiple browsers: Chrome, Firefox, Safari, Edge
- [ ] Test on multiple viewport sizes: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- [ ] Clear browser cache before testing
- [ ] Ensure stable internet connection

---

## 1. Pre-Game Flow Testing

### 1.1 Home Page Load
**URL: /** 
- [ ] Page loads without errors (check console for errors)
- [ ] ChessChat logo/title is visible
- [ ] "Play" button is prominently displayed
- [ ] Page is responsive on mobile devices
- [ ] Page loads within 3 seconds on normal connection

**Accessibility:**
- [ ] Tab navigation works (Tab to Play button)
- [ ] Play button is keyboard accessible (Enter/Space activates)
- [ ] Proper heading hierarchy (H1 for main title)
- [ ] Sufficient color contrast for text elements

### 1.2 Navigation to Model Selection
**From: Home Page**
- [ ] Click "Play" button successfully navigates to model selection
- [ ] URL changes appropriately
- [ ] Back button (if present) returns to home
- [ ] Browser back button returns to home correctly

### 1.3 Model Selection Screen
**Expected Elements:**
- [ ] "Choose AI Model" heading is visible
- [ ] At least one AI model card is displayed
- [ ] Each model shows: Name, Description, Difficulty level
- [ ] "Back" button returns to home page
- [ ] "Continue/Start" button appears after model selection

**Functionality:**
- [ ] Can select a model (visual feedback on selection)
- [ ] Can change model selection
- [ ] Continue button is disabled until model is selected
- [ ] Continue button enables after model selection
- [ ] Continue button successfully starts the game

**Mobile/Responsive:**
- [ ] Model cards stack properly on mobile
- [ ] All text remains readable
- [ ] Buttons remain accessible and properly sized

---

## 2. Game Screen Testing

### 2.1 Initial Game Load
**From: Model Selection → Continue**
- [ ] Game screen loads within 5 seconds
- [ ] Chess board is visible and properly rendered
- [ ] Turn indicator shows "Your Turn" initially
- [ ] Move counter shows "0" moves
- [ ] Game status shows "Playing" or equivalent
- [ ] Resign and New Game buttons are visible

**3D Board Specific (if applicable):**
- [ ] 3D canvas loads without WebGL errors
- [ ] Board orientation is correct (white on bottom)
- [ ] All 32 pieces are visible in correct positions
- [ ] Orbit controls work (drag to rotate, scroll to zoom)
- [ ] Lighting and shadows render properly

### 2.2 Board State Verification
**Initial Position:**
- [ ] White pieces on ranks 1-2 (bottom two rows)
- [ ] Black pieces on ranks 7-8 (top two rows)
- [ ] Pawns on ranks 2 and 7
- [ ] Major pieces on ranks 1 and 8 in correct positions
- [ ] All squares are accessible/clickable

### 2.3 Game Interface Elements
**Header Section:**
- [ ] Game title/logo visible
- [ ] Selected AI model displayed
- [ ] Turn indicator updates appropriately

**Control Buttons:**
- [ ] Resign button present and clickable
- [ ] New Game button present and clickable
- [ ] Settings access (if available in-game)

**Game Information:**
- [ ] Move counter displays correctly
- [ ] Game status updates (Playing, Check, Checkmate, etc.)
- [ ] PGN display (if available) shows move history

---

## 3. Piece Movement Testing

### 3.1 Basic Piece Selection
**Test with White Pawn (e2):**
- [ ] Click e2 pawn - piece becomes selected (visual feedback)
- [ ] Legal move squares highlighted (e3, e4)
- [ ] Click same piece again - deselects properly
- [ ] Click different piece - selection transfers correctly

### 3.2 Legal Move Execution
**Standard Opening Moves:**
- [ ] e2-e4: Click e2 pawn, then e4 → Move executes
- [ ] d2-d4: Pawn advances two squares
- [ ] Nf3: Knight moves to f3 from g1
- [ ] Bc4: Bishop moves diagonally

**Verify After Each Move:**
- [ ] Source square becomes empty
- [ ] Target square contains moved piece
- [ ] Turn indicator changes to "AI's Turn"
- [ ] Move counter increments
- [ ] PGN updates with notation

### 3.3 Illegal Move Rejection
**Test Invalid Moves:**
- [ ] e2-e5 (pawn can't move 3 squares) → Rejected
- [ ] e2-d3 (pawn can't move diagonally without capture) → Rejected  
- [ ] Move opponent's piece (black piece) → Rejected
- [ ] Move to occupied square (friendly piece) → Rejected
- [ ] King into check → Rejected

**Verification:**
- [ ] Board state remains unchanged
- [ ] No error messages appear (graceful handling)
- [ ] Turn remains with player
- [ ] Piece selection resets

### 3.4 Special Moves (Advanced)
**If time permits:**
- [ ] Castling (kingside and queenside)
- [ ] En passant capture
- [ ] Pawn promotion
- [ ] Capture moves update board correctly

---

## 4. AI Response Testing

### 4.1 AI Thinking State
**After Player Move:**
- [ ] Status immediately changes to "AI's Turn" or "Thinking"
- [ ] Thinking animation appears (dots, knight, spinner)
- [ ] Player moves are blocked during AI thinking
- [ ] Game control buttons are disabled during thinking

### 4.2 AI Move Execution
**Timing:**
- [ ] AI responds within 30 seconds (normal cases)
- [ ] AI response time is reasonable for user experience

**Move Validation:**
- [ ] AI move is legal (follows chess rules)
- [ ] AI move updates board correctly
- [ ] Move notation appears in PGN
- [ ] Turn returns to player after AI move
- [ ] Move counter increments for both player and AI moves

### 4.3 Multiple Move Exchanges
**Test 5-10 Move Game:**
- [ ] Player move 1 → AI responds appropriately
- [ ] Player move 2 → AI responds appropriately  
- [ ] Continue for several moves without issues
- [ ] Game state remains consistent throughout
- [ ] No stuck "AI thinking" states
- [ ] Performance remains smooth

### 4.4 AI Error Handling
**Network Issues (simulate by disconnecting internet):**
- [ ] Error message appears for connection failures
- [ ] "Retry" button is provided
- [ ] Game state is preserved during error
- [ ] Retry successfully resumes game

**API Failures:**
- [ ] Timeout errors handled gracefully
- [ ] Invalid API responses don't crash game
- [ ] Error messages are user-friendly

---

## 5. Game State Management

### 5.1 Game Termination
**Checkmate Testing:**
- [ ] Game correctly detects checkmate
- [ ] Status updates to show game result
- [ ] Winner is clearly indicated
- [ ] Post-game options appear

**Stalemate/Draw:**
- [ ] Stalemate correctly detected
- [ ] Draw conditions properly handled
- [ ] Game result clearly displayed

### 5.2 Game Controls
**Resign Function:**
- [ ] Resign button ends game immediately
- [ ] Game result shows resignation
- [ ] Post-game flow initiates

**New Game:**
- [ ] New Game button resets to model selection
- [ ] Board resets to initial position
- [ ] Move counter resets to 0
- [ ] Game state completely refreshes

### 5.3 Game Persistence
**Browser Refresh:**
- [ ] Refresh during player turn maintains state
- [ ] Refresh during AI thinking handles gracefully
- [ ] Game history is preserved when possible

---

## 6. User Experience Testing

### 6.1 Performance
**Loading Times:**
- [ ] Home page loads < 3 seconds
- [ ] Model selection loads < 2 seconds  
- [ ] Game screen loads < 5 seconds
- [ ] 3D board (if applicable) loads < 10 seconds

**Responsiveness:**
- [ ] Piece movements are smooth
- [ ] UI updates happen immediately
- [ ] No laggy interactions

### 6.2 Visual Design
**Layout:**
- [ ] All elements fit properly on screen
- [ ] No horizontal scrolling required
- [ ] Text is readable at all sizes
- [ ] Colors provide sufficient contrast

**3D Visuals (if applicable):**
- [ ] Pieces are distinguishable
- [ ] Board materials look professional
- [ ] Lighting enhances visibility
- [ ] Camera controls are intuitive

### 6.3 Mobile Experience
**Touch Interactions:**
- [ ] Pieces can be selected with touch
- [ ] Move execution works with tap-to-move
- [ ] 3D controls work with touch gestures
- [ ] All buttons are appropriately sized for touch

**Mobile Layout:**
- [ ] Game board fits screen properly
- [ ] Controls remain accessible
- [ ] Text remains readable
- [ ] Navigation works smoothly

---

## 7. Accessibility Testing

### 7.1 Keyboard Navigation
- [ ] Tab order is logical throughout application
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are clearly visible
- [ ] Escape key closes modals/dialogs appropriately

### 7.2 Screen Reader Support
- [ ] Headings are properly structured (H1, H2, H3...)
- [ ] Interactive elements have appropriate labels
- [ ] Game state changes are announced
- [ ] Error messages are readable by screen readers

### 7.3 Visual Accessibility
- [ ] Text meets WCAG color contrast requirements
- [ ] UI works with browser zoom up to 200%
- [ ] Motion/animations can be reduced if needed
- [ ] Focus indicators are clearly visible

---

## 8. Error Scenarios & Edge Cases

### 8.1 Network Conditions
- [ ] Slow connection: App remains usable
- [ ] Intermittent connection: Graceful degradation
- [ ] Complete disconnection: Appropriate error handling
- [ ] Reconnection: Game can resume appropriately

### 8.2 Browser Compatibility
**Chrome:**
- [ ] All features work correctly
- [ ] Performance is smooth
- [ ] 3D rendering works properly

**Firefox:**
- [ ] Feature parity with Chrome
- [ ] No browser-specific issues
- [ ] WebGL compatibility (for 3D)

**Safari:**
- [ ] iOS Safari compatibility
- [ ] Desktop Safari functionality
- [ ] Touch interactions work properly

**Edge:**
- [ ] Microsoft Edge compatibility
- [ ] Performance comparable to other browsers

### 8.3 Unusual User Behaviors
- [ ] Rapid clicking doesn't break game state
- [ ] Multiple piece selections handled correctly
- [ ] Back button during game transitions
- [ ] Page refresh at various game states

---

## 9. Post-Game Features

### 9.1 Game Analysis (if available)
- [ ] Post-game analysis screen appears
- [ ] Game moves can be reviewed
- [ ] AI commentary/analysis is provided
- [ ] Navigation between moves works

### 9.2 Game History
- [ ] Previous games can be accessed
- [ ] Game results are stored correctly
- [ ] PGN export functionality (if available)

---

## Testing Sign-off

**Tester:** _________________ **Date:** _____________

**Browser/Device Tested:** _____________________________

**Overall Assessment:**
- [ ] All critical functionality works correctly
- [ ] No blocking issues identified
- [ ] Performance is acceptable
- [ ] User experience is smooth

**Critical Issues Found:** ___________________________

**Recommendations:** ____________________________

---

## Quick Smoke Test (5-minute version)

For rapid validation, execute this minimal test:

1. [ ] Load home page - no errors
2. [ ] Click Play → Model selection appears
3. [ ] Select model → Continue → Game loads
4. [ ] Make one legal move (e2-e4)
5. [ ] AI responds within reasonable time
6. [ ] Make second move - game continues normally
7. [ ] Resign or start new game - functions work

**If all items pass: ✅ Basic functionality confirmed**  
**If any item fails: ⚠️ Investigation required**