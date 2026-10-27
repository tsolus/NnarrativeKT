import type { Rules } from '../data';
import type { Reward, Sequela } from '../data/schema';
import type { Operative } from './model';
import { Rng, d6, d66, inRange, isD66, rollMany, twoD6 } from './dice';

// Jets de la phase de campagne. Ces fonctions ne modifient rien : elles décrivent un résultat,
// que actions.ts applique ensuite à la bande quand le joueur le confirme.

export type TraumaResult =
  | { die: 'd6'; value: number; title: string; text: string; outcome: 'dead' | 'missNextGame' | 'none' }
  | { die: 'd66'; value: number; title: string; text: string; sequela: Sequela; scar: boolean };

export function traumaResult(r: Rules, o: Pick<Operative, 'elite'>, value: number): TraumaResult | null {
  const t = r.campaign.trauma;
  if (!o.elite) {
    if (!Number.isInteger(value) || value < 1 || value > 6) return null;
    if (t.troopDeadOn.includes(value)) return { die: 'd6', value, title: 'Mort', text: 'retirez-le du registre.', outcome: 'dead' };
    if (t.troopMissNextGameOn.includes(value)) return { die: 'd6', value, title: 'Blessure mineure', text: 'il ne peut pas jouer la prochaine partie.', outcome: 'missNextGame' };
    return { die: 'd6', value, title: 'Retour normal', text: 'il revient normalement.', outcome: 'none' };
  }
  if (!isD66(value)) return null;
  const s = r.sequelae.sequelae.find((x) => inRange(x.roll, value));
  if (!s) return null;
  return { die: 'd66', value, title: s.name, text: s.effect, sequela: s, scar: value < r.sequelae.noScarFrom };
}

export const rollTrauma = (r: Rules, rng: Rng, o: Pick<Operative, 'elite'>) => traumaResult(r, o, o.elite ? d66(rng) : d6(rng))!;

export function rankOf(r: Rules, xp: number) {
  const reached = r.ranks.filter((k) => xp >= k.xp);
  return { name: reached[reached.length - 1]?.name ?? 'Novice', honoursDue: reached.length };
}

export interface HonourRoll { table: string; value: number; free: boolean; name?: string; effect?: string }

export function rollHonours(r: Rules, rng: Rng, tables: string[]): HonourRoll[] {
  return tables.map((table) => {
    const value = twoD6(rng);
    const h = r.honours.tables.find((t) => t.name === table)?.honours.find((x) => x.roll === value);
    if (r.honours.freeChoiceOn.includes(value) || !h) return { table, value, free: true };
    return { table, value, free: false, name: h.name, effect: h.effect };
  });
}
export const honourLabel = (name: string, table: string) => `${name} (${table})`;
export const allHonours = (r: Rules) => r.honours.tables.flatMap((t) => t.honours.map((h) => honourLabel(h.name, t.name)));

/** Dés et tables d'exploration selon le nombre de parties jouées. */
export function explorationFor(r: Rules, gamesPlayed: number) {
  const n = Math.max(1, gamesPlayed);
  const row = r.exploration.dice.find((d) => n >= d.fromGames && n <= d.toGames) ?? r.exploration.dice[r.exploration.dice.length - 1]!;
  return { dice: row.dice, tables: row.tables };
}

export const rollExploration = (rng: Rng, dice: number) => rollMany(rng, dice);

export function explorationResult(r: Rules, table: string, dice: number[], modifier: number) {
  const total = dice.reduce((s, x) => s + x, 0) + modifier;
  const place = r.exploration.tables.find((t) => t.name === table)?.places.find((p) => inRange(p.total, total)) ?? null;
  return { total, place, loot: Math.max(0, Math.floor(total / r.campaign.exploration.lootDivisor)) };
}

/** Texte court d'une récompense d'exploration, pour l'écran. */
export function describeReward(rw: Reward): string {
  if (rw.label) return rw.label;
  const p: string[] = [];
  if (rw.rq) p.push(`+${rw.rq} RQ`);
  if (rw.glory) p.push(`+${rw.glory} ☼`);
  if (rw.equipment) p.push(`${rw.equipment.count} équipement${rw.equipment.count > 1 ? 's' : ''} ${rw.equipment.type === 'faction' ? 'de faction' : 'universel'} gratuit${rw.equipment.count > 1 ? 's' : ''}`);
  if (rw.relic) p.push(rw.relic.maxGlory === null ? 'une relique au choix' : `une relique de ${rw.relic.maxGlory} ☼ ou moins`);
  if (rw.xpFieldedElites) p.push(`+${rw.xpFieldedElites} XP aux Élites alignées`);
  if (rw.gloryToPoints) p.push(`jusqu'à ${rw.gloryToPoints} ☼ échangés contre des points`);
  return p.join(', ');
}
