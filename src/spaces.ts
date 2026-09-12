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
        let valid = true;
        for (const h of base) if (!(M[h][d0] & union)) { valid = false; break; }
        if (!valid) continue;
        const cols = bits(union);
        const elim: number[] = [];
        for (const c0 of cols) for (let h = 0; h < 9; h++) if (!base.includes(h) && (M[h][d0] & (1 << c0))) elim.push(Rset[h][c0]);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: rows ${base.map(x => x + 1).join('/')} confine it to columns ${cols.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: base.map(h => cols.map(c0 => Rset[h][c0])).flat() };
      }
      for (const base of combosIdx(k)) {
        let union = 0; for (const c0 of base) union |= M[9 + c0][d0];
        if (POPC[union] !== k) continue;
        let valid = true;
        for (const c0 of base) if (!(M[9 + c0][d0] & union)) { valid = false; break; }
        if (!valid) continue;
        const rows = bits(union);
        const elim: number[] = [];
        for (const r0 of rows) for (let c0 = 0; c0 < 9; c0++) if (!base.includes(c0) && (M[9 + c0][d0] & (1 << r0))) elim.push(Cset[c0][r0]);
        if (elim.length) return { tech: 'fish', desc: `${fname} on digit ${d}: columns ${base.map(x => x + 1).join('/')} confine it to rows ${rows.map(x => x + 1).join('/')}.`, elim: { cells: elim, digits: [d] }, at: base.map(c0 => rows.map(r0 => Cset[c0][r0])).flat() };
      }
    }
  }
  return null;
}

export interface FindEntry {
  kind: 'naked' | 'hidden';
  dof: number;
  origin: number;
  applicable: number[];
  cells: number[];
  digits: number[];
  elimCells: number[];
  elimDigits: number[];
}

const BANDS = [7, 56, 448];
const BOXCOLS = [73, 146, 292];
const inBand = (m: number) => m !== 0 && ((m & 7) === m || (m & 56) === m || (m & 448) === m);
const cellsOfH = (h: number) => (h < 9 ? Rset[h] : h < 18 ? Cset[h - 9] : Bset[h - 18]);

// Find-all after StrmCkr's ownership-dedup design: naked subsets dedup by
// band-skip (dof is cell-set intrinsic, so box sweep re-finds RC-contained
// sets); hidden subsets dedup post-hoc by cell-set key with box-first sweep
// order, because hidden confinement is house-relative and band-skip would
// lose entries. Dual-sector entries list every applicable house and cycle
// elims across all of them.
export function findAll(cand: number[][], maxDof = 3): FindEntry[] {
  const { M } = buildSpaces(cand);
  const Cm = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) for (const d of cand[i]) Cm[i] |= 1 << (d - 1);
  const out: FindEntry[] = [];
  const seen = new Map<string, FindEntry>();
  for (let h = 0; h < 27; h++) {
    const cellsOf = cellsOfH(h);
    const union = new Int16Array(512);
    for (let m = 1; m < 512; m++) union[m] = union[m & (m - 1)] | Cm[cellsOf[IDX[m & -m]]];
    let liveCells = 0; for (let k = 0; k < 9; k++) if (Cm[cellsOf[k]]) liveCells |= 1 << k;
    for (let m = 3; m < 512; m++) {
      if ((m & ~liveCells) !== 0) continue;
      const n = POPC[m];
      const u = union[m];
      const dof = POPC[u] - n;
      if (dof < 0 || dof > maxDof) continue;
      if (h < 18 && inBand(m)) continue;
      const applicable = [h];
      if (h >= 18) {
        const b = h - 18;
        for (let j = 0; j < 3; j++) if ((m & BANDS[j]) === m) applicable.push(((b / 3) | 0) * 3 + j);
        for (let j = 0; j < 3; j++) if ((m & BOXCOLS[j]) === m) applicable.push(9 + (b % 3) * 3 + j);
      }
      const cells = bits(m).map(p => cellsOf[p]);
      const digits = bits(u).map(x => x + 1);
      const inS = new Set(cells);
      const elimCells: number[] = [];
      for (const A of applicable) { const co = cellsOfH(A); for (let p = 0; p < 9; p++) if (!inS.has(co[p])) elimCells.push(co[p]); }
      out.push({ kind: 'naked', dof, origin: h, applicable, cells, digits, elimCells, elimDigits: digits });
    }
  }
  for (let h = 26; h >= 0; h--) {
    const cellsOf = cellsOfH(h);
    const pun = new Int16Array(512);
    for (let m = 1; m < 512; m++) pun[m] = pun[m & (m - 1)] | M[h][IDX[m & -m]];
    let liveDigits = 0; for (let d = 0; d < 9; d++) if (M[h][d]) liveDigits |= 1 << d;
    for (let m = 3; m < 512; m++) {
      if ((m & ~liveDigits) !== 0) continue;
      const k = POPC[m];
      const pos = pun[m];
      if (!pos) continue;
      const dof = POPC[pos] - k;
      if (dof < 0 || dof > maxDof) continue;
      const cells = bits(pos).map(p => cellsOf[p]);
      const digits = bits(m).map(x => x + 1);
      const key = 'h|' + cells.join(',') + '|' + digits.join(',');
      const prev = seen.get(key);
      if (prev) { if (!prev.applicable.includes(h)) prev.applicable.push(h); continue; }
      const rem = [...new Set(cells.flatMap(i => cand[i].filter(d => !digits.includes(d))))];
      const e: FindEntry = { kind: 'hidden', dof, origin: h, applicable: [h], cells, digits, elimCells: cells, elimDigits: rem };
      seen.set(key, e);
      out.push(e);
    }
  }
  return out;
}
