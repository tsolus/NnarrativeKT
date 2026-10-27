import { loadRules } from '../src/data';
import { createBand, type Ctx } from '../src/domain/actions';
import { fixedRng, type Rng } from '../src/domain/dice';
import { defaultRoster } from '../src/domain/roster';
import type { Band, Game } from '../src/domain/model';

export const rules = loadRules();
export const ctx = (rng: Rng = fixedRng([]), games: Game[] = []): Ctx => ({ r: rules, now: 1_700_000_000_000, rng, games });

export function band(killteam = 'Nemesis Claw', patch: Partial<Band> = {}): Band {
  const kt = rules.killteamByName.get(killteam)!;
  const ops = defaultRoster(kt);
  ops[1]!.elite = true;
  return { ...createBand(ctx(), { name: 'Test', player: '', ownerId: null, killteam, faction: kt.faction, operatives: ops, arsenal: [] }), ...patch };
}

export function ok<T extends { ok: boolean }>(o: T): Extract<T, { ok: true }> {
  if (!o.ok) throw new Error('Échec inattendu : ' + (o as any).error);
  return o as any;
}

import { balance } from '../src/domain/treasury';
import { correction } from '../src/domain/actions';
export const money = (b: Band, games: Game[] = []) => balance(rules, b, games);
/** Bande avec un solde donné (le départ fait 5 RQ). */
export function funded(rq: number, glory = 0, killteam = 'Nemesis Claw'): Band {
  const b = band(killteam);
  const cur = money(b);
  return ok(correction(ctx(), b, { rq: rq - cur.rq, glory: glory - cur.glory, points: 0 }, 'test')).band;
}
