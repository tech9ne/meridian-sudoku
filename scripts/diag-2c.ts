import * as fs from 'fs';
const oldS = JSON.parse(fs.readFileSync('/tmp/snapshot-old.json', 'utf8'));
const newS = JSON.parse(fs.readFileSync('scripts/snapshot.json', 'utf8'));
let diff = 0, longer = 0, alsNew = 0, alsOld = 0;
for (let n = 0; n < Math.min(oldS.length, newS.length); n++) {
  const ot = oldS[n].trace.map((s: any) => s.tech); const nt = newS[n].trace.map((s: any) => s.tech);
  if (ot.join(',') !== nt.join(',')) { diff++; if (nt.length > ot.length) longer++;
    if (diff <= 4) console.log(`#${n} old(${ot.length}): ${ot.join(' ')}\n   new(${nt.length}): ${nt.join(' ')}`); }
  if (nt.includes('als-xz') && !ot.includes('als-xz')) alsNew++;
  if (ot.includes('als-xz')) alsOld++;
}
console.log(`TRACE_DIFF puzzles=${diff} longerNew=${longer} alsXzOnlyNew=${alsNew} alsXzOld=${alsOld}`);
