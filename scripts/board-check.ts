import { decode, findContradiction, hintFor, countSolutions } from '../lib/sudoku';
const p = process.argv[2];
const g = decode(p);
if (!g) { console.log('BAD STRING'); process.exit(1); }
const fc = findContradiction(g);
const h = hintFor(g);
console.log('findContradiction:', fc);
console.log('hint:', h ? h.tech : null);
console.log('solutions(<=2):', countSolutions([...g]));
process.exit(fc === null && h !== null ? 0 : 1);
