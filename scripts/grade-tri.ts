import { gradeOf, solveProfile, Grid } from '../lib/sudoku';
import * as fs from 'fs';
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const snap: { grade: string }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
const label = (p: { solved: boolean; maxCls: number; maxSize: number }) =>
  !p.solved ? 'diabolical' : p.maxCls >= 3 ? 'diabolical' : p.maxCls === 2 ? 'hard' : p.maxSize >= 2 ? 'medium' : 'easy';
const tNS: Record<string, number> = {}, tPS: Record<string, number> = {}, tNP: Record<string, number> = {};
let shown = 0;
for (let n = 0; n < corpus.length; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const now = gradeOf(g), prof = label(solveProfile(g)), sn = snap[n].grade;
  if (now !== sn) tNS[`${sn}->${now}`] = (tNS[`${sn}->${now}`] || 0) + 1;
  if (prof !== sn) tPS[`${sn}->${prof}`] = (tPS[`${sn}->${prof}`] || 0) + 1;
  if (now !== prof) { tNP[`now=${now} prof=${prof}`] = (tNP[`now=${now} prof=${prof}`] || 0) + 1; if (shown++ < 3) console.log(`MISMATCH #${n}: now=${now} prof=${prof} snap=${sn}`); }
}
console.log('now-vs-snap', JSON.stringify(tNS));
console.log('prof-vs-snap', JSON.stringify(tPS));
console.log('now-vs-prof', JSON.stringify(tNP));
