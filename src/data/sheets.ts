import { z } from 'zod';
import killteamSheetsJson from '../../data/sheets/killteams.json';

// Fiches techniques. Kill teams : data/sheets/killteams.json, chargé avec l'appli.
// Unités 40k : public/sheets-40k/, un fichier par catalogue, chargé à la demande (plusieurs Mo au total).
// Les deux sont générés depuis BSData (scripts/import_bsdata_*.py).

const Text = z.object({ name: z.string(), text: z.string() });
export type Text = z.infer<typeof Text>;

export const KtWeapon = z.object({ name: z.string(), type: z.enum(['ranged', 'melee']), atk: z.string(), hit: z.string(), dmg: z.string(), wr: z.string() });
export type KtWeapon = z.infer<typeof KtWeapon>;
const Option = <W extends z.ZodTypeAny>(w: W) => z.object({ name: z.string(), weapons: z.array(w) });

export const KtSheet = z.object({
  stats: z.object({ APL: z.string(), Move: z.string(), Save: z.string(), Wounds: z.string() }),
  keywords: z.array(z.string()),
  abilities: z.array(Text),
  actions: z.array(Text),
  weaponGroups: z.array(z.object({ name: z.string(), options: z.array(Option(KtWeapon)) })),
  weapons: z.array(KtWeapon),
});
export type KtSheet = z.infer<typeof KtSheet>;

export const KillTeamSheetsFile = z.object({
  weaponRules: z.record(z.string()),
  universalEquipment: z.array(Text),
  killteams: z.record(z.object({ factionRules: z.array(Text), equipment: z.array(Text), operatives: z.record(KtSheet) })),
});
export type KillTeamSheets = z.infer<typeof KillTeamSheetsFile>;

export const loadKillTeamSheets = (): KillTeamSheets => KillTeamSheetsFile.parse(killteamSheetsJson);

export const W40kWeapon = z.object({
  name: z.string(), type: z.enum(['ranged', 'melee']), range: z.string(), a: z.string(), skill: z.string(),
  s: z.string(), ap: z.string(), d: z.string(), keywords: z.string(),
});
export type W40kWeapon = z.infer<typeof W40kWeapon>;
export const UnitSheet = z.object({
  models: z.array(z.object({ name: z.string(), stats: z.record(z.string()), options: z.array(Option(W40kWeapon)) })),
  abilities: z.array(Text),
  rules: z.array(z.string()),
  keywords: z.array(z.string()),
  faction: z.array(z.string()),
});
export type UnitSheet = z.infer<typeof UnitSheet>;
const CatalogueFile = z.object({ rules: z.record(z.string()), units: z.record(UnitSheet) });

export interface UnitSheetResult { sheet: UnitSheet; rules: Record<string, string> }

const cache = new Map<string, Promise<unknown>>();
const getJson = (file: string) => {
  if (!cache.has(file)) cache.set(file, fetch(`sheets-40k/${file}`).then((r) => { if (!r.ok) throw new Error(`${file} : ${r.status}`); return r.json(); }));
  return cache.get(file)!;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Fiche d'une unité 40k ; si plusieurs catalogues la décrivent, celui de sa faction est préféré. */
export async function loadUnitSheet(name: string, faction: string): Promise<UnitSheetResult | null> {
  const index = z.record(z.array(z.string())).parse(await getJson('index.json'));
  const files = index[name] ?? [];
  const file = files.find((f) => f.includes(slug(faction))) ?? files[0];
  if (!file) return null;
  const cat = CatalogueFile.parse(await getJson(file));
  const sheet = cat.units[name];
  return sheet ? { sheet, rules: cat.rules } : null;
}
