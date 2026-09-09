import { gradeOf, Grid } from '../lib/sudoku';
import * as fs from 'fs';
const corpus: string[] = JSON.parse(fs.readFileSync('scripts/corpus.json', 'utf8'));
const before: { grade: string }[] = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
const tally: Record<string, number> = {};
for (let n = 0; n < corpus.length; n++) {
  const g = corpus[n].split('').map(Number) as Grid;
  const now = gradeOf(g);
  if (now !== before[n].grade) { const k = before[n].grade + '->' + now; tally[k] = (tally[k] || 0) + 1; }
}
console.log('GRADE_SHIFTS', JSON.stringify(tally));
