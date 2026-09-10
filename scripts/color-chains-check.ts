import { candidatesFor, coloringStep, colorChains, Grid } from '../lib/sudoku';
import * as fs from 'fs';
type Step = { tech: string; cells: number[]; digits: number[]; place: number[] | null };
const UN: number[][] = [];
for (let r = 0; r < 9; r++) UN.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UN.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) UN.push(Array.from({ length: 9 }, (_, k) => (((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + ((b % 3) * 3 + (k % 3))));
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const snaps: { trace: Step[] }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
const LIM = Number(process.argv[2] ?? 25);
let bad = 0, comps = 0;
function derive(cand: number[][]): { cells: number[]; digits: number[]; rule: number } | null {
  for (let d = 1; d <= 9; d++) {
    const adj = new Map<number, number[]>();
    for (const u of UN) { const cs = u.filter(i => cand[i].includes(d)); if (cs.length === 2) { adj.set(cs[0], [...(adj.get(cs[0]) || []), cs[1]]); adj.set(cs[1], [...(adj.get(cs[1]) || []), cs[0]]); } }
    const col = new Map<number, 0 | 1>(); const comp = new Map<number, number>(); let cid = 0;
    let conflict = -1, conflictComp = -1;
    for (const st of adj.keys()) { if (col.has(st)) continue; cid++; col.set(st, 0); comp.set(st, cid); const q = [st];
      while (q.length) { const cur = q.pop()!; for (const nb of adj.get(cur) || []) { const want = (1 - col.get(cur)!) as 0 | 1; if (!col.has(nb)) { col.set(nb, want); comp.set(nb, cid); q.push(nb); } else if (col.get(nb) !== want && conflict === -1) { conflict = col.get(nb)!; conflictComp = cid; } } } }
    if (conflict !== -1) { const cells = [...col.entries()].filter(([j, c]) => c === conflict && comp.get(j) === conflictComp).map(([j]) => j); if (cells.length) return { cells, digits: [d], rule: 2 }; }
    for (let i = 0; i < 81; i++) { if (!cand[i].includes(d) || col.has(i)) continue;
      let j0 = -1, j1 = -1;
      for (const [j, c] of col.entries()) { if (!peers(i, j)) continue; if (c === 0 && j0 < 0) j0 = j; if (c === 1 && j1 < 0) j1 = j; }
      if (j0 >= 0 && j1 >= 0 && comp.get(j0) === comp.get(j1)) return { cells: [i], digits: [d], rule: 1 }; }
  }
  return null;
}
function peers(a: number, b: number): boolean { if (a === b) return false; const ra = (a / 9) | 0, ca = a % 9, rb = (b / 9) | 0, cb = b % 9; return ra === rb || ca === cb || ((ra / 3) | 0) === ((rb / 3) | 0) && ((ca / 3) | 0) === ((cb / 3) | 0); }
for (let n = 0; n < LIM; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const cand = g.map((v, i) => (v ? [v] : candidatesFor(g, i)));
  const trace = snaps[n].trace as Step[];
  for (let step = 0; step <= trace.length; step += 2) {
    const state = step === 0 ? cand : cand; // sampled replay below mutates cand in place
    for (let d = 1; d <= 9; d++) for (let i = 0; i < 81; i++) {
      const ch = colorChains(state, i, d);
      if (!ch) continue;
      comps++;
      for (const u of UN) { const cs = u.filter(x => state[x].includes(d)); if (cs.length !== 2) continue;
        const [a, b] = cs;
        if (ch.colorOf[a] >= 0 && ch.colorOf[b] >= 0 && !ch.conflict && ch.colorOf[a] === ch.colorOf[b]) { console.error(`ALTERNATION VIOLATION #${n} d=${d} ${a},${b}`); bad++; } }
    }
    const mine = derive(state);
    const eng = coloringStep(state);
    const engC = eng && eng.tech === 'coloring' ? { cells: eng.elim!.cells, digits: eng.elim!.digits } : null;
    const mC = mine ? { cells: mine.cells, digits: mine.digits } : null;
    if (JSON.stringify(engC?.cells.slice().sort((a, b) => a - b)) !== JSON.stringify(mC?.cells.slice().sort((a, b) => a - b)) || JSON.stringify(engC?.digits) !== JSON.stringify(mC?.digits)) {
      console.error(`EQUIV MISS #${n} step ${step}: engine=${JSON.stringify(engC)} derived=${JSON.stringify(mC)}`); bad++;
    }
    if (step < trace.length) {
      const st = trace[step];
      if (st.place) { const [c, dd] = st.place; cand[c] = [dd]; for (let q = 0; q < 81; q++) if (q !== c && peers(q, c)) cand[q] = cand[q].filter(x => x !== dd); }
      if (st.cells.length) for (const c of st.cells) cand[c] = cand[c].filter(x => !st.digits.includes(x));
    }
  }
  console.log(`#${n} done, components painted-checks ${comps}`);
}
console.log(bad ? `COLORCHAIN_FAIL ${bad}` : 'COLORCHAIN_OK');
process.exit(bad ? 1 : 0);
