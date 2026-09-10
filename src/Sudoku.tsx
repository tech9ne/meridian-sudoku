'use client';
import { useEffect, useRef, useState } from 'react';
import { Diff, Grid, generateGraded, decode, solveFully, hintFor, peersOf, allCandidates, candidatesFor, encode, findContradiction, colorChains } from '@/lib/sudoku';

const DIFFS: Diff[] = ['easy', 'medium', 'hard', 'diabolical'];
type Marks = number[][];
const emptyMarks = (): Marks => Array.from({ length: 81 }, () => []);
const emptyStrikes = (): Marks => Array.from({ length: 81 }, () => []);
const emptyColors = (): number[][] => Array.from({ length: 81 }, () => Array(9).fill(-1));
function Icon({ d, className }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-5 h-5'} aria-hidden="true"><path d={d} /></svg>;
}
const IC = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  undo: 'M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z', redo: 'M12 5V2l5 4-5 4V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z',
  pencil: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.75 3.75L20.7 7z',
  bulb: 'M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z',
  menu: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
};

export default function Sudoku() {
  const [diff, setDiff] = useState<Diff>('medium');
  const [gen, setGen] = useState(() => generateGraded('medium'));
  const [shared] = useState(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search).get('p');
    if (!p) return null;
    const g = decode(p); if (!g) return null;
    const sol = solveFully(g); return sol ? { puzzle: g, solution: sol } : null;
  });
  const [puzzle, setPuzzle] = useState<Grid>(shared?.puzzle ?? gen.puzzle);
  const [solution, setSolution] = useState<Grid>(shared?.solution ?? gen.solution);
  const [grade, setGrade] = useState<Diff | null>(shared ? null : gen.grade);
  const [values, setValues] = useState<Grid>([...(shared?.puzzle ?? gen.puzzle)]);
  const [marks, setMarks] = useState<Marks>(emptyMarks());
  const [strikes, setStrikes] = useState<Marks>(emptyStrikes());
  const [showStrikes, setShowStrikes] = useState(true);
  const [colors, setColors] = useState<number[][]>(emptyColors());
  const [colorMode, setColorMode] = useState(false);
  const [nextColor, setNextColor] = useState<0 | 1>(1);
  const [chainMode, setChainMode] = useState(false);
  const [links, setLinks] = useState<{ fromCell: number; fromDigit: number; toCell: number; toDigit: number; kind: 'strong' | 'weak' }[]>([]);
  const [arrowMode, setArrowMode] = useState(false);
  const [linkSource, setLinkSource] = useState<{ cell: number; digit: number } | null>(null);
  const [linkKind, setLinkKind] = useState<'strong' | 'weak'>('strong');
  const [arrowStyle, setArrowStyle] = useState<'colored' | 'red'>('colored');
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(36);
  useEffect(() => { const measure = () => { if (boardRef.current) { const cell = boardRef.current.querySelector('.sd-cell'); if (cell) setCellSize(cell.getBoundingClientRect().width); } }; measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, []);
  const [sel, setSel] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [activeDigit, setActiveDigit] = useState<number | null>(null);
  const [mode, setMode] = useState<'digit' | 'cell'>('digit');
  const [notes, setNotes] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(true);
  const [msg, setMsg] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [importText, setImportText] = useState('');
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const undoStack = useRef<{ v: Grid; m: Marks; k: Marks; c: number[][]; n: 0 | 1; l: typeof links }[]>([]);
  const redoStack = useRef<{ v: Grid; m: Marks; k: Marks; c: number[][]; n: 0 | 1; l: typeof links }[]>([]);

  const won = values.join('') === solution.join('');
  useEffect(() => { if (!running || won) return; const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t); }, [running, won]);
  useEffect(() => { if (won) setRunning(false); }, [won]);
  useEffect(() => { if (sel === null) { const i = values.findIndex((v, idx) => v === 0 && puzzle[idx] === 0); if (i >= 0) setSel(i); } }, []);
  useEffect(() => { if (!shared) setDiff(gen.grade); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) { if (sel !== null) writeCell(sel, Number(e.key)); }
      else if (e.key === 'Backspace') erase();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const snapshot = () => { undoStack.current.push({ v: [...values], m: marks.map(x => [...x]), k: strikes.map(x => [...x]), c: colors.map(r => [...r]), n: nextColor, l: [...links] }); redoStack.current = []; };
  const undo = () => { const s = undoStack.current.pop(); if (!s) return; redoStack.current.push({ v: [...values], m: marks.map(x => [...x]), k: strikes.map(x => [...x]), c: colors.map(r => [...r]), n: nextColor, l: [...links] }); setValues(s.v); setMarks(s.m); setStrikes(s.k); setColors(s.c); setNextColor(s.n); setLinks(s.l); };
  const redo = () => { const s = redoStack.current.pop(); if (!s) return; undoStack.current.push({ v: [...values], m: marks.map(x => [...x]), k: strikes.map(x => [...x]), c: colors.map(r => [...r]), n: nextColor, l: [...links] }); setValues(s.v); setMarks(s.m); setStrikes(s.k); setColors(s.c); setNextColor(s.n); setLinks(s.l); };
  const newPuzzle = (d: Diff) => {
    setBusy(true); setDiff(d); setMenu(false);
    setTimeout(() => {
      const g = generateGraded(d);
      setGen(g); setPuzzle(g.puzzle); setSolution(g.solution); setGrade(g.grade);
      setDiff(g.grade);
      setValues([...g.puzzle]); setMarks(emptyMarks()); setStrikes(emptyStrikes()); setColors(emptyColors()); setLinks([]); setLinkSource(null); setNextColor(1);
      const fe = g.puzzle.findIndex(v => v === 0); setSel(fe >= 0 ? fe : null);
      setFocus(null); setActiveDigit(null); setSecs(0); setRunning(true); setMsg(g.grade === d ? '' : `Requested ${d}; true grade is ${g.grade}.`); setWrong(new Set());
      undoStack.current = []; redoStack.current = []; setBusy(false);
    }, 30);
  };

  const writeCell = (i: number, d: number) => {
    if (puzzle[i] !== 0 || won) return;
    setWrong(w => { const n = new Set(w); n.delete(i); return n; });
    snapshot();
    if (notes) setMarks(m => m.map((cell, k) => (k === i ? (cell.includes(d) ? cell.filter(x => x !== d) : [...cell, d].sort()) : cell)));
    else { setValues(v => { const n = [...v]; n[i] = d; return n; }); const ps = new Set(peersOf(i)); setMarks(m => m.map((cell, k) => (k === i ? [] : ps.has(k) ? cell.filter(x => x !== d) : cell))); }
  };
  const erase = () => { if (sel === null || puzzle[sel] !== 0) return; snapshot(); setValues(v => { const n = [...v]; n[sel] = 0; return n; }); setMarks(m => m.map((c, i) => (i === sel ? [] : c))); setStrikes(st => st.map((c, i) => (i === sel ? [] : c))); setColors(cs => cs.map((row, i) => (i === sel ? Array(9).fill(-1) : row))); setLinks(ls => ls.filter(lk => lk.fromCell !== sel && lk.toCell !== sel)); setWrong(w => { const n = new Set(w); if (sel !== null) n.delete(sel); return n; }); };
  const onPad = (d: number) => {
    if (mode === 'digit') { if (activeDigit === d) { setActiveDigit(null); setFocus(null); } else { setActiveDigit(d); setFocus(d); } }
    else { if (sel !== null) { writeCell(sel, d); setSel(null); } }
  };
  const onCell = (i: number) => {
    if (puzzle[i] !== 0) { setSel(i); setFocus(values[i]); return; }
    if (mode === 'digit') { if (activeDigit !== null) { writeCell(i, activeDigit); setSel(i); setFocus(activeDigit); } else setSel(i); }
    else { setSel(i); setFocus(values[i] || null); }
  };
  const autoCands = () => { snapshot(); setMarks(allCandidates(values)); setStrikes(emptyStrikes()); setColors(emptyColors()); setNextColor(1); setLinks([]); setLinkSource(null); setMenu(false); setMsg('Candidates calculated.'); };
  const clearMarks = () => { snapshot(); setMarks(emptyMarks()); setStrikes(emptyStrikes()); setColors(emptyColors()); setNextColor(1); setLinks([]); setLinkSource(null); setMenu(false); };
  const conflictAt = (i: number) => { const d = values[i]; return d !== 0 && peersOf(i).some(p => values[p] === d); };
  const hasConflict = () => values.some((v, i) => v !== 0 && conflictAt(i));
  const hint = () => {
    if (hasConflict()) { setMsg('Invalid position: duplicate digit in a house — fix the red cells first.'); return; }
    const contra = findContradiction(values);
    if (contra) { setMsg(`No solution from here: ${contra}`); return; }
    const h = hintFor(values);
    if (!h) { setMsg('No technique in the implemented ladder applies here; a longer chain or a guess may be needed.'); return; }
    snapshot();
    if (autoApply) {
      if (h.place) { const { cell, digit } = h.place; const ps = new Set(peersOf(cell)); setValues(v => { const n = [...v]; n[cell] = digit; return n; }); setMarks(m => m.map((c, i) => (i === cell ? [] : ps.has(i) ? c.filter(x => x !== digit) : c))); }
      else if (h.elim) { setMarks(m => m.map((c, i) => (h.elim!.cells.includes(i) ? c.filter(x => !h.elim!.digits.includes(x)) : c))); }
    }
    const subj = h.at && h.at.length ? h.at : h.place ? [h.place.cell] : h.elim ? h.elim.cells : [];
    const coord = (i: number) => `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`;
    const loc = subj.slice(0, 6).map(coord).join(' ') + (subj.length > 6 ? ` +${subj.length - 6}` : '');
    if (h.elim) setStrikes(st => st.map((c, i) => (h.elim!.cells.includes(i) ? [...new Set([...c, ...h.elim!.digits])] : c)));
    else if (h.place && autoApply) { const pc = h.place.cell, pd = h.place.digit; const ps2 = new Set(peersOf(pc)); setStrikes(st => st.map((c, i) => (i !== pc && ps2.has(i) && marks[i].includes(pd) ? [...new Set([...c, pd])] : c))); }
    setFlash(new Set(subj));
    setTimeout(() => setFlash(new Set()), 2600);
    setMsg(`${autoApply ? 'Applied — ' : ''}${h.tech}: ${h.desc}${loc ? ' → ' + loc : ''}`);
  };
  const share = async () => { setMenu(false); const url = `${location.origin}/games/sudoku?p=${encode(puzzle)}`; try { await navigator.clipboard.writeText(url); setMsg('Puzzle link copied.'); } catch { setMsg(url); } };

  const check = () => {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) if (puzzle[i] === 0 && values[i] !== 0 && values[i] !== solution[i]) bad.add(i);
    setWrong(bad);
    setMsg(bad.size ? `${bad.size} misplaced — flagged in red.` : 'All correct so far.');
  };
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'); const ss = String(secs % 60).padStart(2, '0');
  const iconBtn = (active = false) => `w-10 h-10 flex items-center justify-center border transition ${active ? 'text-copper border-copper/50 bg-copper/10' : 'border-line text-gray-300 hover:text-copper hover:border-copper'}`;
  const menuItem = 'w-full text-left px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-gray-300 hover:bg-ink-3 hover:text-copper transition';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h1 className="sd-title font-display font-extrabold text-white text-3xl uppercase tracking-wide">Sudoku</h1>
        <p className="sd-grade text-gray-500 text-xs mt-1 font-mono uppercase tracking-widest">{busy ? 'generating…' : grade ? `graded ${grade}` : 'shared puzzle'} · {mm}:{ss}</p>
      </div>
      <div className="sd-diff flex gap-1.5 flex-wrap justify-center">
        {DIFFS.map(d => (
          <button key={d} onClick={() => newPuzzle(d)} className={`font-mono text-[10px] uppercase tracking-widest border px-3 py-1.5 transition ${diff === d && !shared ? 'text-copper border-copper/50 bg-copper/10' : 'text-gray-400 border-line hover:text-white'}`}>{d}</button>
        ))}
      </div>
      <div className="sd-tools relative flex gap-1.5">
        <button onClick={() => setRunning(r => !r)} className={iconBtn()} aria-label="Pause/Resume"><Icon d={running ? IC.pause : IC.play} /></button>
        <button onClick={undo} className={iconBtn()} aria-label="Undo"><Icon d={IC.undo} /></button>
        <button onClick={redo} className={iconBtn()} aria-label="Redo"><Icon d={IC.redo} /></button>
        <button onClick={() => setNotes(n => !n)} className={iconBtn(notes)} aria-label="Notes mode"><Icon d={IC.pencil} /></button>
        <button onClick={hint} className={iconBtn()} aria-label="Hint"><Icon d={IC.bulb} /></button>
        <button onClick={check} className={iconBtn()} aria-label="Check"><Icon d={IC.check} /></button>
        <button onClick={() => setMenu(m => !m)} className={iconBtn(menu)} aria-label="More options"><Icon d={IC.menu} /></button>
        {menu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenu(false)}></div>
            <div className="absolute right-0 top-full mt-2 w-52 bg-ink-2 border border-line rounded overflow-hidden z-30">
              <button className={menuItem} onClick={autoCands}>Auto candidates</button>
              <button className={menuItem} onClick={clearMarks}>Clear marks</button>
              <button className={menuItem} onClick={() => { setShowMarks(s => !s); setMenu(false); }}>{showMarks ? 'Hide marks' : 'Show marks'}</button>
              <button className={menuItem} onClick={() => { setColorMode(x => !x); setMenu(false); }}>Color mode: {colorMode ? 'on' : 'off'}</button>
              <button className={menuItem} onClick={() => { setChainMode(x => !x); setMenu(false); }}>Chain paint: {chainMode ? 'on' : 'off'}</button>
              <button className={menuItem} onClick={() => { setArrowMode(x => !x); setLinkSource(null); setMenu(false); }}>Arrow mode: {arrowMode ? 'on' : 'off'}</button>
              <button className={menuItem} onClick={() => { setLinkKind(k => k === 'strong' ? 'weak' : 'strong'); setMenu(false); }}>Link kind: {linkKind}</button>
              <button className={menuItem} onClick={() => { setArrowStyle(x => x === 'colored' ? 'red' : 'colored'); setMenu(false); }}>Arrow style: {arrowStyle}</button>
              <button className={menuItem} onClick={() => { snapshot(); setLinks([]); setLinkSource(null); setMenu(false); }}>Clear arrows</button>
              <button className={menuItem} onClick={() => { snapshot(); setColors(emptyColors()); setNextColor(1); setMenu(false); }}>Clear colors</button>
              <button className={menuItem} onClick={() => { setShowStrikes(x => !x); setMenu(false); }}>Strikethrough: {showStrikes ? 'on' : 'off'}</button>
              <button className={menuItem} onClick={() => { setAutoApply(a => !a); setMenu(false); }}>Hint auto-apply: {autoApply ? 'on' : 'off'}</button>
              <button className={menuItem} onClick={() => { setImportModal(true); setMenu(false); }}>Import puzzle</button>
              <button className={menuItem} onClick={share}>Share puzzle</button>
            </div>
          </>
        )}
      </div>
      <button onClick={() => setMode(m => (m === 'digit' ? 'cell' : 'digit'))} className="sd-mode font-mono text-[10px] uppercase tracking-widest border border-copper/40 text-copper px-3 py-1.5 hover:bg-copper hover:text-ink transition" title="Toggle input mode">
        {mode === 'digit' ? 'Digit-first' : 'Cell-first'}
      </button>
      {msg && !won && <p className="font-mono text-[11px] text-copper max-w-md text-center">{msg}</p>}
      {won && <p className="font-mono text-sm uppercase tracking-widest text-green-500">Solved clean in {mm}:{ss}.</p>}
      {!running && !won && <p className="font-mono text-sm uppercase tracking-widest text-gray-500">Paused</p>}
      {hasConflict() && <p className="font-mono text-[11px] text-alert uppercase tracking-widest">Invalid position: duplicate in a house — fix the red cells.</p>}
      <div ref={boardRef} className="sd-board grid grid-cols-3 gap-[3px] p-[3px] border-2 relative" style={{ visibility: running || won ? 'visible' : 'hidden', backgroundColor: 'var(--sd-frame,#D97706)', borderColor: 'var(--sd-frame,#D97706)' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {links.map((lk, idx) => {
              if (!boardRef.current) return null;
              const cell0 = boardRef.current.querySelector('.sd-cell');
              if (!cell0) return null;
              const cs = cellSize;
              const gap = 1, boxGap = 3, pad = 3;
              const cellX = (ci: number) => { const col = ci % 9; const boxCol = Math.floor(col / 3); return pad + boxCol * (3 * cs + 2 * gap + boxGap) + (col % 3) * (cs + gap); };
              const cellY = (ci: number) => { const row = Math.floor(ci / 9); const boxRow = Math.floor(row / 3); return pad + boxRow * (3 * cs + 2 * gap + boxGap) + (row % 3) * (cs + gap); };
              const candX = (ci: number, d: number) => cellX(ci) + ((d - 1) % 3) * (cs / 3) + cs / 6;
              const candY = (ci: number, d: number) => cellY(ci) + (Math.floor((d - 1) / 3)) * (cs / 3) + cs / 6;
              const x1 = candX(lk.fromCell, lk.fromDigit), y1 = candY(lk.fromCell, lk.fromDigit);
              const x2 = candX(lk.toCell, lk.toDigit), y2 = candY(lk.toCell, lk.toDigit);
              const fromColor = colors[lk.fromCell][lk.fromDigit - 1];
              const toColor = colors[lk.toCell][lk.toDigit - 1];
              const strokeColor = arrowStyle === 'red' ? '#E8112D' : fromColor === 0 ? 'var(--sd-colA,#14532d)' : fromColor === 1 ? 'var(--sd-colB,#0c4a6e)' : toColor === 0 ? 'var(--sd-colA,#14532d)' : toColor === 1 ? 'var(--sd-colB,#0c4a6e)' : '#A8A29E';
              const ang = Math.atan2(y2 - y1, x2 - x1); const hl = 7; const hx1 = x2 - hl * Math.cos(ang - 0.45), hy1 = y2 - hl * Math.sin(ang - 0.45); const hx2 = x2 - hl * Math.cos(ang + 0.45), hy2 = y2 - hl * Math.sin(ang + 0.45); return <g key={idx}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={arrowStyle === 'red' ? (lk.kind === 'strong' ? 3.5 : 2) : 2} strokeDasharray={lk.kind === 'weak' ? (arrowStyle === 'red' ? '2,4' : '4,2') : undefined} /><polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={strokeColor} /></g>;
            })}
          </svg>
          {[0,1,2,3,4,5,6,7,8].map(b => (
          <div key={b} className="grid grid-cols-3 gap-[1px]" style={{ backgroundColor: 'var(--sd-grid,#332F2B)' }}>
            {Array.from({ length: 9 }).map((_, k) => {
              const r = Math.floor(b / 3) * 3 + Math.floor(k / 3);
              const c = (b % 3) * 3 + (k % 3);
              const i = r * 9 + c;
              const v = values[i];
              const onOrange = focus !== null && v === focus;
              const onRed = focus !== null && v === 0 && (marks[i].length ? marks[i].includes(focus) : candidatesFor(values, i).includes(focus));
              return (
                <button key={i} onClick={() => onCell(i)}
                  className={`sd-cell w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 relative flex items-center justify-center font-mono text-sm md:text-base lg:text-lg xl:text-xl font-bold ${flash.has(i) ? 'ring-2 ring-green-500 ring-inset' : sel === i ? 'ring-2 ring-copper ring-inset' : ''} transition`}
                  style={{ backgroundColor: onOrange ? '#F7941D' : onRed ? 'var(--sd-focus,#E8112D)' : flash.has(i) ? 'var(--sd-flash,transparent)' : 'var(--sd-cell,#211F1D)', color: wrong.has(i) || conflictAt(i) ? 'var(--color-alert,#CC0000)' : onOrange || onRed ? '#fff' : puzzle[i] ? 'var(--sd-given,var(--sd-digit,#F5F1E8))' : 'var(--sd-entered,var(--sd-digit,#F5F1E8))' }}>
                  {v || ''}
                  {(wrong.has(i) || conflictAt(i)) && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-alert"></span>}
                  {arrowMode && linkSource && linkSource.cell === i && <span className="absolute inset-0 ring-2 ring-cyan-400 ring-inset pointer-events-none"></span>}
                  {!v && showMarks && (marks[i].length > 0 || (showStrikes && strikes[i].length > 0) || colors[i].some(c => c >= 0) || colorMode || arrowMode) && (
                    <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                      {[1,2,3,4,5,6,7,8,9].map(d => (
                        <span key={d} onClick={(ev) => { ev.stopPropagation(); if (arrowMode) { snapshot(); if (!linkSource) { setLinkSource({ cell: i, digit: d }); return; } if (linkSource.cell === i && linkSource.digit === d) { setLinkSource(null); return; } setLinks(ls => [...ls, { fromCell: linkSource.cell, fromDigit: linkSource.digit, toCell: i, toDigit: d, kind: linkKind }]); setLinkSource(null); return; } if (!colorMode) return; snapshot(); const cc = nextColor; if (chainMode) { const ch = colorChains(allCandidates(values), i, d); if (!ch) { setMsg('No conjugate chain through this candidate.'); return; } if (ch.conflict) { setMsg('Odd cycle: this chain self-contradicts — one color dies.'); return; } const other = cc === 0 ? 1 : 0; setColors(cs => cs.map((row, j) => (ch.colorOf[j] >= 0 ? row.map((c, x) => (x === d - 1 ? (ch.colorOf[j] === 0 ? cc : other) : c)) : row))); setNextColor(other); return; } setColors(cs => cs.map((row, j) => (j === i ? row.map((c, x) => (x === d - 1 ? cc : c)) : row))); setNextColor(cc === 0 ? 1 : 0); }} className={"sd-mark flex items-center justify-center text-[8px] md:text-[10px] lg:text-[11px] xl:text-[12px]" + (showStrikes && !marks[i].includes(d) && strikes[i].includes(d) ? " line-through opacity-60" : "")} style={{ color: onRed || onOrange ? '#fff' : (showStrikes && !marks[i].includes(d) && strikes[i].includes(d) ? 'var(--sd-struck,#991b1b)' : 'var(--sd-mark,#A8A29E)'), backgroundColor: colors[i][d - 1] === 0 ? 'var(--sd-colA,#14532d)' : colors[i][d - 1] === 1 ? 'var(--sd-colB,#0c4a6e)' : undefined, pointerEvents: (colorMode || arrowMode) ? 'auto' : 'none' }}>{marks[i].includes(d) || (showStrikes && strikes[i].includes(d)) || colors[i][d - 1] >= 0 || ((colorMode || arrowMode) && (marks[i].length ? marks[i].includes(d) : candidatesFor(values, i).includes(d))) ? d : ''}</span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {importModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImportModal(false)}>
          <div className="bg-ink-2 border border-line rounded max-w-md w-full p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-wide">Import puzzle</h3>
            <p className="text-gray-400 text-xs font-mono">Paste an 81-char grid string (0 or . = empty, 1-9 = given) or a 729-char pencil-mark string.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} className="w-full bg-ink-3 border border-line text-white font-mono text-xs p-2 outline-none focus:border-copper" placeholder="81 or 729 characters" />
            <div className="flex gap-2">
              <button onClick={() => {
                const t = importText.trim();
                if (t.length === 81) {
                  const g = Array.from(t).map(c => c === '.' || c === '0' ? 0 : parseInt(c));
                  const sol = solveFully(g);
                  if (!sol) { setMsg('Invalid puzzle: no solution'); setImportModal(false); return; }
                  setPuzzle(g); setSolution(sol); setGrade(null); setValues([...g]); setMarks(emptyMarks()); setStrikes(emptyStrikes()); setColors(emptyColors()); setNextColor(1); setLinks([]); setLinkSource(null); setSel(null); setFocus(null); setActiveDigit(null); setSecs(0); setRunning(true); setMsg(''); setWrong(new Set()); setImportModal(false);
                } else if (t.length === 729) {
                  const g = new Array(81).fill(0);
                  const m: number[][] = [];
                  for (let i = 0; i < 81; i++) {
                    const s9 = t.slice(i * 9, i * 9 + 9);
                    const cands: number[] = [];
                    for (let d = 0; d < 9; d++) if (s9[d] === '1') cands.push(d + 1);
                    m.push(cands);
                    if (cands.length === 1) g[i] = cands[0];
                  }
                  const sol = solveFully(g);
                  if (!sol) { setMsg('Invalid pencil marks: no solution'); setImportModal(false); return; }
                  setPuzzle(g); setSolution(sol); setGrade(null); setValues([...g]); setMarks(m); setStrikes(emptyStrikes()); setColors(emptyColors()); setNextColor(1); setLinks([]); setLinkSource(null); setSel(null); setFocus(null); setActiveDigit(null); setSecs(0); setRunning(true); setMsg(''); setWrong(new Set()); setImportModal(false);
                } else { setMsg('Invalid length: need 81 or 729 chars'); }
              }} className="font-mono text-[10px] uppercase tracking-widest border border-copper text-copper px-4 py-2 hover:bg-copper hover:text-ink transition">Load</button>
              <button onClick={() => setImportModal(false)} className="font-mono text-[10px] uppercase tracking-widest border border-line text-gray-300 px-4 py-2 hover:border-copper hover:text-copper transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="sd-pad flex gap-1.5 flex-wrap justify-center">
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button key={d} onClick={() => onPad(d)}
            className={`w-9 h-10 font-mono border transition ${mode === 'digit' && activeDigit === d ? 'border-copper bg-copper text-ink font-bold' : focus === d ? 'border-copper/60 text-copper' : 'border-line text-gray-200 hover:border-copper hover:text-copper'}`}>{d}</button>
        ))}
        <button onClick={erase} className="sd-erase px-3 h-10 font-mono text-xs uppercase border border-line text-gray-400 hover:border-alert hover:text-alert transition">Erase</button>
      </div>
    </div>
  );
}
