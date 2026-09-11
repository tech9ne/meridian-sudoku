import { generateGraded, Diff } from '../lib/sudoku';
for (const t of ['easy', 'medium', 'hard', 'diabolical'] as Diff[]) {
  const t0 = Date.now();
  for (let k = 0; k < 5; k++) generateGraded(t);
  console.log(`${t}: ${((Date.now() - t0) / 5).toFixed(0)}ms per puzzle`);
}
