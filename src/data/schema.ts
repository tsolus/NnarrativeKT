import { z } from 'zod';

// Schémas des fichiers de data/. Toute donnée chargée passe par ici :
// une faute de frappe dans un JSON casse le build (npm run data:check), pas l'appli en partie.

export const OperativeDef = z.object({
  name: z.string().min(1),
  max: z.number().int().positive().nullable(), // null = plusieurs
  pts40k: z.number().nullable(),
  leader: z.boolean(),
  notes: z.string().optional(),
  halfSelection: z.boolean().optional(),
  noUpgrades: z.boolean().optional(),
  mandatory: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
});
export type OperativeDef = z.infer<typeof OperativeDef>;

export const KillTeamDef = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  faction: z.string(),
  alliance: z.string(),
  selectionSize: z.number().int().positive(),
  selectionRule: z.string(),
  operatives: z.array(OperativeDef).min(1),
  factionEquipment: z.array(z.string()),
});
export type KillTeamDef = z.infer<typeof KillTeamDef>;

export const KillTeamsFile = z.object({ killteams: z.array(KillTeamDef) });
export const UniversalEquipmentFile = z.object({
  equipment: z.array(z.object({ name: z.string(), assignable: z.boolean() })),
});
export const UnitsFile = z.object({
  units: z.array(z.object({ faction: z.string(), alliance: z.string(), name: z.string(), ptsPerModel: z.number() })),
});
export type Unit40k = z.infer<typeof UnitsFile>['units'][number];

/** Plage de dés écrite comme dans le livret : "11", "41-63", "10+", "7 ou moins". */
export const RollRange = z.string().regex(/^\d+(-\d+|\+| ou moins)?$/);

export const ExploitsFile = z.object({
  die: z.literal('d66'),
  exploits: z.array(z.object({ roll: RollRange, name: z.string(), condition: z.string() })),
});
export const SequelaKind = z.enum(['dead', 'captured', 'missNextGame', 'robbed', 'none', 'trait', 'gainXpD3', 'sequela']);
export type SequelaKind = z.infer<typeof SequelaKind>;
export const SequelaeFile = z.object({
  die: z.literal('d66'),
  noScarFrom: z.number().int(),
  sequelae: z.array(z.object({ roll: RollRange, name: z.string(), effect: z.string(), kind: SequelaKind, repeatable: z.boolean().optional() })),
});
export type Sequela = z.infer<typeof SequelaeFile>['sequelae'][number];
export const HonoursFile = z.object({
  die: z.literal('2d6'),
  freeChoiceOn: z.array(z.number().int()),
  tables: z.array(z.object({ name: z.string(), honours: z.array(z.object({ roll: z.number().int(), name: z.string(), effect: z.string() })) })),
});
export const RanksFile = z.object({ ranks: z.array(z.object({ name: z.string(), xp: z.number().int(), gain: z.string(), glory: z.number().int().optional() })) });
export const RelicsFile = z.object({ relics: z.array(z.object({ name: z.string(), glory: z.number().int(), effect: z.string() })) });
export const UpgradesFile = z.object({
  upgrades: z.array(z.object({ name: z.string(), effect: z.string(), needsEquipment: z.boolean().optional() })),
});
/** Récompense automatique d'un lieu d'exploration. Plusieurs récompenses = le joueur en choisit une. */
export const Reward = z.object({
  label: z.string().optional(),
  rq: z.number().int().optional(),
  glory: z.number().int().optional(),
  equipment: z.object({ type: z.enum(['universal', 'faction']), count: z.number().int().positive() }).optional(),
  relic: z.object({ maxGlory: z.number().int().nullable() }).optional(),
  xpFieldedElites: z.number().int().optional(),
  gloryToPoints: z.number().int().optional(),
});
export type Reward = z.infer<typeof Reward>;

export const ExplorationFile = z.object({
  dice: z.array(z.object({ fromGames: z.number().int(), toGames: z.number().int(), dice: z.number().int(), tables: z.array(z.string()) })),
  tables: z.array(z.object({ name: z.string(), places: z.array(z.object({ total: RollRange, name: z.string(), discovery: z.string(), rewards: z.array(Reward).optional() })) })),
});

export const CampaignFile = z.object({
  start: z.object({ requisitions: z.number(), glory: z.number(), elites: z.number(), universalEquipment: z.number(), factionEquipment: z.number() }),
  roster: z.object({ reserves: z.number(), maxAgents: z.number(), maxElitesRatio: z.number() }),
  recruit: z.object({ base: z.number(), leaderMultiplier: z.number() }),
  agent: z.object({ pointsDivisor: z.number(), minimum: z.number(), surcharge: z.number() }),
  upgrades: z.object({ price: z.number(), perTroop: z.number(), perElite: z.number() }),
  prices: z.object({ universalEquipment: z.number(), factionEquipment: z.number(), surgery: z.number(), mercenaryGlory: z.number(), sellRatio: z.number() }),
  acts: z.array(z.object({ name: z.string(), fromGame: z.number(), toGame: z.number(), threshold: z.number() })).min(1),
  compensationStep: z.number(),
  scoring: z.object({ win: z.number(), draw: z.number(), loss: z.number(), perExploit: z.number(), finalGame: z.number(), finalMultiplier: z.number() }),
  trauma: z.object({ troopDeadOn: z.array(z.number()), troopMissNextGameOn: z.array(z.number()), scarsToRetire: z.number(), scarsForVoluntaryRetirement: z.number() }),
  exploration: z.object({ lootDivisor: z.number() }),
  rewards: z.object({ gloryPerExploit: z.number() }),
});
export type Campaign = z.infer<typeof CampaignFile>;
