import type { Rules } from '../data';
import { Band, Game, STATUS_LABEL, available, gone } from './model';
import { agentValue, upgradeLimit } from './costs';
import { isAgent, killteamOf, selectionWeight } from './roster';
import { actFor, bandStats } from './scoring';

/** Contrôles du registre : chaque message est une règle du livret non respectée. */
export function rosterChecks(r: Rules, band: Band): string[] {
  const w: string[] = [];
  const kt = killteamOf(r, band);
  const alive = band.operatives.filter((o) => !gone(o));
  const own = alive.filter((o) => !isAgent(band, o));
  const agents = alive.filter((o) => isAgent(band, o));
  const c = r.campaign;

  const weight = selectionWeight(own);
  const maxRoster = kt.selectionSize + c.roster.reserves;
  if (weight > maxRoster) w.push(`Registre : ${weight} opérateurs de la kill team pour ${maxRoster} au plus (sélection de ${kt.selectionSize} + ${c.roster.reserves} réservistes).`);
  if (agents.length > c.roster.maxAgents) w.push(`${agents.length} agents au registre, ${c.roster.maxAgents} au plus.`);

  const elites = alive.filter((o) => o.elite).length;
  const maxElites = Math.ceil(kt.selectionSize * c.roster.maxElitesRatio);
  if (elites > maxElites) w.push(`${elites} Élites pour ${maxElites} au plus (moitié de la sélection).`);

  const count = new Map<string, number>();
  own.forEach((o) => count.set(o.profile.name, (count.get(o.profile.name) ?? 0) + 1));
  for (const def of kt.operatives) {
    const n = count.get(def.name) ?? 0;
    if (def.max !== null && n > def.max) w.push(`${def.name} : ${n} au registre pour ${def.max} au plus sur la fiche.`);
  }

  const assigned = new Set<string>();
  for (const o of alive) {
    const lim = upgradeLimit(r, o);
    if (o.upgrades.length && o.profile.noUpgrades) w.push(`${o.name} ne peut pas recevoir d'amélioration (drone, bête, squig…).`);
    else if (o.upgrades.length > lim) w.push(`${o.name} : ${o.upgrades.length} améliorations pour ${lim} au plus (${o.elite ? 'Élite' : 'troupe'}).`);
    const names = o.upgrades.map((u) => u.name);
    if (new Set(names).size < names.length) w.push(`${o.name} a deux fois la même amélioration.`);
    for (const u of o.upgrades) {
      if (!u.equipment) continue;
      if (assigned.has(u.equipment)) w.push(`Équipement attitré « ${u.equipment} » pris deux fois dans la bande.`);
      assigned.add(u.equipment);
    }
  }

  if (!own.some((o) => o.profile.leader)) w.push('Aucun chef au registre.');
  const ready = selectionWeight(own.filter(available));
  if (ready < kt.selectionSize) w.push(`${ready} opérateurs disponibles pour une sélection de ${kt.selectionSize} : la bande peut appeler des renforts.`);
  const relics = alive.map((o) => o.relic).filter(Boolean);
  if (new Set(relics).size < relics.length) w.push('Une même relique est attribuée à deux opérateurs.');
  return w;
}

export interface Lineup {
  nextGame: number;
  act: ReturnType<typeof actFor>;
  weight: number;
  agents: number;
  reinforcementValue: number;
  warnings: string[];
}

/** Sélection préparée pour la prochaine partie (opérateurs cochés « aligné ») et seuil de renforts. */
export function lineup(r: Rules, band: Band, games: Game[]): Lineup {
  const kt = killteamOf(r, band);
  const fielded = band.operatives.filter((o) => !gone(o) && o.fielded);
  const own = fielded.filter((o) => !isAgent(band, o));
  const agents = fielded.filter((o) => isAgent(band, o));
  const value =
    agents.reduce((s, o) => s + (agentValue(r, o.profile) ?? 0), 0) +
    fielded.reduce((s, o) => s + o.upgrades.length * r.campaign.upgrades.price, 0);
  const nextGame = bandStats(r, band.id, games).played + 1;
  const act = actFor(r, nextGame);
  const weight = selectionWeight(own);
  const warnings: string[] = [];
  if (weight !== kt.selectionSize) warnings.push(`${weight} opérateurs de la kill team alignés pour une sélection de ${kt.selectionSize}.`);
  if (!own.some((o) => o.profile.leader)) warnings.push("Le chef n'est pas aligné.");
  fielded.filter((o) => !available(o)).forEach((o) => warnings.push(`${o.name} est ${STATUS_LABEL[o.status]} et ne peut pas jouer.`));
  if (value > act.threshold)
    warnings.push(`Renforts alignés : ${value} RQ pour un seuil de ${act.threshold} RQ. Au-delà, un agent reste au registre et une amélioration est ignorée.`);
  return { nextGame, act, weight, agents: agents.length, reinforcementValue: value, warnings };
}
