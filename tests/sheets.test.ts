import { describe, expect, it } from 'vitest';
import { chosenOptions, ktGlossary, ktSheetOfProfile, ktWeapons, lookup, ruleKey, splitRules, withChoice } from '../src/domain/sheets';
import { profileFromKillteam } from '../src/domain/roster';
import { rules } from './helpers';

const profile = (kt: string, op: string) => {
  const k = rules.killteamByName.get(kt)!;
  return profileFromKillteam(k, k.operatives.find((o) => o.name === op)!);
};

describe('fiches techniques', () => {
  it('chaque opérateur a un profil et au moins une arme par option', () => {
    for (const kt of rules.killteams) for (const o of kt.operatives) {
      const s = ktSheetOfProfile(rules, profileFromKillteam(kt, o))!;
      expect(s.stats.APL, `${kt.name} / ${o.name}`).toMatch(/^\d$/);
      expect(ktWeapons(s, []).length, `${kt.name} / ${o.name}`).toBeGreaterThan(0);
      for (const g of s.weaponGroups) for (const opt of g.options) expect(opt.weapons.length, `${o.name} : ${opt.name}`).toBeGreaterThan(0);
    }
  });
  it('options d’armes des règles officielles, tir et mêlée séparés', () => {
    const lp = ktSheetOfProfile(rules, profile('Void-Dancer Troupe', 'Lead Player'))!;
    expect(lp.weaponGroups.map((g) => g.name)).toEqual(['Tir', 'Mêlée']);
    const loadout = withChoice(withChoice([], lp.weaponGroups[0]!.options.map((o) => o.name), 'Neuro disruptor'), lp.weaponGroups[1]!.options.map((o) => o.name), 'Kiss');
    expect(ktWeapons(lp, loadout).map((w) => w.name)).toEqual(['Neuro disruptor', 'Kiss']);
    const gunner = ktSheetOfProfile(rules, profile('Nemesis Claw', 'Gunner'))!;
    expect(chosenOptions(gunner.weaponGroups, []).map((o) => o.name)).toEqual(['Flamer']); // première option par défaut
    expect(ktWeapons(gunner, ['Plasma gun']).map((w) => w.name)).toEqual(['Plasma gun (standard)', 'Plasma gun (supercharge)', 'Bolt pistol', 'Fists']);
  });
  it('correction d’après les règles officielles', () => {
    const w = ktWeapons(ktSheetOfProfile(rules, profile('Nemesis Claw', 'Gunner'))!, ['Plasma gun']);
    expect(w[0]!.dmg).toBe('4/6');
  });
  it('mots-clés : découpage et définitions', () => {
    expect(splitRules('Range 8", Heavy (Dash only), Lethal 5+')).toEqual(['Range 8"', 'Heavy (Dash only)', 'Lethal 5+']);
    expect(['Lethal x+', 'Lethal 5+', 'Piercing 1', 'Heavy (Dash only)', 'Anti-INFANTRY 4+', 'Sustained Hits D3', 'Terrorchem*'].map(ruleKey))
      .toEqual(['lethal', 'lethal', 'piercing', 'heavy', 'anti-', 'sustained hits', 'terrorchem']);
    const g = ktGlossary(rules, 'Nemesis Claw');
    expect(lookup(g, 'Lethal 5+')?.name).toBe('Lethal x+');
    expect(lookup(g, 'Piercing Crits 1')?.name).toBe('Piercing x');
    expect(lookup(g, 'Range 8"')?.name).toBe('Range x');
    expect(lookup(g, 'Inconnu')).toBeNull();
  });
});
