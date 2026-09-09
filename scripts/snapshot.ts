import { generateGraded, gradeOf, solveTrace, Diff } from '../lib/sudoku';
import * as fs from 'fs';
const DIFFS: Diff[] = ['easy', 'medium', 'hard', 'diabolical'];
const corpus: string[] = [];
const snaps: { p: string; grade: string; trace: unknown[] }[] = [];
for (let n = 0; n < 200; n++) {
  const g = generateGraded(DIFFS[n % 4]);
  const p = g.puzzle.join('');
  corpus.push(p);
  snaps.push({ p, grade: gradeOf(g.puzzle), trace: solveTrace(g.puzzle) });
}
fs.writeFileSync('scripts/corpus.json', JSON.stringify(corpus));
fs.writeFileSync('scripts/snapshot.json', JSON.stringify(snaps));
console.log('SNAPSHOT_OK', snaps.length, 'puzzles');
