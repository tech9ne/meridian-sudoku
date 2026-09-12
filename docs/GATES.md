# Meridian Sudoku — Validation Gates

Engine: lib/sudoku.ts. Census: lib/spaces.ts (positional masks, RCBn house-major).
Corpus: scripts/corpus.json (200 puzzles). Baseline: scripts/snapshot.json (traces + grades).
All gates run from repo root: npx tsx scripts/<gate>.ts [args].

| # | Script | Proves | Pass token |
|---|--------|--------|-----------|
| 1 | parity-check.ts | Every corpus puzzle: engine solve equals DLX oracle; recorded trace steps sound | PARITY_OK |
| 2 | snapshot.ts | Re-records traces + grades under current engine. Run ONLY for deliberate re-baseline | SNAPSHOT_OK 200 puzzles |
| 3 | trace-validate.ts | Replays snapshot traces, re-derives each step's legality from board state | trace lines clean |
| 4 | board-check.ts | Board invariants: givens vs solution, unit uniqueness | board lines clean |
| 5 | grade-report.ts | Grade drift vs snapshot grade column | GRADE_SHIFTS {} |
| 6 | dof-check.ts N MAXDOF | Census coverage + soundness: every naked/hidden subset step in first N traces present in findAll table; no dup entries; dof=0 union/conflict sound | no COVERAGE MISS / UNSOUND lines |
| 7 | color-chains-check.ts N | Coloring components are valid conjugate chains; odd-cycle detection correct | COLORCHAIN_OK |
| 8 | chain-links-check.ts N | Exported AIC link lists: strong/weak alternation, continuity, strong=bivalue cell, weak=peer+same-digit, endpoint digit equals eliminated digit, elim cells see both endpoints | CHAINLINK_OK chains=N |

Generation gates (not blocking, measured each grading or generation change):
- gen-purity.ts: 12 samples per difficulty target, labeled via solveProfile. Baseline 2026-09-12: easy 12/12, medium 12/12, hard 11/12, diabolical 12/12.
- gen-timing.ts: per-puzzle generation latency. Budget: easy/medium < 0.5 s, hard/diabolical < 1.5 s.
- grade-tri.ts: three-way consistency gradeOf vs solveProfile label vs snapshot column; now-vs-prof must be {}.

## Recorded decisions
D1 2b rejected: exhaustive per-step findAll dispatch is sound but O(combinatorial); census lives in the validation layer and offline consumers only. Dispatch stays lazy/early-exit.
D2 Perf contract: findAll never in the per-step hot path. alsxzStep may call findAll(cand,1) because it sits behind tier-1, tier-2 and xy-chain in anyStep.
D3 Grading re-baseline: gradeOf = profile rule (maxSize axis for easy/medium, maxCls for hard, cls>=3 or unsolved for diabolical). Snapshot grade column rebuilt under verified grader; approval artifact = 22-move matrix measured against the live old grader.
D4 Marks-aware hint contract: engine candidate view = placed cells -> [], else player marks if non-empty, else full candidates. Hints advance when the player erases. Wrong marks mislead by design; check/conflict stays values-based.
D5 Strikes contract: a strike is a pending elimination — line-through while the candidate is still penciled; ghost after apply; pruned when marks exclude the digit; auto-apply commits skipped once via skipPrune.
D6 Highlight contract: flash persists until the next board mutation; skipClear consumes the hint's own auto-apply commit.
D7 Welcome contract: cold start shows mark + difficulty choice, timer frozen; ?p= share links bypass welcome; timer gated on running.
