# Meridian Sudoku

A self-contained Sudoku player with a **Tier 0–3 logical hint engine**, built as part of the Meridian newsroom portfolio. Zero server, zero network calls, zero tracking — open `index.html` in any modern browser and play.

## Play it

Live at: [https://tech9ne.github.io/meridian-sudoku/](https://tech9ne.github.io/meridian-sudoku/)

Or download `index.html` and run it offline. Theme choice persists in `localStorage`.

## The engine (`src/sudoku.ts`)

### Generator
- Backtracking grid-fill followed by **iterative digging** that only accepts removals that preserve a unique solution (`countSolutions([...p]) === 1`).
- **Grade-targeted digging**: for a requested difficulty, the generator refuses any removal that would push the puzzle's technique tier above the target, then keeps digging until the true grade *matches* the target (with retries across shuffles and a closest-match fallback for `diabolical`).
- Share-via-URL: `?p=<81-char grid string>` encodes any puzzle.

### Solver / hint engine
The hint button applies the first matching technique from this ladder, reports it by name with `r#c#` board coordinates, and flashes the subject cells green for ~2.6 s.

**Tier 0 — singles**
- Naked single, hidden single

**Tier 1 — basic elimination**
- Naked pair, hidden pair
- Pointing pairs (box→line)
- Box/line reduction (claiming, line→box)

**Tier 2 — pattern recognition**
- Fish: X-wing / Swordfish / Jellyfish (sizes 2–4)
- Skyscraper
- Two-string kite
- Simple coloring (conjugate chains, contradiction + both-colors-sees elimination)
- XY-wing, W-wing, XYZ-wing
- Unique rectangle (type 1)
- BUG+1

**Tier 3 — chains and sets**
- XY-chain (length ≤ 8)
- ALS-XZ
- Cell-forcing chains
- Nishio (assume-contradiction elimination, labeled as such)

### Grading
`gradeOf` runs the Tier 0+1 logical solver; if it stalls, probes Tier 2; if that also stalls, grades `diabolical`.

| Grade | Required technique |
|---|---|
| Easy | Singles only |
| Medium | Locked candidates or subsets |
| Hard | A Tier-2 pattern |
| Diabolical | Tier-2 stalls — chains, ALS, or guessing |

### Not implemented (deliberately)
Finned/sashimi fish, mutant/Franken fish, general AICs beyond XY-chain, ALS-XY-wing/deathblossom, set-logic/rank-0, guardians. These would extend the engine to Tier 4; the current ladder matches HoDoKu's "advanced" tier.

## The player (`src/Sudoku.tsx`)

- **Two input paradigms, explicit toggle:**
  - *Digit-first* (default): tap a digit to arm, tap cells to stamp. Pad taps never write to a cell, eliminating the "stray tap overwrites correct entry" bug class.
  - *Cell-first*: tap cell, tap digit. Each write deselects the cell — stray second taps are no-ops.
- **Red/orange highlighting** from Enjoy Sudoku / Sudoku Joy: arm a digit → every cell where it is a candidate floods red; every placed instance of it turns orange. Fish, AICs, ALS become visible patterns.
- **Live candidates** (default): pencil marks are maintained incrementally — placements prune peers, hints prune targets — so the red map, marks, and board never disagree. "Auto candidates" in the overflow menu remains as an explicit reset.
- **Check** validates entered digits against the solution and flags only incorrect entries (red digit + corner dot) without revealing the right answer.
- **Undo/redo** stack, pause, timer, hints with coordinates, share link.
- **Four themes** via CSS variables: Meridian (copper), Midnight (blue/cyan), Forest (green/lime), Sepia (brown/amber).
- **Box-gutter board**: nine 3×3 houses separated by colored gutters, with hairline cell separators — house boundaries cannot be mispositioned.

## Rebuild

If you change the source, rebuild the bundle with Node ≥ 18 and esbuild:

```bash
npm install
npm run build            # produces Tailwind CSS in .next/static/css
node standalone/build.js # inlines JS + CSS into sudoku-export/index.html
```

## License / attribution

Original code. The hint-engine technique names and logic follow the public Sudoku community canon (HoDoKu, SudokuWiki/Sudopedia, pencil-mark literature). The red/orange highlighting style is a nod to *Enjoy Sudoku* by Jason Lin (discontinued) — the technique outlives the app.
