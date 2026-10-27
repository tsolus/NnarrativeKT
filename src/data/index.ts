import * as S from './schema';
import killteamsJson from '../../data/killteams.json';
import universalJson from '../../data/equipment-universal.json';
import unitsJson from '../../data/units-40k.json';
import campaignJson from '../../data/campaign.json';
import exploitsJson from '../../data/rules/exploits.json';
import sequelaeJson from '../../data/rules/sequelae.json';
import honoursJson from '../../data/rules/honours.json';
import ranksJson from '../../data/rules/ranks.json';
import relicsJson from '../../data/rules/relics.json';
import upgradesJson from '../../data/rules/upgrades.json';
import explorationJson from '../../data/rules/exploration.json';

/** Toutes les données de référence, validées. Le domaine ne lit jamais les JSON directement. */
export function loadRules() {
  const killteams = S.KillTeamsFile.parse(killteamsJson).killteams;
  const units = S.UnitsFile.parse(unitsJson).units;
  const universal = S.UniversalEquipmentFile.parse(universalJson).equipment;
  const rules = {
    campaign: S.CampaignFile.parse(campaignJson),
    killteams,
    killteamByName: new Map(killteams.map((k) => [k.name, k])),
    units,
    universalEquipment: universal,
    exploits: S.ExploitsFile.parse(exploitsJson),
    sequelae: S.SequelaeFile.parse(sequelaeJson),
    honours: S.HonoursFile.parse(honoursJson),
    ranks: S.RanksFile.parse(ranksJson).ranks,
    relics: S.RelicsFile.parse(relicsJson).relics,
    upgrades: S.UpgradesFile.parse(upgradesJson).upgrades,
    exploration: S.ExplorationFile.parse(explorationJson),
  };
  checkConsistency(rules);
  return rules;
}
export type Rules = ReturnType<typeof loadRules>;

/** Contrôles que les schémas ne peuvent pas exprimer (références croisées). */
export function checkConsistency(r: Omit<Rules, never>): void {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const kt of r.killteams) {
    if (ids.has(kt.id)) errors.push(`Kill team en double : ${kt.id}`);
    ids.add(kt.id);
    if (!kt.operatives.some((o) => o.leader)) errors.push(`${kt.name} : aucun chef`);
    const names = new Set<string>();
    for (const o of kt.operatives) {
      if (names.has(o.name)) errors.push(`${kt.name} : opérateur en double ${o.name}`);
      names.add(o.name);
    }
  }
  const acts = [...r.campaign.acts].sort((a, b) => a.fromGame - b.fromGame);
  acts.forEach((a, i) => {
    const next = acts[i + 1];
    if (next && next.fromGame !== a.toGame + 1) errors.push(`Actes : trou ou chevauchement entre ${a.name} et ${next.name}`);
  });
  for (const t of r.exploration.dice.flatMap((d) => d.tables)) {
    if (!r.exploration.tables.some((x) => x.name === t)) errors.push(`Exploration : table inconnue ${t}`);
  }
  if (!r.upgrades.some((u) => u.needsEquipment)) errors.push('Améliorations : aucune entrée « équipement attitré »');
  if (errors.length) throw new Error('Données incohérentes :\n- ' + errors.join('\n- '));
}
