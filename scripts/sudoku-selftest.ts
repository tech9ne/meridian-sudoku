import { generateGraded, solveFully, Diff, Grid } from '../lib/sudoku';
const DIFFS: Diff[] = ['easy', 'medium', 'hard', 'diabolical'];
const ok = (g: Grid) => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) units.push(Array.from({ length: 9 }, (_, k) => (br * 3 + (k / 3 | 0)) * 9 + bc * 3 + k % 3));
  return units.every(u => u.map(i => g[i]).sort((a, b) => a - b).join('') === '123456789');
};
for (const d of DIFFS) {
  for (let n = 0; n < 50; n++) {
    const g = generateGraded(d);
    const solved = solveFully([...g.puzzle]);
    if (!solved || !ok(solved) || solved.join('') !== g.solution.join('')) {
      console.error('FAIL', d, n, g.puzzle.join('')); process.exit(1);
    }
  }
  console.log(d, 'ok');
}
console.log('SUDOKU_SELFTEST_OK');
