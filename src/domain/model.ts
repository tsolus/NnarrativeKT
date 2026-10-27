import { z } from 'zod';

// Documents enregistrés dans la base partagée. Chaque document porte schemaVersion :
// quand le format change, on monte la version et on ajoute une étape dans migrations.ts.
export const SCHEMA_VERSION = 3;

export const Profile = z.object({
  source: z.enum(['killteam', 'unit40k']),
  killteam: z.string().optional(), // présent si source = killteam
  name: z.string(),
  faction: z.string(),
  alliance: z.string(),
  pts40k: z.number().nullable(),
  leader: z.boolean().default(false),
  halfSelection: z.boolean().default(false),
  noUpgrades: z.boolean().default(false),
});
export type Profile = z.infer<typeof Profile>;

export const OperativeStatus = z.enum(['active', 'injured', 'captured', 'dead', 'retired']);
export type OperativeStatus = z.infer<typeof OperativeStatus>;
export const STATUS_LABEL: Record<OperativeStatus, string> = {
  active: 'actif', injured: 'blessé', captured: 'capturé', dead: 'mort', retired: 'retiré',
};

export const Upgrade = z.object({ name: z.string(), equipment: z.string().optional() });
export type Upgrade = z.infer<typeof Upgrade>;

export const Operative = z.object({
  id: z.string(),
  name: z.string(),
  profile: Profile,
  elite: z.boolean().default(false),
  xp: z.number().int().min(0).default(0),
  scars: z.number().int().min(0).default(0),
  sequelae: z.array(z.string()).default([]),
  honours: z.array(z.string()).default([]),
  upgrades: z.array(Upgrade).default([]),
  loadout: z.array(z.string()).default([]), // options d'armes retenues (fiche technique), une par groupe
  relic: z.string().default(''),
  status: OperativeStatus.default('active'),
  fielded: z.boolean().default(true), // aligné à la prochaine partie
  notes: z.string().default(''),
  origin: z.enum(['start', 'recruit', 'agent']).default('start'),
  cost: z.number().default(0),
});
export type Operative = z.infer<typeof Operative>;

export const LogEntry = z.object({ at: z.number(), text: z.string() });

/**
 * Mouvement du livre de comptes. Les soldes (RQ, Gloire, points bonus) ne sont jamais saisis :
 * ils sont la somme des mouvements, plus la Gloire des exploits tirée des parties (voir treasury.ts).
 */
export const Transaction = z.object({
  id: z.string(),
  at: z.number(),
  label: z.string(),
  rq: z.number().int().default(0),
  glory: z.number().int().default(0),
  points: z.number().int().default(0),
  kind: z.enum(['purchase', 'sale', 'loot', 'reward', 'rank', 'reinforcements', 'correction', 'opening']).default('correction'),
});
export type Transaction = z.infer<typeof Transaction>;

export const Band = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  player: z.string().default(''),
  ownerId: z.string().nullable().default(null),
  killteam: z.string(),
  faction: z.string(),
  operatives: z.array(Operative).default([]),
  arsenal: z.array(z.string()).default([]),
  relics: z.array(z.string()).default([]),
  discoveredPlaces: z.array(z.string()).default([]),
  explorationSkills: z.string().default(''),
  createdAt: z.number().default(0),
  updatedAt: z.number().default(0),
  log: z.array(LogEntry).default([]),
  transactions: z.array(Transaction).default([]),
});
export type Band = z.infer<typeof Band>;

export const GameResult = z.enum(['win', 'draw', 'loss']);
export type GameResult = z.infer<typeof GameResult>;
export const RESULT_LABEL: Record<GameResult, string> = { win: 'Victoire', draw: 'Nul', loss: 'Défaite' };

export const Game = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  date: z.string().default(''),
  mission: z.string().default(''),
  notes: z.string().default(''),
  sides: z.array(z.object({ bandId: z.string(), result: GameResult, exploits: z.number().int().min(0).default(0) })).min(2),
  createdAt: z.number().default(0),
});
export type Game = z.infer<typeof Game>;

export const gone = (o: Operative) => o.status === 'dead' || o.status === 'retired';
export const available = (o: Operative) => o.status === 'active';
