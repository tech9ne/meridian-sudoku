# Collaborators

## StrmCkr
Contributions merged: positional-mask census (lib/spaces.ts) — RCBn house-major layout,
POPC/IDX bit tables, findAll dof enumeration; design basis of gate 6.

Work awaiting his acceptance:
1. 2c ALS-XZ census consumer (alsxzStep, lib/sudoku.ts): dof=1 naked entries as ALS, sizes 1..8, restricted-common X / elim Z logic, at=[A,B] for UI flash.
2. Grading re-baseline: gradeOf profile rule + TECH_PRICE (dof, cls, size) pricing table.
3. Hint UX contracts D4-D6 (marks-aware view, persistent highlight, pending strikes).

Open asks from him:
a. Almost-fish pricing to refine the cls-2 boundary in TECH_PRICE.
b. Sign-off on D2 perf contract.
c. Census change protocol: any new entry kind must add coverage rows and keep gate 6 green.

Process: gate-first. No engine change ships without gates 1-8 green and a reviewed
grade-report diff. Baselines (snapshot.json, corpus.json) are committed; re-records are
deliberate, named events (see D3).
