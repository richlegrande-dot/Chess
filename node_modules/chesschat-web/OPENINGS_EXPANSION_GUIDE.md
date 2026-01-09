# Chess Openings Expansion Guide

**Purpose**: How to add more openings to the ChessChatWeb Openings Preview Modal

**Current Status**: 5 openings → Ready to expand to 50+

---

## Quick Start: Adding a New Opening

### Step 1: Edit the Data File

Open `src/data/openings.seed.ts` and add a new entry to the `OPENINGS_SEED` array:

```typescript
{
  id: 'london-system',           // Unique kebab-case identifier
  name: 'London System',         // Display name
  eco: 'D02',                    // ECO code (optional but recommended)
  movesSAN: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],  // Move sequence in SAN notation
  description: 'A solid system for White with early Bf4.'  // Brief description (optional)
}
```

### Step 2: Validate the Moves

Run the automated tests to ensure your moves are valid:

```bash
cd ChessChatWeb
npx vitest run src/test/openings.test.ts
```

**Expected**: All tests pass, including validation for your new opening.

### Step 3: Manual Testing

Start the dev server and test in the browser:

```bash
npm run dev
```

Then:
1. Navigate to http://localhost:5173
2. Enter Coaching Mode
3. Click "📚 Openings" button
4. Find your new opening in the list
5. Step through moves using Next/Previous
6. Verify the board updates correctly

---

## Data Format Specification

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | `string` | Unique identifier (kebab-case) | `'kings-indian-defense'` |
| `name` | `string` | Display name | `'King\'s Indian Defense'` |
| `movesSAN` | `string[]` | Array of SAN moves | `['d4', 'Nf6', 'c4', 'g6']` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `eco` | `string` | ECO classification code | `'E60'` |
| `description` | `string` | Brief description | `'A hypermodern defense for Black.'` |

---

## SAN Notation Rules

### Valid SAN Examples

- **Pawn moves**: `e4`, `d5`, `c4`
- **Piece moves**: `Nf3` (knight), `Bc4` (bishop), `Qd4` (queen)
- **Captures**: `exd5`, `Nxe5`, `Bxf7+`
- **Castling**: `O-O` (kingside), `O-O-O` (queenside)
- **Promotions**: `e8=Q`, `d1=N+`
- **Check/Checkmate**: `Qh5+` (check), `Qf7#` (checkmate)

### Invalid Examples

❌ `e2-e4` (long algebraic notation - use `e4`)  
❌ `Nf6-e4` (long algebraic notation - use `Ne4` or `Nxe4`)  
❌ `e4.` (extra period - use `e4`)  
❌ `1. e4` (move numbers - use `e4`)

---

## ID Naming Conventions

### Format

Use **kebab-case** (lowercase with hyphens):

✅ `italian-game`  
✅ `ruy-lopez`  
✅ `sicilian-defense-najdorf`  
✅ `queens-gambit-declined`

### Requirements

- Must be unique across all openings
- No spaces or special characters (except hyphens)
- Should match the opening name logically
- Keep it concise but descriptive

---

## ECO Codes (Optional but Recommended)

**ECO** = Encyclopedia of Chess Openings classification

### Format

- Always uppercase letter + 2 digits
- Examples: `C50`, `E60`, `B90`, `D06`

### Common Ranges

- **A**: Flank openings (1. Nf3, 1. c4, etc.)
- **B**: 1. e4 without 1...e5 (Sicilian, French, etc.)
- **C**: 1. e4 e5 (Italian, Ruy Lopez, etc.)
- **D**: Queen's Gambit (1. d4 d5 2. c4)
- **E**: Indian Defenses (1. d4 Nf6)

**Lookup**: Use [365chess.com](https://www.365chess.com/eco.php) or [chessgames.com](https://www.chessgames.com/perl/chessopening) to find ECO codes.

---

## Description Guidelines

### Best Practices

- Keep it **short** (1-2 sentences max)
- Focus on **key characteristics** or strategic ideas
- Mention **who plays it** (White/Black)
- Avoid jargon for beginners

### Good Examples

✅ `"A solid opening for White with rapid piece development."`  
✅ `"Black's most popular response, leading to sharp tactical play."`  
✅ `"A hypermodern defense where Black controls the center from a distance."`

### Poor Examples

❌ `"The Italian Game is an opening..."`(too verbose)  
❌ `"Involves Bf4 and later c3"` (too technical)  
❌ `"Popular"` (too vague)

---

## Validation Workflow

### Automated Tests

The test suite validates:
- ✅ Unique IDs
- ✅ All required fields present
- ✅ SAN moves are legal
- ✅ Move sequences apply without errors

**Run tests**:
```bash
npx vitest run src/test/openings.test.ts
```

### Manual Validation Checklist

- [ ] Opening appears in the list
- [ ] Name and ECO code display correctly
- [ ] All moves can be stepped through with Next button
- [ ] Previous button works correctly
- [ ] Reset returns to starting position
- [ ] No console errors
- [ ] Description is readable and helpful

---

## Common Issues and Fixes

### Issue: "Invalid move at ply X"

**Cause**: SAN notation is incorrect or illegal at that position

**Fix**:
1. Open https://lichess.org/editor
2. Manually play through the moves
3. Identify which move fails
4. Correct the SAN notation

### Issue: "Duplicate ID error"

**Cause**: Another opening uses the same `id`

**Fix**: Choose a more specific ID (e.g., `sicilian-defense-dragon` instead of `sicilian`)

### Issue: Opening doesn't appear in list

**Cause**: Syntax error in `openings.seed.ts`

**Fix**:
1. Check for missing commas between entries
2. Ensure proper closing brackets `}`
3. Run `npm run type-check` to find TypeScript errors

### Issue: Moves look wrong on board

**Cause**: Moves are in wrong order or use wrong notation

**Fix**: Verify move sequence on [lichess.org](https://lichess.org) or [chess.com](https://chess.com)

---

## Example: Adding Multiple Openings

```typescript
// In src/data/openings.seed.ts
export const OPENINGS_SEED: Opening[] = [
  // ... existing openings ...
  
  {
    id: 'caro-kann-defense',
    name: 'Caro-Kann Defense',
    eco: 'B10',
    movesSAN: ['e4', 'c6', 'd4', 'd5'],
    description: 'A solid defense for Black with early ...c6.'
  },
  {
    id: 'kings-indian-defense',
    name: "King's Indian Defense",
    eco: 'E60',
    movesSAN: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'],
    description: 'A hypermodern defense leading to sharp kingside attacks.'
  },
  {
    id: 'english-opening',
    name: 'English Opening',
    eco: 'A10',
    movesSAN: ['c4', 'e5', 'Nc3', 'Nf6'],
    description: 'A flexible flank opening often transposing to other systems.'
  }
];
```

---

## Scaling Considerations

### Performance

- ✅ **Current**: 5 openings → instant load
- ✅ **Target**: 50 openings → still fast (< 100ms)
- ✅ **Search**: Filters 50+ openings in < 10ms

### UX Recommendations

When adding 50+ openings:
- Group by ECO code (A, B, C, D, E sections)
- Add sorting options (alphabetical, ECO, popularity)
- Consider adding "favorite" feature
- Add opening categories (e.g., "King Pawn", "Queen Pawn", "Flank")

---

## Resources

### Finding Opening Lines

- [Lichess Opening Explorer](https://lichess.org/analysis) - Free, accurate move sequences
- [Chess.com Opening Explorer](https://www.chess.com/explorer) - Popular lines
- [365chess ECO Database](https://www.365chess.com/eco.php) - ECO codes and lines

### Validating Moves

1. Go to https://lichess.org/editor
2. Play through your move sequence
3. Copy the final position's FEN
4. Paste into opening preview to verify

### ECO Code Lookup

- [ChessGames ECO Codes](https://www.chessgames.com/perl/chessopening)
- [Wikipedia ECO List](https://en.wikipedia.org/wiki/List_of_chess_openings)

---

## Quality Checklist

Before committing new openings:

- [ ] All IDs are unique
- [ ] All moves use correct SAN notation
- [ ] ECO codes are accurate (verified with external source)
- [ ] Descriptions are clear and concise
- [ ] Tests pass: `npx vitest run src/test/openings.test.ts`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Manually tested in browser
- [ ] No console errors during navigation

---

## Getting Help

If you encounter issues:

1. **Check the test output**: `npx vitest run src/test/openings.test.ts`
2. **Review this guide's "Common Issues" section**
3. **Validate moves on Lichess**: https://lichess.org/editor
4. **Check browser console** for JavaScript errors

---

**Last Updated**: January 9, 2026  
**Maintained By**: ChessChatWeb Development Team
