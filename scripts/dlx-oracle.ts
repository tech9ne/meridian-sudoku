import { generateGraded, Diff } from '../lib/sudoku';

// Knuth's Algorithm X (Exact Cover) for Sudoku
// 324 constraints: Row-Col (81), Row-Val (81), Col-Val (81), Box-Val (81)

function buildMatrix(givens: number[]) {
  const rows: number[][] = [];
  const rowMap: [number, number, number][] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = givens[r * 9 + c];
      const startV = given !== 0 ? given : 1;
      const endV = given !== 0 ? given : 9;

      for (let v = startV; v <= endV; v++) {
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const c_rc = r * 9 + c;
        const c_rv = 81 + r * 9 + (v - 1);
        const c_cv = 162 + c * 9 + (v - 1);
        const c_bv = 243 + b * 9 + (v - 1);
        rows.push([c_rc, c_rv, c_cv, c_bv]);
        rowMap.push([r, c, v]);
      }
    }
  }
  return { rows, rowMap };
}

function solveExactCover(rows: number[][], rowMap: [number, number, number][], limit: number): [number, number, number][][] {
  const solutions: [number, number, number][][] = [];
  const solution: number[] = [];
  const initialCols = new Set(Array.from({ length: 324 }, (_, i) => i));
  const initialRows = rows.map((row, i) => ({ idx: i, cols: row }));

  function search(availableCols: Set<number>, availableRows: { idx: number; cols: number[] }[]) {
    if (solutions.length >= limit) return;
    if (availableCols.size === 0) {
      solutions.push(solution.map(rIdx => rowMap[rIdx]));
      return;
    }
    let minRows = Infinity;
    let bestCol = -1;
    for (const col of availableCols) {
      let count = 0;
      for (const row of availableRows) if (row.cols.includes(col)) count++;
      if (count === 0) return;
      if (count < minRows) { minRows = count; bestCol = col; }
    }
    const branchRows = availableRows.filter(row => row.cols.includes(bestCol));
    for (const row of branchRows) {
      solution.push(row.idx);
      const newCols = new Set(availableCols);
      for (const c of row.cols) newCols.delete(c);
      const newRowSet = new Set(row.cols);
      const newRows = availableRows.filter(r => !r.cols.some(c => newRowSet.has(c)));
      search(newCols, newRows);
      solution.pop();
      if (solutions.length >= limit) return;
    }
  }
  search(initialCols, initialRows);
  return solutions;
}

const DIFFS: Diff[] = ['easy', 'medium', 'hard', 'diabolical'];
console.log('Running independent DLX Exact-Cover Oracle cross-check...');

for (const d of DIFFS) {
  for (let n = 0; n < 20; n++) {
    const g = generateGraded(d);
    const { rows, rowMap } = buildMatrix(g.puzzle);
    const sols = solveExactCover(rows, rowMap, 2);

    if (sols.length !== 1) {
      console.error(`DLX FAIL: ${d} puzzle ${n} has ${sols.length} solutions`);
      process.exit(1);
    }
    const dlxGrid = new Array(81).fill(0);
    for (const [r, c, v] of sols[0]) dlxGrid[r * 9 + c] = v;
    if (dlxGrid.join('') !== g.solution.join('')) {
      console.error(`DLX MISMATCH: ${d} puzzle ${n}`);
      process.exit(1);
    }
  }
  console.log(`${d} DLX cross-check ok`);
}
console.log('DLX_ORACLE_OK');
