import { candidatesFor, solveFully, peersOf, Grid } from '../lib/sudoku';
import { findAll } from '../lib/spaces';
import * as fs from 'fs';
type Step = { tech: string; cells: number[]; digits: number[]; place: number[] | null };
const KIND: Record<string, string> = { 'naked-pair': 'naked', 'naked-triple': 'naked', 'naked-quad': 'naked', 'hidden-pair': 'hidden', 'hidden-triple': 'hidden', 'hidden-quad': 'hidden' };
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const snaps: { trace: Step[] }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
const LIM = Number(process.argv[2] ?? 10);
const MAXDOF = Number(process.argv[3] ?? 0);
const HOUSES: number[][] = [];
for (let r = 0; r < 9; r++) HOUSES.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) HOUSES.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) HOUSES.push(Array.from({ length: 9 }, (_, k) => (((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + ((b % 3) * 3 + (k % 3))));
const sortJoin = (a: number[]) => a.slice().sort((x, y) => x - y).join(',');
let entries = 0, dual = 0, bad = 0;
const byDof: Record<string, number> = {};
for (let n = 0; n < LIM; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const cand = g.map((v, i) => (v ? [v] : candidatesFor(g, i)));
  const trace = snaps[n].trace as Step[];
  for (let step = 0; step <= trace.length; step++) {
    const need = step < trace.length && !!KIND[trace[step].tech];
    const table = need || step % 2 === 0 ? findAll(cand, MAXDOF) : null;
    if (table && step < trace.length) {
      const st = trace[step];
      const kind = KIND[st.tech];
      if (kind) {
        const t = table.find(e => {
          if (e.kind !== kind || e.dof !== 0) return false;
          const cellsMatch = kind === 'naked' ? st.cells.every(c => e.elimCells.includes(c)) : sortJoin(e.cells) === sortJoin(st.cells);
          const digitsMatch = kind === 'naked' ? sortJoin(e.digits) === sortJoin(st.digits) : sortJoin(e.elimDigits) === sortJoin(st.digits);
          return cellsMatch && digitsMatch;
        });
        if (!t) { console.error(`COVERAGE MISS #${n} step ${step}: ${st.tech} cells ${st.cells} digits ${st.digits}`); bad++; }
      }
    }
    if (table) {
      const keys = new Set<string>();
      for (const e of table) {
        entries++;
        const key = e.kind[0] + '|' + sortJoin(e.cells) + '|' + sortJoin(e.digits);
        if (keys.has(key)) { console.error(`DUP #${n}: ${key}`); bad++; }
        keys.add(key);
        if (e.applicable.length > 1) dual++;
        byDof[`${e.kind}/${e.dof}`] = (byDof[`${e.kind}/${e.dof}`] || 0) + 1;
        if (e.dof === 0) {
          if (e.kind === 'naked') {
            const uni = new Set<number>();
            for (const ci of e.cells) for (const d of cand[ci]) uni.add(d);
            if (uni.size !== e.cells.length || sortJoin([...uni]) !== sortJoin(e.digits)) { console.error(`UNSOUND-union #${n} naked ${e.cells}`); bad++; }
            for (const A of e.applicable) for (const ci of e.cells) if (!HOUSES[A].includes(ci)) { console.error(`UNSOUND-house #${n} naked ${e.cells} house ${A} cell ${ci}`); bad++; }
          } else {
            const inS = new Set(e.cells);
            for (const d of e.digits) for (const ci of HOUSES[e.origin]) if (cand[ci].includes(d) && !inS.has(ci)) { console.error(`UNSOUND-conf #${n} hidden ${e.cells} d=${d} cell ${ci}`); bad++; }
            for (const ci of e.cells) if (!e.digits.some(d => cand[ci].includes(d))) { console.error(`UNSOUND-empty #${n} hidden ${e.cells} cell ${ci}`); bad++; }
          }
        }
      }
    }
    if (step < trace.length) {
      const st = trace[step];
      if (st.place) { const [c, d] = st.place; cand[c] = [d]; for (const q of peersOf(c)) cand[q] = cand[q].filter(x => x !== d); }
      if (st.cells.length) for (const c of st.cells) cand[c] = cand[c].filter(x => !st.digits.includes(x));
    }
  }
  console.log(`#${n} done, entries so far ${entries}`);
}
console.log('entries', entries, 'dual-sector', dual, 'byDof', JSON.stringify(byDof));
console.log(bad ? `DOF_FAIL ${bad}` : 'DOF_OK');
process.exit(bad ? 1 : 0);
