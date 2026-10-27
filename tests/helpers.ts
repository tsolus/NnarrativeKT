import { loadRules } from '../src/data';
import { createBand, type Ctx } from '../src/domain/actions';
import { fixedRng, type Rng } from '../src/domain/dice';
import { defaultRoster } from '../src/domain/roster';
import type { Band } from '../src/domain/model';

export const rules = loadRules();
export const ctx = (rng: Rng = fixedRng([])): Ctx => ({ r: rules, now: 1_700_000_000_000, rng });

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
