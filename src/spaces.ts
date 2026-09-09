import type { Hint } from './sudoku';
import { Rx, Cy, Bxy, BxyN, Rset, Cset, Bset } from './cardinals';

export const POPC = new Uint8Array(512);
for (let i = 1; i < 512; i++) POPC[i] = POPC[i >> 1] + (i & 1);
const IDX = new Int8Array(512);
for (let i = 0; i < 9; i++) IDX[1 << i] = i;

// House-major positional spaces after strmckr's RCBn layout:
// M[h][d0] = 9-bit position mask; h: rows 0-8, cols 9-17, boxes 18-26; d0 = digit-1.
export interface Spaces { M: number[][] }

export function buildSpaces(cand: number[][]): Spaces {
  const M: number[][] = Array.from({ length: 27 }, () => new Array(9).fill(0));
  for (let i = 0; i < 81; i++) {
    const cs = cand[i];
    if (!cs.length) continue;
    const r = Rx[i], c = Cy[i], b = Bxy[i], p = BxyN[i];
    for (const d of cs) {
      const d0 = d - 1;
      M[r][d0] |= 1 << c;
      M[9 + c][d0] |= 1 << r;
      M[18 + b][d0] |= 1 << p;
    }
  }
  return { M };
}

const bits = (m: number): number[] => { const out: number[] = []; for (let x = m; x; x &= x - 1) out.push(IDX[x & -x]); return out; };

function combosIdx(k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i <= 8; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}
const combos9 = (k: number): number[][] => combosIdx(k).map(cs => cs.map(x => x + 1));

export function hiddenStepM(cand: number[][], k: number): Hint | null {
  const { M } = buildSpaces(cand);
  const name = k === 2 ? 'hidden-pair' : k === 3 ? 'hidden-triple' : 'hidden-quad';
  const noun = k === 2 ? 'pair' : k === 3 ? 'triple' : 'quad';
  for (let h = 0; h < 27; h++) {
    const cellsOf = h < 9 ? Rset[h] : h < 18 ? Cset[h - 9] : Bset[h - 18];
    const label = h < 9 ? `row ${h + 1}` : h < 18 ? `column ${h - 8}` : `box ${h - 17}`;
    for (const digits of combos9(k)) {
      let union = 0, dead = false;
      for (const d of digits) { const m = M[h][d - 1]; if (!m) { dead = true; break; } union |= m; }
      if (dead || POPC[union] !== k) continue;
      const cells = bits(union).map(p => cellsOf[p]);
      const remDigits = [...new Set(cells.flatMap(i => cand[i].filter(d => !digits.includes(d))))];
      if (!remDigits.length) continue;
      return { tech: name, desc: `Hidden ${noun} ${digits.join('/')} confined to ${k} positions in ${label}.`, elim: { cells, digits: remDigits }, at: cells };
    }
  }
  return null;
}

export function fishStepM(cand: number[][]): Hint | null {
  const { M } = buildSpaces(cand);
  for (let d = 1; d <= 9; d++) {
    const d0 = d - 1;
    for (const k of [2, 3, 4]) {
      const fname = k === 2 ? 'X-wing' : k === 3 ? 'Swordfish' : 'Jellyfish';
      for (const base of combosIdx(k)) {
        let union = 0; for (const h of base) union |= M[h][d0];
        if (POPC[union] !== k) continue;
        const cols = bits(union);
        const elim: number[] = [];
        for (const c0 of cols) for (let h = 0; h < 9; h++) if (!base.includes(h) && (M[h][d0] & (1 << c0))) elim.push(Rset[h][c0]);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: rows ${base.map(x => x + 1).join('/')} confine it to columns ${cols.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: base.map(h => cols.map(c0 => Rset[h][c0])).flat() };
      }
      for (const base of combosIdx(k)) {
        let union = 0; for (const c0 of base) union |= M[9 + c0][d0];
        if (POPC[union] !== k) continue;
        const rows = bits(union);
        const elim: number[] = [];
        for (const r0 of rows) for (let c0 = 0; c0 < 9; c0++) if (!base.includes(c0) && (M[9 + c0][d0] & (1 << r0))) elim.push(Cset[c0][r0]);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: columns ${base.map(x => x + 1).join('/')} confine it to rows ${rows.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: base.map(c0 => rows.map(r0 => Cset[c0][r0])).flat() };
      }
    }
  }
  return null;
}
