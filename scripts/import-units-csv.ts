// Régénère data/units-40k.json depuis data/sources/points_40k.csv (export BSData wh40k-10e, séparateur « ; »).
// Usage : npm run data:units [-- chemin.csv]
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2] ?? 'data/sources/points_40k.csv';
const lines = readFileSync(src, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const OTHERS = new Set(['Unaligned Forces', 'Library - Titans', 'Library - Astartes Heresy Legends']);

function clean(raw: string) {
  const head = raw.split(' - ')[0]!;
  const alliance = head === 'Imperium' || head === 'Chaos' ? head : OTHERS.has(raw) ? 'Autres' : 'Xenos';
  let f = raw;
  if (raw.includes(' - ') && ['Imperium', 'Chaos', 'Aeldari'].includes(head)) f = raw.split(' - ').slice(1).join(' - ');
  f = f.replace('Library - ', '').replace(' - Library', '').replace(' Library', '');
  return { faction: f === 'Aeldari' || f === 'Aeldari Library' ? 'Aeldari' : f, alliance };
}

const units = lines.slice(1).map((l) => {
  const c = l.split(';');
  return { ...clean(c[0]!), name: c[1]!, ptsPerModel: Math.round(Number(c[4])) };
});
const body = units.map((u) => '    ' + JSON.stringify(u)).join(',\n');
writeFileSync('data/units-40k.json', `{\n  "$comment": "Généré par npm run data:units depuis points_40k.csv (BSData wh40k-10e). Ne pas éditer à la main.",\n  "units": [\n${body}\n  ]\n}\n`);
console.log(`${units.length} unités écrites dans data/units-40k.json`);
