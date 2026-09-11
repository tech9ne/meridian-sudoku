export type Grid = number[];
import { hiddenStepM, fishStepM, findAll } from './spaces';
export type Diff = 'easy' | 'medium' | 'hard' | 'diabolical';
export type Tech = 'naked-single' | 'hidden-single' | 'naked-pair' | 'hidden-pair' | 'naked-triple' | 'hidden-triple' | 'naked-quad' | 'hidden-quad' | 'pointing' | 'boxline' | 'fish' | 'skyscraper' | 'kite' | 'coloring' | 'xy-wing' | 'w-wing' | 'xyz-wing' | 'ur' | 'bug+1' | 'xy-chain' | 'als-xz' | 'forcing' | 'nishio';
export interface Hint { chain?: { from: [number, number]; to: [number, number]; kind: 'strong' | 'weak' }[];
  tech: Tech;
  desc: string;
  place?: { cell: number; digit: number };
  elim?: { cells: number[]; digits: number[] };
  at?: number[];
}

const ROWS: number[][] = [];
const COLS: number[][] = [];
const BOXES: number[][] = [];
for (let r = 0; r < 9; r++) ROWS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) COLS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
  const b: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.push((br * 3 + r) * 9 + bc * 3 + c);
  BOXES.push(b);
}
export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];
const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of UNITS) if (u.includes(i)) for (const j of u) if (j !== i) s.add(j);
  return [...s];
});
export const peersOf = (i: number) => PEERS[i];

export function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function candidatesFor(g: Grid, i: number): number[] { if (g[i]) return []; const used = new Set(PEERS[i].map(p => g[p])); const out: number[] = []; for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d); return out; }
export function allCandidates(g: Grid): number[][] { return g.map((v, i) => (v ? [] : candidatesFor(g, i))); }
function valid(g: Grid, i: number, d: number): boolean { for (const p of PEERS[i]) if (g[p] === d) return false; return true; }

export function countSolutions(g: Grid, limit = 2): number {
  let best = -1, bi = -1;
  for (let i = 0; i < 81; i++) { if (g[i]) continue; const n = candidatesFor(g, i).length; if (best < 0 || n < best) { best = n; bi = i; if (n <= 1) break; } }
  if (bi === -1) return 1;
  if (best === 0) return 0;
  let n = 0;
  for (const d of candidatesFor(g, bi)) { g[bi] = d; n += countSolutions(g, limit - n); g[bi] = 0; if (n >= limit) return n; }
  return n;
}
export function solveFully(g: Grid): Grid | null {
  const w = [...g];
  const fill = (i: number): boolean => {
    while (i < 81 && w[i]) i++;
    if (i === 81) return true;
    for (const d of candidatesFor(w, i)) { w[i] = d; if (fill(i + 1)) return true; w[i] = 0; }
    return false;
  };
  return fill(0) ? w : null;
}
export function generate(givens: number): { puzzle: Grid; solution: Grid } {
  const g = new Array(81).fill(0);
  const fill = (i: number): boolean => { if (i === 81) return true; for (const d of shuffle([1,2,3,4,5,6,7,8,9])) if (valid(g, i, d)) { g[i] = d; if (fill(i + 1)) return true; g[i] = 0; } return false; };
  fill(0);
  const solution = [...g];
  const p = [...g];
  let removed = 0;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) { if (removed >= 81 - givens) break; const b = p[i]; p[i] = 0; if (countSolutions([...p]) !== 1) p[i] = b; else removed++; }
  return { puzzle: p, solution };
}

export function logicalStep(cand: number[][]): Hint | null {
  for (let i = 0; i < 81; i++) if (cand[i].length === 1) return { tech: 'naked-single', desc: `R${Math.floor(i/9)+1}C${i%9+1} has a single candidate.`, place: { cell: i, digit: cand[i][0] } };
  for (const u of UNITS) for (let d = 1; d <= 9; d++) {
    const cells = u.filter(i => cand[i].includes(d));
    if (cells.length === 1) return { tech: 'hidden-single', desc: `${d} fits only one cell in this unit.`, place: { cell: cells[0], digit: d } };
  }
  for (const u of UNITS) {
    const two = u.filter(i => cand[i].length === 2);
    for (let a = 0; a < two.length; a++) for (let b = a + 1; b < two.length; b++) {
      if (cand[two[a]][0] === cand[two[b]][0] && cand[two[a]][1] === cand[two[b]][1]) {
        const digits = cand[two[a]];
        const others = u.filter(i => i !== two[a] && i !== two[b] && cand[i].some(x => digits.includes(x)));
        if (others.length) return { tech: 'naked-pair', desc: `Naked pair ${digits.join('/')} locks those digits out of the unit.`, elim: { cells: others, digits } };
      }
    }
  }
  const hp = hiddenStepM(cand, 2); if (hp) return hp;
  const nt = nakedTripleStep(cand); if (nt) return nt;
  const ht = hiddenStepM(cand, 3); if (ht) return ht;
  const nq = nakedQuadStep(cand); if (nq) return nq;
  const hq = hiddenStepM(cand, 4); if (hq) return hq;
for (let bi = 0; bi < 9; bi++) {
    const box = BOXES[bi];
    for (let d = 1; d <= 9; d++) {
      const cells = box.filter(i => cand[i].includes(d));
      if (cells.length < 2) continue;
      const rs = new Set(cells.map(i => Math.floor(i / 9)));
      const cs = new Set(cells.map(i => i % 9));
      if (rs.size === 1) { const others = ROWS[[...rs][0]].filter(i => !box.includes(i) && cand[i].includes(d)); if (others.length) return { tech: 'pointing', desc: `${d} in this box lies on one row — pointing pair.`, elim: { cells: others, digits: [d] } }; }
      else if (cs.size === 1) { const others = COLS[[...cs][0]].filter(i => !box.includes(i) && cand[i].includes(d)); if (others.length) return { tech: 'pointing', desc: `${d} in this box lies on one column — pointing pair.`, elim: { cells: others, digits: [d] } }; }
    }
  }
  for (const [lines, kind] of [[ROWS, 'row'], [COLS, 'col']] as const) {
    for (let li = 0; li < 9; li++) {
      const line = lines[li];
      for (let d = 1; d <= 9; d++) {
        const cells = line.filter(i => cand[i].includes(d));
        if (cells.length < 2) continue;
        const bs = new Set(cells.map(i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)));
        if (bs.size === 1) { const others = BOXES[[...bs][0]].filter(i => !line.includes(i) && cand[i].includes(d)); if (others.length) return { tech: 'boxline', desc: `${d} on this ${kind} is confined to one box — box/line reduction.`, elim: { cells: others, digits: [d] } }; }
      }
    }
  }
  return null;
}

export function solveLogical(g: Grid): { solved: boolean; techs: Set<Tech>; cand: number[][] } {
  const values = [...g];
  const cand = allCandidates(values);
  const techs = new Set<Tech>();
  for (let iter = 0; iter < 200; iter++) {
    if (values.every(v => v)) return { solved: true, techs, cand };
    const step = logicalStep(cand);
    if (!step) return { solved: values.every(v => v), techs, cand };
    techs.add(step.tech);
    if (step.place) { const { cell, digit } = step.place; values[cell] = digit; cand[cell] = []; for (const p of PEERS[cell]) cand[p] = cand[p].filter(x => x !== digit); }
    else if (step.elim) { for (const c of step.elim.cells) cand[c] = cand[c].filter(x => !step.elim!.digits.includes(x)); }
  }
  return { solved: values.every(v => v), techs, cand };
}
export function gradeOf(puzzle: Grid): Diff {
  const { solved, techs, cand } = solveLogical(puzzle);
  if (solved) {
    const t1 = techs.has('pointing') || techs.has('boxline') || techs.has('naked-pair') || techs.has('hidden-pair');
    return t1 ? 'medium' : 'easy';
  }
  if (tier2Probe(cand, true)) return 'hard';
  return 'diabolical';
}
export const GIVENS: Record<Diff, [number, number]> = { easy: [40, 45], medium: [33, 39], hard: [28, 32], diabolical: [24, 28] };
const TIER: Record<Diff, number> = { easy: 0, medium: 1, hard: 2, diabolical: 3 };
export function generateGraded(target: Diff): { puzzle: Grid; solution: Grid; grade: Diff } {
  let best: { puzzle: Grid; solution: Grid; grade: Diff } | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const g = new Array(81).fill(0);
    const fill = (i: number): boolean => { if (i === 81) return true; for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (valid(g, i, d)) { g[i] = d; if (fill(i + 1)) return true; g[i] = 0; } return false; };
    fill(0);
    const solution = [...g];
    const p = [...g];
    let grade = gradeOf(p);
    for (let pass = 0; pass < 3; pass++) {
      let accepted = 0;
      for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
        if (target !== 'easy' && grade === target) break;
        if (p[i] === 0) continue;
        const backup = p[i];
        p[i] = 0;
        if (countSolutions([...p]) !== 1) { p[i] = backup; continue; }
        const ng = gradeOf(p);
        if (TIER[ng] > TIER[target]) { p[i] = backup; continue; }
        grade = ng; accepted++;
        if (target !== 'easy' && grade === target) break;
      }
      if (target !== 'easy' && grade === target) break;
      if (accepted === 0) break;
    }
    const finalGrade = gradeOf(p);
    const res = { puzzle: p, solution, grade: finalGrade };
    if (finalGrade === target) return res;
    if (!best || Math.abs(TIER[finalGrade] - TIER[target]) < Math.abs(TIER[best.grade] - TIER[target])) best = res;
  }
  return best!;
}
export function hintFor(g: Grid): Hint | null { return anyStep(allCandidates(g), countSolutions([...g]) === 1); }
export function encode(g: Grid): string { return g.map(v => (v ? String(v) : '.')).join(''); }
export function decode(s: string): Grid | null { if (s.length !== 81) return null; const g = s.split('').map(ch => (ch >= '1' && ch <= '9' ? Number(ch) : 0)); return g.some(v => v) ? g : null; }

const RR = (i: number) => Math.floor(i / 9);
const CC = (i: number) => i % 9;
const boxOf = (i: number) => Math.floor(RR(i) / 3) * 3 + Math.floor(CC(i) / 3);
const unitsOfI = (i: number) => UNITS.filter(u => u.includes(i));
function combosK(n: number, k: number): number[][] { const out: number[][] = []; const cur: number[] = []; const rec = (st: number) => { if (cur.length === k) { out.push([...cur]); return; } for (let i = st; i < n; i++) { cur.push(i); rec(i + 1); cur.pop(); } }; rec(0); return out; }
const LINECOMBOS = combosK(9, 2).concat(combosK(9, 3), combosK(9, 4));

function fishStep_OLD(cand: number[][]): Hint | null {
  for (let d = 1; d <= 9; d++) for (const base of [0, 1]) {
    for (const set of LINECOMBOS) {
      const N = set.length; const cover = new Set<number>();
      for (const L of set) for (let o = 0; o < 9; o++) { const r = base === 0 ? L : o, c = base === 0 ? o : L; if (cand[r * 9 + c].includes(d)) cover.add(base === 0 ? c : r); }
      if (cover.size !== N) continue;
      const elim: number[] = [];
      for (const cv of cover) for (let o = 0; o < 9; o++) { const r = base === 0 ? o : cv, c = base === 0 ? cv : o; if (set.includes(base === 0 ? r : c)) continue; if (cand[r * 9 + c].includes(d)) elim.push(r * 9 + c); }
      if (elim.length) return { tech: 'fish', desc: `${N}-fish on ${d} (${base === 0 ? 'rows' : 'cols'}).`, elim: { cells: elim, digits: [d] } };
    }
  }
  return null;
}
function skyscraperStep(cand: number[][]): Hint | null {
  for (let d = 1; d <= 9; d++) for (const base of [0, 1]) {
    const lines: { a: number; b: number }[] = [];
    for (let L = 0; L < 9; L++) { const pos: number[] = []; for (let o = 0; o < 9; o++) { const i = base === 0 ? L * 9 + o : o * 9 + L; if (cand[i].includes(d)) pos.push(i); } if (pos.length === 2) lines.push({ a: pos[0], b: pos[1] }); }
    const cross = (i: number) => base === 0 ? CC(i) : RR(i);
    for (let x = 0; x < lines.length; x++) for (let y = x + 1; y < lines.length; y++) {
      const A = lines[x], B = lines[y];
      const sA = [A.a, A.b].find(i => [B.a, B.b].some(j => cross(j) === cross(i))); if (sA === undefined) continue;
      if ([B.a, B.b].filter(j => cross(j) === cross(sA)).length !== 1) continue;
      const sB = [B.a, B.b].find(j => cross(j) === cross(sA))!;
      const eA = [A.a, A.b].find(i => i !== sA)!; const eB = [B.a, B.b].find(j => j !== sB)!;
      if (boxOf(sA) === boxOf(sB) || boxOf(eA) === boxOf(eB)) continue;
      const elim: number[] = []; for (let i = 0; i < 81; i++) if (cand[i].includes(d) && i !== eA && i !== eB && peersOf(i).includes(eA) && peersOf(i).includes(eB)) elim.push(i);
      if (elim.length) return { tech: 'skyscraper', desc: `Skyscraper on ${d}.`, elim: { cells: elim, digits: [d] } };
    }
  }
  return null;
}
function kiteStep(cand: number[][]): Hint | null {
  for (let d = 1; d <= 9; d++) {
    const rows: number[][] = [], cols: number[][] = [];
    for (let L = 0; L < 9; L++) { const rp: number[] = [], cp: number[] = []; for (let o = 0; o < 9; o++) { if (cand[L * 9 + o].includes(d)) rp.push(L * 9 + o); if (cand[o * 9 + L].includes(d)) cp.push(o * 9 + L); } if (rp.length === 2) rows.push(rp); if (cp.length === 2) cols.push(cp); }
    for (const rw of rows) for (const cl of cols) {
      let eA = -1, eB = -1;
      for (const a of rw) for (const b of cl) if (a !== b && boxOf(a) === boxOf(b)) { eA = rw.find(x => x !== a)!; eB = cl.find(x => x !== b)!; }
      if (eA < 0 || eA === eB) continue;
      const elim: number[] = []; for (let i = 0; i < 81; i++) if (cand[i].includes(d) && i !== eA && i !== eB && peersOf(i).includes(eA) && peersOf(i).includes(eB)) elim.push(i);
      if (elim.length) return { tech: 'kite', desc: `Two-string kite on ${d}.`, elim: { cells: elim, digits: [d] } };
    }
  }
  return null;
}
export function coloringStep(cand: number[][]): Hint | null {
  for (let d = 1; d <= 9; d++) {
    const color = new Map<number, 0 | 1>(); const adj = new Map<number, number[]>(); const comp = new Map<number, number>(); let cid = 0;
    for (const u of UNITS) { const cs = u.filter(i => cand[i].includes(d)); if (cs.length === 2) { adj.set(cs[0], [...(adj.get(cs[0]) || []), cs[1]]); adj.set(cs[1], [...(adj.get(cs[1]) || []), cs[0]]); } }
    let conflict: -1 | 0 | 1 = -1; let conflictComp = -1;
    for (const st of adj.keys()) { if (color.has(st)) continue; cid++; color.set(st, 0); comp.set(st, cid); const q = [st];
      while (q.length) { const cur = q.pop()!; for (const nb of adj.get(cur) || []) { const want = (1 - color.get(cur)!) as 0 | 1; if (color.has(nb)) { if (color.get(nb) !== want) { conflict = color.get(nb)!; conflictComp = comp.get(cur)!; } } else { color.set(nb, want); comp.set(nb, cid); q.push(nb); } } } }
    if (conflict !== -1) { const cells = [...color.entries()].filter(([j, c]) => c === conflict && comp.get(j) === conflictComp).map(([i]) => i); if (cells.length) return { tech: 'coloring', desc: `Simple coloring on ${d}: a color self-contradicts.`, elim: { cells, digits: [d] } }; }
    for (let i = 0; i < 81; i++) { if (!cand[i].includes(d) || color.has(i)) continue;
      const j0 = [...color.entries()].find(([j, c]) => c === 0 && peersOf(i).includes(j)); const j1 = [...color.entries()].find(([j, c]) => c === 1 && peersOf(i).includes(j));
      if (j0 && j1 && comp.get(j0[0]) === comp.get(j1[0])) return { tech: 'coloring', desc: `Simple coloring on ${d}: sees both colors.`, elim: { cells: [i], digits: [d] } }; }
  }
  return null;
}
function xywingStep(cand: number[][]): Hint | null {
  for (let p = 0; p < 81; p++) { if (cand[p].length !== 2) continue; const [A, B] = cand[p];
    const pin = peersOf(p).filter(q => cand[q].length === 2);
    for (const q of pin) for (const r of pin) { if (q >= r) continue; const cq = cand[q], cr = cand[r];
      for (let Z = 1; Z <= 9; Z++) { if (Z === A || Z === B) continue;
        const ok1 = cq.includes(A) && cq.includes(Z) && !cq.includes(B) && cr.includes(B) && cr.includes(Z) && !cr.includes(A);
        const ok2 = cq.includes(B) && cq.includes(Z) && !cq.includes(A) && cr.includes(A) && cr.includes(Z) && !cr.includes(B);
        if (!ok1 && !ok2) continue;
        const elim: number[] = []; for (let i = 0; i < 81; i++) if (i !== p && i !== q && i !== r && cand[i].includes(Z) && peersOf(i).includes(q) && peersOf(i).includes(r)) elim.push(i);
        if (elim.length) return { tech: 'xy-wing', desc: `XY-wing removes ${Z}.`, elim: { cells: elim, digits: [Z] } }; } } }
  return null;
}
function wwingStep(cand: number[][]): Hint | null {
  const bi = [...Array(81).keys()].filter(i => cand[i].length === 2);
  for (let a = 0; a < bi.length; a++) for (let b = a + 1; b < bi.length; b++) { const P = bi[a], Q = bi[b];
    if (cand[P][0] !== cand[Q][0] || cand[P][1] !== cand[Q][1] || peersOf(P).includes(Q)) continue; const [A, B] = cand[P];
    for (const u of UNITS) { const cc = u.filter(i => cand[i].includes(A)); if (cc.length !== 2) continue; const [x, y] = cc;
      if (!((peersOf(x).includes(P) && peersOf(y).includes(Q)) || (peersOf(x).includes(Q) && peersOf(y).includes(P)))) continue;
      const elim: number[] = []; for (let i = 0; i < 81; i++) if (i !== P && i !== Q && cand[i].includes(B) && peersOf(i).includes(P) && peersOf(i).includes(Q)) elim.push(i);
      if (elim.length) return { tech: 'w-wing', desc: `W-wing on ${A}/${B} removes ${B}.`, elim: { cells: elim, digits: [B] } }; } }
  return null;
}
function xyzwingStep(cand: number[][]): Hint | null {
  for (let p = 0; p < 81; p++) { if (cand[p].length !== 3) continue; const hub = cand[p];
    const pin = peersOf(p).filter(q => cand[q].length === 2);
    for (const q of pin) for (const r of pin) { if (q >= r) continue; const cq = cand[q], cr = cand[r];
      for (const Z of hub) { const rest = hub.filter(x => x !== Z); const qo = cq.find(x => x !== Z), ro = cr.find(x => x !== Z);
        if (!cq.includes(Z) || !cr.includes(Z) || !qo || !ro || qo === ro) continue;
        if (!(rest.includes(qo) && rest.includes(ro))) continue;
        const elim: number[] = []; for (let i = 0; i < 81; i++) if (i !== p && i !== q && i !== r && cand[i].includes(Z) && peersOf(i).includes(p) && peersOf(i).includes(q) && peersOf(i).includes(r)) elim.push(i);
        if (elim.length) return { tech: 'xyz-wing', desc: `XYZ-wing removes ${Z}.`, elim: { cells: elim, digits: [Z] } }; } } }
  return null;
}
function urStep(cand: number[][]): Hint | null {
  for (const [r1, r2] of combosK(9, 2)) for (const [c1, c2] of combosK(9, 2)) {
    const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
    if (new Set(cells.map(boxOf)).size !== 2) continue;
    if (cells.some(i => cand[i].length === 0)) continue;
    const sets = cells.map(i => cand[i]); const bi = sets.findIndex(s => s.length === 2); if (bi < 0) continue;
    const [A, B] = sets[bi];
    const kind = sets.map(s => (s.includes(A) && s.includes(B)) ? (s.length === 2 ? 2 : s.length === 3 ? 3 : 0) : 0);
    if (kind.filter(k => k === 2).length === 3 && kind.filter(k => k === 3).length === 1)
      return { tech: 'ur', desc: `Unique rectangle: avoid the ${A}/${B} deadly pattern.`, elim: { cells: [cells[kind.indexOf(3)]], digits: [A, B] } };
  }
  return null;
}
function bugStep(cand: number[][]): Hint | null {
  const tri = cand.map((s, i) => s.length === 3 ? i : -1).filter(i => i >= 0);
  if (tri.length !== 1 || cand.some(s => s.length !== 0 && s.length !== 2 && s.length !== 3)) return null;
  const t = tri[0];
  for (const u of unitsOfI(t)) for (const d of cand[t]) if (u.filter(i => cand[i].includes(d)).length === 3) return { tech: 'bug+1', desc: `BUG+1: place ${d}.`, place: { cell: t, digit: d } };
  return null;
}
export function xychainStep(cand: number[][]): Hint | null {
  const bi = [...Array(81).keys()].filter(i => cand[i].length === 2);
  const nbr = (i: number) => bi.filter(j => j !== i && peersOf(i).includes(j) && cand[i].some(d => cand[j].includes(d)));
  for (const start of bi) {
    const stack: { node: number; path: number[]; links: number[] }[] = [{ node: start, path: [start], links: [] }];
    let guard = 0;
    while (stack.length && guard++ < 3000) { const { node, path, links } = stack.pop()!;
      for (const nx of nbr(node)) { if (path.includes(nx)) continue; const L = cand[node].find(d => cand[nx].includes(d))!; if (path.length >= 2 && links[links.length - 1] === L) continue;
        const np = [...path, nx], nl = [...links, L];
        if (np.length >= 2) { const E1 = cand[start].find(d => d !== nl[0]); const E2 = cand[nx].find(d => d !== nl[nl.length - 1]);
          if (E1 && E1 === E2) { const elim: number[] = []; for (let i = 0; i < 81; i++) if (!np.includes(i) && cand[i].includes(E1) && peersOf(i).includes(start) && peersOf(i).includes(nx)) elim.push(i);
            if (elim.length) { const chain: { from: [number, number]; to: [number, number]; kind: 'strong' | 'weak' }[] = [{ from: [start, E1], to: [start, nl[0]], kind: 'strong' }]; for (let j = 0; j < nl.length; j++) { chain.push({ from: [np[j], nl[j]], to: [np[j + 1], nl[j]], kind: 'weak' }); if (j + 1 < nl.length) chain.push({ from: [np[j + 1], nl[j]], to: [np[j + 1], nl[j + 1]], kind: 'strong' }); } chain.push({ from: [nx, nl[nl.length - 1]], to: [nx, E1], kind: 'strong' }); return { tech: 'xy-chain', desc: `XY-chain removes ${E1}.`, elim: { cells: elim, digits: [E1] }, chain }; } } }
        if (np.length < 8) stack.push({ node: nx, path: np, links: nl }); } }
  }
  return null;
}
function alsxzStep(cand: number[][]): Hint | null {
  const table = findAll(cand, 1);
  const alss = table.filter(e => e.kind === 'naked' && e.dof === 1);
  for (let a = 0; a < alss.length; a++) {
    const A = alss[a];
    for (let b = a + 1; b < alss.length; b++) {
      const B = alss[b];
      if (A.cells.some(c => B.cells.includes(c))) continue;
      const common = A.digits.filter(d => B.digits.includes(d));
      for (const X of common) {
        const ax = A.cells.filter(c => cand[c].includes(X));
        const bx = B.cells.filter(c => cand[c].includes(X));
        if (!ax.length || !bx.length) continue;
        if (!ax.every(i => bx.every(j => i === j || peersOf(i).includes(j)))) continue;
        for (const Z of common) {
          if (X === Z) continue;
          const az = A.cells.filter(c => cand[c].includes(Z));
          const bz = B.cells.filter(c => cand[c].includes(Z));
          const elim: number[] = [];
          for (let i = 0; i < 81; i++) {
            if (A.cells.includes(i) || B.cells.includes(i) || !cand[i].includes(Z)) continue;
            if (az.every(j => peersOf(i).includes(j)) && bz.every(j => peersOf(i).includes(j))) elim.push(i);
          }
          if (elim.length) return { tech: 'als-xz', desc: `ALS-XZ removes ${Z}.`, elim: { cells: elim, digits: [Z] }, at: [...A.cells, ...B.cells] };
        }
      }
    }
  }
  return null;
}
function assume(cand: number[][], cell: number, digit: number): number[][] | null {
  const c = cand.map(s => [...s]);
  const place = (i: number, d: number): boolean => { if (!c[i].includes(d)) return false; c[i] = [d]; for (const p of peersOf(i)) { if (!c[p].length) continue; c[p] = c[p].filter(x => x !== d); if (!c[p].length) return false; } return true; };
  if (!place(cell, digit)) return null;
  for (let iter = 0; iter < 90; iter++) { let prog = false;
    for (let i = 0; i < 81; i++) if (c[i].length === 1) { const d = c[i][0]; for (const p of peersOf(i)) if (c[p].length > 1) { c[p] = c[p].filter(x => x !== d); if (!c[p].length) return null; prog = true; } }
    for (const u of UNITS) { const empt = u.filter(i => !c[i].length).length; let absent = 0; const hid: [number, number][] = [];
      for (let d = 1; d <= 9; d++) { const sp = u.filter(i => c[i].includes(d));
        if (!sp.length) absent++;
        else if (sp.length === 1 && c[sp[0]].length > 1) hid.push([sp[0], d]); }
      if (absent > empt) return null;
      for (const [hi, hd] of hid) { if (!place(hi, hd)) return null; prog = true; } }
    if (!prog) break; }
  return c;
}
function nishioStep(cand: number[][]): Hint | null {
  let tried = 0;
  for (let i = 0; i < 81; i++) { if (cand[i].length < 2) continue; for (const d of cand[i]) { if (tried++ > 60) return null; if (assume(cand, i, d) === null) return { tech: 'nishio', desc: `Nishio: ${d} at R${RR(i) + 1}C${CC(i) + 1} contradicts.`, elim: { cells: [i], digits: [d] } }; } }
  return null;
}
function forcingStep(cand: number[][]): Hint | null {
  for (let i = 0; i < 81; i++) { if (cand[i].length < 2 || cand[i].length > 4) continue;
    const res = cand[i].map(d => assume(cand, i, d));
    if (res.some(r => r === null)) continue;
    const cnt = new Map<string, number>();
    for (const r of res as number[][][]) for (let j = 0; j < 81; j++) for (const d of cand[j]) if (!r[j].includes(d)) cnt.set(j + ':' + d, (cnt.get(j + ':' + d) || 0) + 1);
    for (const [key, n] of cnt) if (n === cand[i].length) { const [j, d] = key.split(':').map(Number); return { tech: 'forcing', desc: `Cell-forcing chain removes ${d} from R${RR(j) + 1}C${CC(j) + 1}.`, elim: { cells: [j], digits: [d] } }; } }
  return null;
}
function tier2Probe(cand: number[][], uniq: boolean): Hint | null {
  return fishStep(cand) || skyscraperStep(cand) || kiteStep(cand) || coloringStep(cand) || xywingStep(cand) || wwingStep(cand) || xyzwingStep(cand) || (uniq ? urStep(cand) || bugStep(cand) : null);
}
function anyStep(cand: number[][], uniq: boolean): Hint | null {
  return logicalStep(cand) || tier2Probe(cand, uniq) || xychainStep(cand) || alsxzStep(cand) || forcingStep(cand) || nishioStep(cand);
}

export function findContradiction(g: Grid): string | null {
  const cand = allCandidates(g);
  const rc = (i: number) => `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`;
  for (let i = 0; i < 81; i++) if (g[i] === 0 && cand[i].length === 0) return `${rc(i)} has no candidates left`;
  for (const u of UNITS) {
    for (let d = 1; d <= 9; d++) {
      if (u.some(i => g[i] === d)) continue;
      if (!u.some(i => g[i] === 0 && cand[i].includes(d))) return `digit ${d} has no place in the unit containing ${rc(u[0])}`;
    }
    const empt = u.filter(i => g[i] === 0);
    const live: number[] = [];
    for (let d = 1; d <= 9; d++) if (!u.some(i => g[i] === d)) live.push(d);
    for (let k = 2; k <= 9; k++) {
      for (const cs of combosK(empt.length, k)) {
        const cells = cs.map(o => empt[o]);
        const uni = new Set(cells.flatMap(i => cand[i]));
        if (uni.size < k) return `${k} cells (${cells.map(rc).join(' ')}) hold only ${uni.size} digits`;
      }
      for (const ds of combosK(live.length, k)) {
        const digits = ds.map(o => live[o]);
        const places = empt.filter(i => cand[i].some(d => digits.includes(d)));
        if (places.length < k) return `digits ${digits.join('/')} confined to ${places.length} cells in the unit containing ${rc(u[0])}`;
      }
    }
  }
  return null;
}


function nakedTripleStep(cand: number[][]): Hint | null {
  for (const u of UNITS) {
    const empt = u.filter(i => cand[i].length === 2 || cand[i].length === 3);
    for (const cs of combosK(empt.length, 3)) {
      const cells = cs.map(o => empt[o]);
      const uni = new Set(cells.flatMap(i => cand[i]));
      if (uni.size === 3) {
        const elim: number[] = [];
        for (const i of u) if (!cells.includes(i)) for (const d of uni) if (cand[i].includes(d)) elim.push(i);
        if (elim.length) return { tech: 'naked-triple', desc: `Naked triple ${[...uni].sort().join('/')} locks those digits out of the unit.`, elim: { cells: elim, digits: [...uni] }, at: cells };
      }
    }
  }
  return null;
}
function hiddenTripleStep(cand: number[][]): Hint | null {
  for (const u of UNITS) {
    const digitCells: number[][] = Array.from({ length: 9 }, () => []);
    for (const i of u) for (const d of cand[i]) if (!u.some(j => j !== i && cand[j].length === 1 && cand[j][0] === d)) digitCells[d - 1].push(i);
    for (const ds of combosK(9, 3)) {
      const digits = ds.map(x => x + 1);
      const places = u.filter(i => digits.some(d => digitCells[d - 1].includes(i)) && !u.some(j => j !== i && cand[j].length === 1 && digits.includes(cand[j][0])));
      if (places.length === 3) {
        const elim: number[] = [];
        for (const i of places) for (const d of cand[i]) if (!digits.includes(d)) elim.push(i);
        if (elim.length) return { tech: 'hidden-triple', desc: `Hidden triple ${digits.join('/')} is confined to those cells.`, elim: { cells: elim, digits: [] }, at: places };
      }
    }
  }
  return null;
}
function nakedQuadStep(cand: number[][]): Hint | null {
  for (const u of UNITS) {
    const empt = u.filter(i => cand[i].length >= 2 && cand[i].length <= 4);
    for (const cs of combosK(empt.length, 4)) {
      const cells = cs.map(o => empt[o]);
      const uni = new Set(cells.flatMap(i => cand[i]));
      if (uni.size === 4) {
        const elim: number[] = [];
        for (const i of u) if (!cells.includes(i)) for (const d of uni) if (cand[i].includes(d)) elim.push(i);
        if (elim.length) return { tech: 'naked-quad', desc: `Naked quad ${[...uni].sort().join('/')} locks those digits out of the unit.`, elim: { cells: elim, digits: [...uni] }, at: cells };
      }
    }
  }
  return null;
}
function hiddenQuadStep(cand: number[][]): Hint | null {
  for (const u of UNITS) {
    const digitCells: number[][] = Array.from({ length: 9 }, () => []);
    for (const i of u) for (const d of cand[i]) if (!u.some(j => j !== i && cand[j].length === 1 && cand[j][0] === d)) digitCells[d - 1].push(i);
    for (const ds of combosK(9, 4)) {
      const digits = ds.map(x => x + 1);
      const places = u.filter(i => digits.some(d => digitCells[d - 1].includes(i)) && !u.some(j => j !== i && cand[j].length === 1 && digits.includes(cand[j][0])));
      if (places.length === 4) {
        const elim: number[] = [];
        for (const i of places) for (const d of cand[i]) if (!digits.includes(d)) elim.push(i);
        if (elim.length) return { tech: 'hidden-quad', desc: `Hidden quad ${digits.join('/')} is confined to those cells.`, elim: { cells: elim, digits: [] }, at: places };
      }
    }
  }
  return null;
}

export function solveTrace(g: Grid): { tech: string; cells: number[]; digits: number[]; place: number[] | null }[] {
  const values = [...g];
  const cd = allCandidates(values);
  const out: { tech: string; cells: number[]; digits: number[]; place: number[] | null }[] = [];
  for (let guard = 0; guard < 300; guard++) {
    if (values.every(v => v)) break;
    const h = anyStep(cd, countSolutions([...values]) === 1);
    if (!h) break;
    out.push({ tech: h.tech, cells: (h.elim?.cells || []).slice().sort((a, b) => a - b), digits: (h.elim?.digits || []).slice().sort((a, b) => a - b), place: h.place ? [h.place.cell, h.place.digit] : null });
    if (h.place) {
      const pc = h.place.cell, pd = h.place.digit;
      values[pc] = pd;
      for (let i = 0; i < 81; i++) {
        if (i === pc) { cd[i] = []; continue; }
        if (PEERS[i].includes(pc)) cd[i] = cd[i].filter(d => d !== pd);
      }
    }
    if (h.elim) for (const c of h.elim.cells) cd[c] = cd[c].filter(d => !h.elim!.digits.includes(d));
  }
  return out;
}

function fishStep(cand: number[][]): Hint | null { return fishStepM(cand); }

// Conjugate-chain painter for the UI: 2-color the connected component of the
// strong-link graph for `digit` containing `cell`. Deliberately duplicates
// coloringStep's adjacency rule instead of refactoring it: coloringStep is
// gate-verified and stays untouched. conflict=true means an odd cycle
// (component not 2-colorable => Rule-2 contradiction territory).
export function colorChains(cand: number[][], cell: number, digit: number): { colorOf: number[]; conflict: boolean } | null {
  const adj = new Map<number, number[]>();
  for (const u of UNITS) { const cs = u.filter(i => cand[i].includes(digit)); if (cs.length === 2) { adj.set(cs[0], [...(adj.get(cs[0]) || []), cs[1]]); adj.set(cs[1], [...(adj.get(cs[1]) || []), cs[0]]); } }
  if (!adj.has(cell)) return null;
  const colorOf = new Array(81).fill(-1);
  let conflict = false;
  colorOf[cell] = 0;
  const q = [cell];
  while (q.length) { const cur = q.pop()!; for (const nb of adj.get(cur) || []) { const want = colorOf[cur] === 0 ? 1 : 0; if (colorOf[nb] === -1) { colorOf[nb] = want; q.push(nb); } else if (colorOf[nb] !== want) conflict = true; } }
  return { colorOf, conflict };
}
