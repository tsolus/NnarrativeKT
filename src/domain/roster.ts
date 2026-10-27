import type { Rules } from '../data';
import type { KillTeamDef, OperativeDef, Unit40k } from '../data/schema';
import { Band, Operative, Profile, gone } from './model';

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function killteamOf(r: Rules, band: Pick<Band, 'killteam'>): KillTeamDef {
  const kt = r.killteamByName.get(band.killteam);
  if (!kt) throw new Error(`Kill team inconnue : ${band.killteam}`);
  return kt;
}

export function profileFromKillteam(kt: KillTeamDef, o: OperativeDef): Profile {
  return {
    source: 'killteam', killteam: kt.name, name: o.name, faction: kt.faction, alliance: kt.alliance,
    pts40k: o.pts40k, leader: o.leader, halfSelection: !!o.halfSelection, noUpgrades: !!o.noUpgrades,
  };
}
export function profileFromUnit(u: Unit40k): Profile {
  return {
    source: 'unit40k', name: u.name, faction: u.faction, alliance: u.alliance,
    pts40k: u.ptsPerModel, leader: false, halfSelection: false, noUpgrades: false,
  };
}
export const profileLabel = (p: Profile) => (p.source === 'killteam' ? `${p.name} · ${p.killteam}` : `${p.name} · ${p.faction} (40k)`);
export const sameProfile = (a: Profile, b: Profile) => a.source === b.source && a.name === b.name && (a.killteam ?? a.faction) === (b.killteam ?? b.faction);

export function newOperative(profile: Profile, name: string, extra: Partial<Operative> = {}): Operative {
  return Operative.parse({ id: newId(), name, profile, elite: profile.leader, ...extra });
}

/** Un agent est tout opérateur qui ne vient pas de la kill team de la bande. */
export const isAgent = (band: Pick<Band, 'killteam'>, o: Pick<Operative, 'profile'>) =>
  o.profile.source !== 'killteam' || o.profile.killteam !== band.killteam;

export const selectionWeight = (ops: Pick<Operative, 'profile'>[]) => ops.reduce((s, o) => s + (o.profile.halfSelection ? 0.5 : 1), 0);

/**
 * Sélection de base proposée à la création : le chef, les opérateurs obligatoires,
 * puis un exemplaire de chaque fiche (un seul GRAVIS), puis la fiche « plusieurs » pour compléter.
 */
export function defaultRoster(kt: KillTeamDef): Operative[] {
  const picked: OperativeDef[] = [];
  let w = 0;
  const add = (o: OperativeDef) => { picked.push(o); w += o.halfSelection ? 0.5 : 1; };
  const leader = kt.operatives.find((o) => o.leader);
  if (leader) add(leader);
  for (const o of kt.operatives.filter((o) => o.mandatory)) for (let i = 0; i < (o.max ?? 1); i++) add(o);
  const usedKeywords = new Set<string>();
  for (const o of kt.operatives) {
    if (w >= kt.selectionSize) break;
    if (o.leader || o.mandatory || o.max === null) continue;
    const kw = (o.keywords ?? []).find((k) => usedKeywords.has(k));
    if (kw) continue;
    (o.keywords ?? []).forEach((k) => usedKeywords.add(k));
    for (let i = 0; i < o.max && w + (o.halfSelection ? 0.5 : 1) <= kt.selectionSize; i++) add(o);
  }
  const filler = [...kt.operatives].reverse().find((o) => o.max === null);
  while (filler && w < kt.selectionSize) add(filler);
  return withNumberedNames(picked.map((o) => newOperative(profileFromKillteam(kt, o), o.name)));
}

function withNumberedNames(ops: Operative[]): Operative[] {
  const total = new Map<string, number>();
  ops.forEach((o) => total.set(o.name, (total.get(o.name) ?? 0) + 1));
  const seen = new Map<string, number>();
  return ops.map((o) => {
    if ((total.get(o.name) ?? 0) < 2) return o;
    const n = (seen.get(o.name) ?? 0) + 1;
    seen.set(o.name, n);
    return { ...o, name: `${o.name} ${n}` };
  });
}

/** Nom libre pour une nouvelle recrue : « Warrior », puis « Warrior 2 »… */
export function freeName(band: Band, base: string): string {
  const names = new Set(band.operatives.map((o) => o.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export interface CatalogueQuery { text?: string; faction?: string | '*' | 'alliance'; source?: 'all' | 'killteam' | 'unit40k' }

/** Toutes les recrues possibles (fiches Kill Team + unités 40k), triées : sa kill team, puis sa faction, puis le reste. */
export function catalogue(r: Rules, band: Band, q: CatalogueQuery): Profile[] {
  const text = (q.text ?? '').trim().toLowerCase();
  const alliance = r.killteams.find((k) => k.faction === band.faction)?.alliance ?? r.units.find((u) => u.faction === band.faction)?.alliance;
  const factionOk = (p: Profile) =>
    !q.faction || q.faction === '*' || (q.faction === 'alliance' ? p.alliance === alliance : p.faction === q.faction);
  const out: Profile[] = [];
  if (q.source !== 'unit40k')
    for (const kt of r.killteams) for (const o of kt.operatives) {
      const p = profileFromKillteam(kt, o);
      if (factionOk(p) && (!text || `${o.name} ${kt.name}`.toLowerCase().includes(text))) out.push(p);
    }
  if (q.source !== 'killteam')
    for (const u of r.units) {
      const p = profileFromUnit(u);
      if (factionOk(p) && (!text || u.name.toLowerCase().includes(text))) out.push(p);
    }
  const rank = (p: Profile) => (p.source === 'killteam' && p.killteam === band.killteam ? 0 : p.source === 'killteam' ? 2 : 4) + (p.faction === band.faction ? 0 : 1);
  return out.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
}

export function factions(r: Rules): string[] {
  return [...new Set([...r.killteams.map((k) => k.faction), ...r.units.map((u) => u.faction)])].sort((a, b) => a.localeCompare(b));
}

export const aliveOperatives = (b: Band) => b.operatives.filter((o) => !gone(o));
