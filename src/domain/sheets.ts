import type { Rules } from '../data';
import type { KtSheet, KtWeapon, Text, UnitSheet, W40kWeapon } from '../data/sheets';
import type { Band, Operative } from './model';

// Fiche technique : profils, armes retenues et définitions des mots-clés (pour les infobulles).

/** Fiche Kill Team d'un opérateur (null pour une unité 40k ou une fiche inconnue). */
export const ktSheetOf = (r: Rules, o: Operative): KtSheet | null => ktSheetOfProfile(r, o.profile);

/** Une option par groupe d'armes : celle retenue sur l'opérateur, sinon la première. */
export function chosenOptions<W>(groups: { name: string; options: { name: string; weapons: W[] }[] }[], loadout: string[]) {
  return groups.map((g) => g.options.find((o) => loadout.includes(o.name)) ?? g.options[0]!);
}

/** Remplace, dans les options retenues, celle du même groupe. */
export const withChoice = (loadout: string[], groupOptions: string[], choice: string) =>
  [...loadout.filter((x) => !groupOptions.includes(x)), choice];

/** Fiche Kill Team d'un profil (pour choisir les armes avant que l'opérateur existe). */
export function ktSheetOfProfile(r: Rules, p: Operative['profile']): KtSheet | null {
  return p.source === 'killteam' && p.killteam ? r.sheets.killteams[p.killteam]?.operatives[p.name] ?? null : null;
}

export function ktWeapons(sheet: KtSheet, loadout: string[]): KtWeapon[] {
  return [...chosenOptions(sheet.weaponGroups, loadout).flatMap((o) => o.weapons), ...sheet.weapons];
}

/** Pour une unité 40k : le modèle et l'option retenus (une seule option, parmi tous les modèles). */
export function unitChoice(sheet: UnitSheet, loadout: string[]) {
  const all = sheet.models.flatMap((m) => m.options.map((opt) => ({ model: m, opt })));
  return all.find((x) => loadout.includes(x.opt.name)) ?? all[0] ?? null;
}

export function unitWeapons(sheet: UnitSheet, loadout: string[]): W40kWeapon[] {
  return unitChoice(sheet, loadout)?.opt.weapons ?? [];
}

/** Éléments d'une liste de règles d'arme (« Range 8", Hot, Lethal 5+ »), en gardant les virgules entre parenthèses. */
export function splitRules(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((x) => x && x !== '-');
}

/** Base d'un nom de règle : « Lethal x+ », « Lethal 5+ », « Heavy (Dash only) », « Anti-INFANTRY 4+ » → lethal, lethal, heavy, anti-. */
export function ruleKey(s: string): string {
  const k = s.replace(/^\*+|\*+$/g, '').replace(/\s*\(.*\)\s*$/, '').toLowerCase().trim();
  if (k.startsWith('anti-')) return 'anti-';
  return k.replace(/(\s+(x\+?|d?\d+\+?"?|d\d|\d*d\d(\+\d)?))+$/, '').trim();
}

export type Glossary = Map<string, Text>;

/** Dictionnaire des définitions : clé normalisée → nom et texte. Les premières sources gagnent. */
export function glossary(...sources: (Record<string, string> | Text[])[]): Glossary {
  const g: Glossary = new Map();
  for (const src of sources) {
    const items = Array.isArray(src) ? src : Object.entries(src).map(([name, text]) => ({ name, text }));
    for (const t of items) if (t.text && !g.has(ruleKey(t.name))) g.set(ruleKey(t.name), t);
  }
  return g;
}

/** Définition d'un élément de règle d'arme, en essayant aussi son premier mot (« Piercing Crits 1 » → Piercing). */
export function lookup(g: Glossary, token: string): Text | null {
  const k = ruleKey(token);
  return g.get(k) ?? g.get(k.split(' ')[0]!) ?? null;
}

/** Glossaire d'une kill team : règles d'armes, règles de faction, capacités de ses opérateurs. */
export function ktGlossary(r: Rules, killteam: string): Glossary {
  const kt = r.sheets.killteams[killteam];
  return glossary(r.sheets.weaponRules, kt?.factionRules ?? [], Object.values(kt?.operatives ?? {}).flatMap((o) => o.abilities));
}

/** Texte d'un équipement (faction de la bande, puis universel, puis autres kill teams). */
export function equipmentText(r: Rules, band: Band, name: string): Text | null {
  const n = name.toLowerCase();
  const all = [r.sheets.killteams[band.killteam]?.equipment ?? [], r.sheets.universalEquipment, ...Object.values(r.sheets.killteams).map((k) => k.equipment)];
  for (const list of all) {
    const hit = list.find((e) => e.name.toLowerCase() === n);
    if (hit) return hit;
  }
  return null;
}
