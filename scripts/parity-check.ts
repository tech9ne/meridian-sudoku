import { gradeOf, solveTrace, Grid } from '../lib/sudoku';
import * as fs from 'fs';
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const before: { p: string; grade: string; trace: unknown[] }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
let fails = 0;
for (let n = 0; n < corpus.length; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const grade = gradeOf(g);
  const trace = solveTrace(g);
  if (grade !== before[n].grade) { console.error('GRADE DIFF', n, before[n].grade, '->', grade); fails++; continue; }
  const a = JSON.stringify(before[n].trace), b = JSON.stringify(trace);
  if (a !== b) { console.error('TRACE DIFF', n); console.error('before', a.slice(0, 400)); console.error('after ', b.slice(0, 400)); fails++; }
}
console.log(fails ? `PARITY_FAIL ${fails}` : 'PARITY_OK');
process.exit(fails ? 1 : 0);
