import type { Rules } from '../data';
import type { Band, Operative, Profile } from './model';
import { killteamOf } from './roster';

/** Valeur d'un agent en RQ : points 40k par figurine ÷ 4, arrondi au supérieur, minimum 2, +1. null si pas de points. */
export function agentValue(r: Rules, p: Profile): number | null {
  if (p.pts40k == null) return null;
  const a = r.campaign.agent;
  return Math.max(a.minimum, Math.ceil(p.pts40k / a.pointsDivisor)) + a.surcharge;
}

/** Prix de recrutement : recrue de sa kill team (30 ÷ taille, chef ×2) ou agent. */
export function recruitCost(r: Rules, band: Band, p: Profile): number | null {
  if (p.source === 'killteam' && p.killteam === band.killteam) {
    const size = killteamOf(r, band).selectionSize;
    return Math.ceil(r.campaign.recruit.base / size) * (p.leader ? r.campaign.recruit.leaderMultiplier : 1);
  }
  return agentValue(r, p);
}

export function upgradeLimit(r: Rules, o: Pick<Operative, 'elite' | 'profile'>): number {
  if (o.profile.noUpgrades) return 0;
  return o.elite ? r.campaign.upgrades.perElite : r.campaign.upgrades.perTroop;
}

export const isUniversal = (r: Rules, equipment: string) => r.universalEquipment.some((e) => e.name === equipment);
export const equipmentPrice = (r: Rules, equipment: string) =>
  isUniversal(r, equipment) ? r.campaign.prices.universalEquipment : r.campaign.prices.factionEquipment;
export const sellPrice = (r: Rules, price: number) => Math.ceil(price * r.campaign.prices.sellRatio);

/** Équipements pouvant devenir « attitrés » : faction + universels assignables, pas déjà attitrés dans la bande. */
export function assignableEquipment(r: Rules, band: Band): string[] {
  const taken = new Set(band.operatives.flatMap((o) => o.upgrades.map((u) => u.equipment).filter(Boolean)));
  const kt = killteamOf(r, band);
  return [...kt.factionEquipment, ...r.universalEquipment.filter((e) => e.assignable).map((e) => e.name)].filter((e) => !taken.has(e));
}
