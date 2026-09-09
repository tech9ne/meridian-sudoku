import type { Hint } from './sudoku';

export const POPC = new Uint8Array(512);
for (let i = 1; i < 512; i++) POPC[i] = POPC[i >> 1] + (i & 1);
const IDX = new Int8Array(512);
for (let i = 0; i < 9; i++) IDX[1 << i] = i;

export interface Spaces { Rn: number[][]; Cn: number[][]; Bn: number[][]; }

export function buildSpaces(cand: number[][]): Spaces {
  const Rn = Array.from({ length: 10 }, () => new Array(9).fill(0));
  const Cn = Array.from({ length: 10 }, () => new Array(9).fill(0));
  const Bn = Array.from({ length: 10 }, () => new Array(9).fill(0));
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const p = (r % 3) * 3 + (c % 3);
    for (const d of cand[i]) { Rn[d][r] |= 1 << c; Cn[d][c] |= 1 << r; Bn[d][b] |= 1 << p; }
  }
  return { Rn, Cn, Bn };
}

const bits = (m: number): number[] => { const out: number[] = []; for (let x = m; x; x &= x - 1) out.push(IDX[x & -x]); return out; };

function combos9(k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let d = start; d <= 9; d++) { cur.push(d); rec(d + 1, cur); cur.pop(); }
  };
  rec(1, []);
  return out;
}

export function hiddenStepM(cand: number[][], k: number): Hint | null {
  const sp = buildSpaces(cand);
  const houses: { masks: (d: number) => number; cell: (p: number) => number; label: string }[] = [];
  for (let r = 0; r < 9; r++) houses.push({ masks: d => sp.Rn[d][r], cell: p => r * 9 + p, label: `row ${r + 1}` });
  for (let c = 0; c < 9; c++) houses.push({ masks: d => sp.Cn[d][c], cell: p => p * 9 + c, label: `column ${c + 1}` });
  for (let b = 0; b < 9; b++) houses.push({ masks: d => sp.Bn[d][b], cell: p => ((((b / 3) | 0) * 3 + ((p / 3) | 0)) * 9 + ((b % 3) * 3 + (p % 3))), label: `box ${b + 1}` });
  const name = k === 2 ? 'hidden-pair' : k === 3 ? 'hidden-triple' : 'hidden-quad';
  const noun = k === 2 ? 'pair' : k === 3 ? 'triple' : 'quad';
  for (const h of houses) {
    for (const digits of combos9(k)) {
      let union = 0, dead = false;
      for (const d of digits) { const m = h.masks(d); if (!m) { dead = true; break; } union |= m; }
      if (dead || POPC[union] !== k) continue;
      const cells = bits(union).map(h.cell);
      const remDigits = [...new Set(cells.flatMap(i => cand[i].filter(d => !digits.includes(d))))];
      if (!remDigits.length) continue;
      return { tech: name, desc: `Hidden ${noun} ${digits.join('/')} confined to ${k} positions in ${h.label}.`, elim: { cells, digits: remDigits }, at: cells };
    }
  }
  return null;
}

export function fishStepM(cand: number[][]): Hint | null {
  const sp = buildSpaces(cand);
  for (let d = 1; d <= 9; d++) {
    for (const k of [2, 3, 4]) {
      const fname = k === 2 ? 'X-wing' : k === 3 ? 'Swordfish' : 'Jellyfish';
      for (const rows of combos9(k)) {
        let union = 0; for (const r of rows) union |= sp.Rn[d][r];
        if (POPC[union] !== k) continue;
        const cols = bits(union);
        const elim: number[] = [];
        for (const c of cols) for (let r = 0; r < 9; r++) if (!rows.includes(r) && (sp.Rn[d][r] & (1 << c))) elim.push(r * 9 + c);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: rows ${rows.map(x => x + 1).join('/')} confine it to columns ${cols.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: rows.map(r => cols.map(c => r * 9 + c)).flat() };
      }
      for (const cols of combos9(k)) {
        let union = 0; for (const c of cols) union |= sp.Cn[d][c];
        if (POPC[union] !== k) continue;
        const rows = bits(union);
        const elim: number[] = [];
        for (const r of rows) for (let c = 0; c < 9; c++) if (!cols.includes(c) && (sp.Cn[d][c] & (1 << r))) elim.push(r * 9 + c);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: columns ${cols.map(x => x + 1).join('/')} confine it to rows ${rows.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: cols.map(c => rows.map(r => r * 9 + c)).flat() };
      }
    }
  }
  return null;
}
