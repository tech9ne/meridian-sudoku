import { candidatesFor, xychainStep, peersOf, Grid } from '../lib/sudoku';
import * as fs from 'fs';
type Step = { tech: string; cells: number[]; digits: number[]; place: number[] | null };
type Link = { from: [number, number]; to: [number, number]; kind: 'strong' | 'weak' };
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const snaps: { trace: Step[] }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
const LIM = Number(process.argv[2] ?? 10);
let bad = 0, chains = 0;
function peers(a: number, b: number): boolean { return a !== b && peersOf(a).includes(b); }
for (let n = 0; n < LIM; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const cand = g.map((v, i) => (v ? [v] : candidatesFor(g, i)));
  const trace = snaps[n].trace as Step[];
  for (let step = 0; step <= trace.length; step += 2) {
    const h = xychainStep(cand);
    if (h) {
      chains++;
      const ch = (h as any).chain as Link[] | undefined;
      if (!ch || !ch.length) { console.error(`NO CHAIN #${n} step ${step}`); bad++; }
      else {
        if (ch.length % 2 === 0 || ch[0].kind !== 'strong' || ch[ch.length - 1].kind !== 'strong') { console.error(`PARITY/ENDS #${n}`); bad++; }
        for (let k = 0; k < ch.length; k++) { if (ch[k].kind !== (k % 2 === 0 ? 'strong' : 'weak')) { console.error(`ALT #${n} k=${k}`); bad++; } }
        for (let k = 0; k < ch.length - 1; k++) { if (ch[k].to[0] !== ch[k + 1].from[0] || ch[k].to[1] !== ch[k + 1].from[1]) { console.error(`CONT #${n} k=${k}`); bad++; } }
        for (const l of ch) {
          const [c1, d1] = l.from, [c2, d2] = l.to;
          if (!cand[c1].includes(d1) || !cand[c2].includes(d2)) { console.error(`CAND #${n}`); bad++; }
          if (l.kind === 'strong') { if (c1 !== c2 || cand[c1].length !== 2 || cand[c1][0] + cand[c1][1] !== d1 + d2 || d1 === d2) { console.error(`STRONG #${n}`); bad++; } }
          else { if (c1 === c2 || d1 !== d2 || !peers(c1, c2)) { console.error(`WEAK #${n}`); bad++; } }
        }
        const dEnd = h.elim!.digits[0];
        if (ch[0].from[1] !== dEnd || ch[ch.length - 1].to[1] !== dEnd) { console.error(`ENDDIG #${n}`); bad++; }
        const e1 = ch[0].from[0], e2 = ch[ch.length - 1].to[0];
        for (const c of h.elim!.cells) if (!cand[c].includes(dEnd) || !peers(c, e1) || !peers(c, e2)) { console.error(`ELIM #${n}`); bad++; }
      }
    }
    if (step < trace.length) {
      const st = trace[step];
      if (st.place) { const [c, dd] = st.place; cand[c] = [dd]; for (let q = 0; q < 81; q++) if (q !== c && peers(q, c)) cand[q] = cand[q].filter(x => x !== dd); }
      if (st.cells.length) for (const c of st.cells) cand[c] = cand[c].filter(x => !st.digits.includes(x));
    }
  }
  console.log(`#${n} chains validated so far: ${chains}`);
}
console.log(bad ? `CHAINLINK_FAIL ${bad}` : `CHAINLINK_OK chains=${chains}`);
process.exit(bad ? 1 : 0);
