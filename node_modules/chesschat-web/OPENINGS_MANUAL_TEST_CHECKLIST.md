# Openings Feature Manual Test Checklist

## Test Environment Setup
- [ ] Navigate to ChessChatWeb in browser (dev server running)
- [ ] Open Coaching Mode
- [ ] Ensure browser console is open (F12) to check for errors

---

## 1. Modal Opening & Closing

### Test 1.1: Opening the Modal
- [ ] Click the "📚 Openings" button in Coaching Mode
- [ ] **Expected**: Modal overlay appears with dark gradient background
- [ ] **Expected**: Modal slides up with fade-in animation
- [ ] **Expected**: Modal shows "📚 Chess Openings Preview" header
- [ ] **Expected**: Left panel shows 5 openings list
- [ ] **Expected**: Right panel shows Italian Game (first opening) by default
- [ ] **Expected**: Chessboard displays starting position

### Test 1.2: Closing the Modal
- [ ] Click the "✕" close button in top-right corner
- [ ] **Expected**: Modal closes smoothly
- [ ] **Expected**: Returns to Coaching Mode (game state unchanged)
- [ ] **Expected**: No console errors

### Test 1.3: Close by Overlay Click
- [ ] Open modal again
- [ ] Click on the dark overlay area (outside modal content)
- [ ] **Expected**: Modal closes
- [ ] **Expected**: Game state unchanged

---

## 2. Opening Selection

### Test 2.1: View All Openings
- [ ] Open the modal
- [ ] Verify all 5 openings are visible in left panel:
  - [ ] Italian Game (C50)
  - [ ] Ruy Lopez (C60)
  - [ ] Sicilian Defense - Najdorf (B90)
  - [ ] French Defense (C00)
  - [ ] Queen's Gambit (D06)
- [ ] **Expected**: Each opening shows name, ECO code, and description

### Test 2.2: Select Different Opening
- [ ] Click on "Ruy Lopez"
- [ ] **Expected**: Ruy Lopez becomes highlighted/selected
- [ ] **Expected**: Board resets to starting position
- [ ] **Expected**: Move counter shows "Move 0 of 10"
- [ ] **Expected**: Opening name changes to "Ruy Lopez" with C60 badge
- [ ] **Expected**: Move list shows all Ruy Lopez moves

### Test 2.3: Switch Between Multiple Openings
- [ ] Click Italian Game → then Sicilian → then French → then Queen's Gambit
- [ ] **Expected**: Each switch resets the board and move counter
- [ ] **Expected**: No visual glitches
- [ ] **Expected**: No console errors

---

## 3. Board Coordinate Display

### Test 3.1: Verify File Labels (A-H)
- [ ] Look at the bottom row of the chessboard
- [ ] **Expected**: Bottom-right corner of each square shows file letters
- [ ] **Expected**: Files go from A (left) to H (right)
- [ ] **Expected**: Labels visible but subtle (not obtrusive)
- [ ] Verify order: A B C D E F G H (left to right)

### Test 3.2: Verify Rank Labels (1-8)
- [ ] Look at the leftmost column of the chessboard
- [ ] **Expected**: Top-left corner of each square shows rank numbers
- [ ] **Expected**: Ranks go from 8 (top) to 1 (bottom)
- [ ] **Expected**: Labels visible but subtle
- [ ] Verify order: 8 7 6 5 4 3 2 1 (top to bottom)

### Test 3.3: Verify A1 Position
- [ ] Find the square labeled "A" (file) and "1" (rank)
- [ ] **Expected**: A1 is in the BOTTOM-LEFT corner
- [ ] **Expected**: In starting position, A1 contains White Rook (♖)

### Test 3.4: Verify H8 Position
- [ ] Find the square labeled "H" (file) and "8" (rank)
- [ ] **Expected**: H8 is in the TOP-RIGHT corner
- [ ] **Expected**: In starting position, H8 contains Black Rook (♜)

### Test 3.5: Verify Coordinate Colors
- [ ] **Expected**: On light squares, coordinates are dark brown
- [ ] **Expected**: On dark squares, coordinates are light beige
- [ ] **Expected**: Coordinates are readable without squinting

---

## 4. Move Navigation - Previous Button

### Test 4.1: Previous at Starting Position
- [ ] Select any opening
- [ ] Ensure you're at "Move 0 of X" (starting position)
- [ ] **Expected**: Previous button is DISABLED (grayed out)
- [ ] Try clicking it anyway
- [ ] **Expected**: Nothing happens

### Test 4.2: Previous After Moving Forward
- [ ] Click "Next" 3 times (go to move 3)
- [ ] Click "Previous" once
- [ ] **Expected**: Counter shows "Move 2 of X"
- [ ] **Expected**: Board updates to show position after 2 moves
- [ ] **Expected**: Move list highlights move 2

### Test 4.3: Previous Multiple Times
- [ ] Click "Next" to move 5
- [ ] Click "Previous" 5 times rapidly
- [ ] **Expected**: Counter decrements correctly each click
- [ ] **Expected**: Board updates smoothly
- [ ] **Expected**: Eventually reaches "Move 0 of X" (starting position)
- [ ] **Expected**: Previous button becomes disabled

---

## 5. Move Navigation - Next Button

### Test 5.1: Next from Starting Position
- [ ] Ensure at starting position (Move 0)
- [ ] **Expected**: Next button is ENABLED
- [ ] Click "Next" once
- [ ] **Expected**: Counter shows "Move 1 of X"
- [ ] **Expected**: First move is made on board
- [ ] **Expected**: Move list highlights move 1

### Test 5.2: Next Through Full Opening
- [ ] Select "Italian Game" (6 moves)
- [ ] Click "Next" 6 times
- [ ] **Expected**: Counter goes from 0 → 1 → 2 → 3 → 4 → 5 → 6
- [ ] **Expected**: Board updates after each click
- [ ] **Expected**: At move 6, Next button becomes DISABLED

### Test 5.3: Next at Final Position
- [ ] Ensure you're at the final move (Next button disabled)
- [ ] Try clicking Next
- [ ] **Expected**: Nothing happens
- [ ] **Expected**: Counter stays at max (e.g., "Move 10 of 10")

### Test 5.4: Next with Longer Opening
- [ ] Select "Ruy Lopez" (10 moves)
- [ ] Click "Next" rapidly 10 times
- [ ] **Expected**: Reaches "Move 10 of 10"
- [ ] **Expected**: Board shows final position correctly
- [ ] **Expected**: No errors in console

---

## 6. Move Navigation - Reset Button

### Test 6.1: Reset from Middle Position
- [ ] Click "Next" 4 times (go to move 4)
- [ ] Click "Reset"
- [ ] **Expected**: Counter immediately shows "Move 0 of X (Starting Position)"
- [ ] **Expected**: Board shows starting position
- [ ] **Expected**: Move list shows no moves highlighted
- [ ] **Expected**: Previous button is disabled
- [ ] **Expected**: Next button is enabled

### Test 6.2: Reset from Final Position
- [ ] Click "Next" until at final move
- [ ] Click "Reset"
- [ ] **Expected**: Returns to starting position
- [ ] **Expected**: Can use Next button again

### Test 6.3: Reset at Starting Position
- [ ] Ensure at starting position
- [ ] **Expected**: Reset button is DISABLED
- [ ] Try clicking anyway
- [ ] **Expected**: Nothing happens (stays at start)

---

## 7. Board State Verification

### Test 7.1: Italian Game Final Position
- [ ] Select "Italian Game"
- [ ] Click "Next" 6 times to final position
- [ ] Verify piece positions:
  - [ ] White Bishop on c4
  - [ ] White Knight on f3
  - [ ] White pawn on e4
  - [ ] Black Bishop on c5
  - [ ] Black Knight on c6
  - [ ] Black pawn on e5

### Test 7.2: Ruy Lopez Castling
- [ ] Select "Ruy Lopez"
- [ ] Click "Next" 9 times (after O-O move)
- [ ] **Expected**: White King on g1
- [ ] **Expected**: White Rook on f1
- [ ] **Expected**: Castling happened correctly

### Test 7.3: Sicilian Pawn Capture
- [ ] Select "Sicilian Defense - Najdorf"
- [ ] Click "Next" until move 6 (cxd4)
- [ ] **Expected**: The c5 pawn captured on d4
- [ ] **Expected**: No pawn on c5 anymore
- [ ] **Expected**: Correct piece arrangement

---

## 8. Move List Display

### Test 8.1: Move List Formatting
- [ ] Select any opening
- [ ] Look at the "Moves:" section at bottom
- [ ] **Expected**: Moves are formatted with numbers (e.g., "1. e4 e5 2. Nf3 Nc6")
- [ ] **Expected**: Move numbers appear before white's move
- [ ] **Expected**: Moves are easy to read

### Test 8.2: Current Move Highlighting
- [ ] Click "Next" 3 times
- [ ] Look at the move list
- [ ] **Expected**: The 3rd move is highlighted (different color/background)
- [ ] **Expected**: Moves before it appear "played" (dimmed)
- [ ] **Expected**: Moves after it appear unplayed

### Test 8.3: Move List Updates
- [ ] Click "Next" and watch the move list
- [ ] **Expected**: Highlight moves to next move immediately
- [ ] Click "Previous"
- [ ] **Expected**: Highlight moves to previous move
- [ ] **Expected**: No lag or delay

---

## 9. Move Counter Display

### Test 9.1: Starting Position Label
- [ ] Reset to starting position
- [ ] **Expected**: Counter shows "Move 0 of X (Starting Position)"
- [ ] **Expected**: "(Starting Position)" text is visible

### Test 9.2: Move Counter During Navigation
- [ ] For Italian Game (6 moves):
  - [ ] At start: "Move 0 of 6"
  - [ ] After 1st Next: "Move 1 of 6"
  - [ ] After 3rd Next: "Move 3 of 6"
  - [ ] After 6th Next: "Move 6 of 6"

### Test 9.3: Counter Updates Immediately
- [ ] Click "Next" rapidly
- [ ] **Expected**: Counter updates on every click without lag

---

## 10. Error Handling

### Test 10.1: No Console Errors on Normal Use
- [ ] Open modal, select openings, navigate moves, close modal
- [ ] **Expected**: No errors in browser console
- [ ] **Expected**: No warnings about invalid moves

### Test 10.2: Invalid SAN Detection (Edge Case)
- [ ] This is handled in the code, but verify:
- [ ] All 5 openings load without error banners
- [ ] **Expected**: No "Invalid move at ply X" banners appear

---

## 11. Modal Styling & UX

### Test 11.1: Modal Appearance
- [ ] **Expected**: Dark gradient background (matches app theme)
- [ ] **Expected**: Rounded corners on modal
- [ ] **Expected**: Drop shadow visible
- [ ] **Expected**: Modal is centered on screen

### Test 11.2: Button Hover Effects
- [ ] Hover over Previous/Next/Reset buttons
- [ ] **Expected**: Background color changes on hover
- [ ] **Expected**: Slight scale or shadow effect
- [ ] Hover over opening items in list
- [ ] **Expected**: Border color changes

### Test 11.3: Disabled Button Appearance
- [ ] **Expected**: Disabled buttons have reduced opacity
- [ ] **Expected**: Disabled buttons show "not-allowed" cursor
- [ ] **Expected**: Clear visual difference between enabled/disabled

### Test 11.4: Responsive Layout
- [ ] Resize browser window to narrow width
- [ ] **Expected**: Modal adjusts size gracefully
- [ ] **Expected**: Board scales appropriately
- [ ] **Expected**: No overflow or horizontal scrolling issues

---

## 12. Game State Isolation

### Test 12.1: Preview Doesn't Affect Game
- [ ] In Coaching Mode, make a move (e.g., e2-e4)
- [ ] Open Openings modal
- [ ] Navigate through an opening (click Next several times)
- [ ] Close modal
- [ ] **Expected**: Your game shows only the e2-e4 move
- [ ] **Expected**: Board position matches your actual game (not opening preview)

### Test 12.2: Multiple Modal Opens
- [ ] Open modal, navigate to move 5, close modal
- [ ] Open modal again
- [ ] **Expected**: Modal resets to starting position (ply 0) or first opening
- [ ] **Expected**: Does not remember previous navigation state

---

## 13. Debug Info (Optional)

### Test 13.1: Expand Debug Info
- [ ] Click the "Debug Info" dropdown at bottom
- [ ] **Expected**: Shows "Current FEN" and "History"
- [ ] **Expected**: FEN string updates as you navigate
- [ ] **Expected**: History shows move list

### Test 13.2: FEN Accuracy
- [ ] Select Italian Game, go to move 6
- [ ] Expand Debug Info
- [ ] Copy the FEN string
- [ ] Paste into chess.com analysis board
- [ ] **Expected**: Position matches exactly

---

## 14. Performance

### Test 14.1: Smooth Navigation
- [ ] Rapidly click "Next" 10 times
- [ ] **Expected**: Board updates smoothly (no lag)
- [ ] **Expected**: No frame drops or stuttering

### Test 14.2: Opening Switching Speed
- [ ] Rapidly switch between all 5 openings
- [ ] **Expected**: Instant response on selection
- [ ] **Expected**: Board resets immediately

### Test 14.3: No Memory Leaks
- [ ] Open and close modal 10 times
- [ ] **Expected**: No performance degradation
- [ ] **Expected**: Page remains responsive

---

## 15. Accessibility

### Test 15.1: Keyboard Navigation (Nice to Have)
- [ ] Try pressing Tab while modal is open
- [ ] **Expected**: Focus moves between interactive elements
- [ ] Try pressing Escape
- [ ] **Expected**: Modal closes (if implemented)

### Test 15.2: Button Tooltips
- [ ] Hover over buttons
- [ ] **Expected**: Tooltips or title attributes show purpose

---

## 16. Edge Cases

### Test 16.1: Disabled Button Clicks
- [ ] Ensure Previous is disabled (at start)
- [ ] Click it multiple times rapidly
- [ ] **Expected**: Nothing happens, no errors

### Test 16.2: Quick Opening Switching
- [ ] Click Italian Game → immediately click Sicilian → immediately click Queen's Gambit
- [ ] **Expected**: Board updates correctly to Queen's Gambit
- [ ] **Expected**: No visual glitches or race conditions

### Test 16.3: Opening/Closing Rapidly
- [ ] Open modal → close immediately → open again → close
- [ ] **Expected**: Modal state resets correctly each time
- [ ] **Expected**: No state carryover

---

## 17. Cross-Browser Testing (If Possible)

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (Mac)
- [ ] Test in Edge
- [ ] **Expected**: Consistent appearance and functionality

---

## 18. Mobile Responsiveness (If Applicable)

- [ ] Open on mobile device or use browser DevTools mobile view
- [ ] **Expected**: Modal scales to fit screen
- [ ] **Expected**: Touch interactions work (tap to select, tap buttons)
- [ ] **Expected**: Board remains visible and readable

---

## Summary Checklist

After completing all tests:

- [ ] All 5 openings display correctly
- [ ] Board coordinates (A-H, 1-8) are visible and correct
- [ ] Previous/Next/Reset buttons work as expected
- [ ] Button disabled states are correct
- [ ] Move counter updates accurately
- [ ] Board position updates match move navigation
- [ ] No console errors during any test
- [ ] Modal opens and closes smoothly
- [ ] Game state is not affected by preview
- [ ] All chess piece symbols display correctly

---

## Acceptance Criteria Final Check

✅ **Criterion 1**: Clicking Openings opens the modal  
✅ **Criterion 2**: Modal shows A-H/1-8 grid coordinates  
✅ **Criterion 3**: Selecting one of 5 openings loads it  
✅ **Criterion 4**: Next/Previous steps through moves and updates board  
✅ **Criterion 5**: Reset works  
✅ **Criterion 6**: No changes to actual ongoing game state  
✅ **Criterion 7**: Code is ready to expand to 50+ openings  

---

## Bug Report Template

If you find issues during testing, use this format:

**Bug**: [Brief description]  
**Test**: [Which test number]  
**Steps to Reproduce**:  
1. ...  
2. ...  

**Expected**: ...  
**Actual**: ...  
**Console Errors**: [Yes/No - paste error if yes]  
**Screenshot**: [If applicable]  

---

**Test Date**: _____________  
**Tested By**: _____________  
**Browser**: _____________  
**Pass/Fail**: _____________
