import { describe, expect, it } from 'vitest';
import { rules, ctx, band, ok } from './helpers';
import * as A from '../src/domain/actions';
import { agentValue, recruitCost, upgradeLimit } from '../src/domain/costs';
import { lineup, rosterChecks } from '../src/domain/checks';
import { fixedRng, inRange } from '../src/domain/dice';
import { createGame, gameErrors } from '../src/domain/games';
import { explorationFor, explorationResult, rankOf, rollHonours, traumaResult } from '../src/domain/phase';
import { catalogue, defaultRoster, profileFromKillteam, selectionWeight } from '../src/domain/roster';
import { actFor, bandStats, ranking } from '../src/domain/scoring';

const kt = (n: string) => rules.killteamByName.get(n)!;
const def = (k: string, op: string) => profileFromKillteam(kt(k), kt(k).operatives.find((o) => o.name === op)!);

describe('données', () => {
  it('chargent et sont cohérentes', () => {
    expect(rules.killteams).toHaveLength(10);
    expect(rules.units.length).toBeGreaterThan(1000);
    expect(rules.sequelae.sequelae.at(-1)!.roll).toBe('66');
  });
  it('couvrent tous les résultats de d66 et de 2d6', () => {
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++)
      expect(rules.sequelae.sequelae.filter((s) => inRange(s.roll, a * 10 + b))).toHaveLength(1);
  });
});

describe('sélection de base', () => {
  it.each(rules.killteams.map((k) => k.name))('%s : sélection légale complète', (name) => {
    const k = kt(name);
    const ops = defaultRoster(k);
    expect(selectionWeight(ops)).toBe(k.selectionSize);
    expect(ops.filter((o) => o.profile.leader)).toHaveLength(1);
    for (const d of k.operatives) if (d.max !== null) expect(ops.filter((o) => o.profile.name === d.name).length).toBeLessThanOrEqual(d.max);
    expect(new Set(ops.map((o) => o.name)).size).toBe(ops.length);
  });
  it('Deathwatch : un seul GRAVIS', () => {
    const ops = defaultRoster(kt('Deathwatch'));
    const gravis = kt('Deathwatch').operatives.filter((o) => o.keywords?.includes('GRAVIS')).map((o) => o.name);
    expect(ops.filter((o) => gravis.includes(o.profile.name))).toHaveLength(1);
  });
});

describe('coûts', () => {
  it('recrue = 30 ÷ taille arrondi, chef ×2', () => {
    const b = band('Nemesis Claw'); // 6
    expect(recruitCost(rules, b, def('Nemesis Claw', 'Warrior'))).toBe(5);
    expect(recruitCost(rules, b, def('Nemesis Claw', 'Visionary'))).toBe(10);
    expect(recruitCost(rules, band('Vespid Stingwings'), def('Vespid Stingwings', 'Warrior'))).toBe(3); // 30/11
  });
  it('agent = pts ÷ 4 (min 2) + 1', () => {
    const b = band('Nemesis Claw');
    expect(recruitCost(rules, b, def('Murderwing', 'Raptor'))).toBe(7); // 22 pts
    expect(agentValue(rules, { ...def('Murderwing', 'Raptor'), pts40k: 6 })).toBe(3);
    expect(agentValue(rules, def('Vespid Stingwings', 'Oversight Drone'))).toBeNull();
  });
  it('limite d’améliorations', () => {
    expect(upgradeLimit(rules, { elite: false, profile: def('Nemesis Claw', 'Warrior') })).toBe(1);
    expect(upgradeLimit(rules, { elite: true, profile: def('Nemesis Claw', 'Warrior') })).toBe(2);
    expect(upgradeLimit(rules, { elite: true, profile: def('Wrecka Krew', 'Bomb Squig') })).toBe(0);
  });
});

describe('actions', () => {
  it('recruter débite les RQ et marque les agents', () => {
    const b = band('Nemesis Claw');
    const r1 = ok(A.recruit(ctx(), b, def('Nemesis Claw', 'Warrior'), 'Krull', false));
    expect(r1.band.requisitions).toBe(0);
    expect(r1.band.operatives.at(-1)).toMatchObject({ name: 'Krull', origin: 'recruit', cost: 5, fielded: false });
    expect(b.requisitions).toBe(5); // l'original n'est pas modifié
    const r2 = A.recruit(ctx(), b, def('Murderwing', 'Raptor'), 'Vol', false);
    expect(r2.ok).toBe(false);
    const r3 = ok(A.recruit(ctx(), b, def('Murderwing', 'Raptor'), 'Vol', true));
    expect(r3.band.operatives.at(-1)!.origin).toBe('agent');
  });
  it('améliorations : prix, limite, doublon, équipement attitré unique', () => {
    let b = { ...band('Nemesis Claw'), requisitions: 20 };
    const troop = b.operatives.find((o) => !o.elite)!.id;
    const elite = b.operatives.find((o) => o.elite && !o.profile.leader)!.id;
    b = ok(A.buyUpgrade(ctx(), b, troop, 'Entraînement au tir', undefined, false)).band;
    expect(b.requisitions).toBe(17);
    expect(A.buyUpgrade(ctx(), b, troop, 'Entraînement physique', undefined, false).ok).toBe(false);
    b = ok(A.buyUpgrade(ctx(), b, elite, 'Équipement attitré', 'Chain Snare', false)).band;
    expect(A.buyUpgrade(ctx(), b, elite, 'Équipement attitré', 'Flayed Skin', false).ok).toBe(false); // déjà prise
    const lead = b.operatives.find((o) => o.profile.leader)!.id;
    expect(A.buyUpgrade(ctx(), b, lead, 'Équipement attitré', 'Chain Snare', false).ok).toBe(false); // déjà attitré
    expect(rosterChecks(rules, b)).toEqual([]);
  });
  it('traumatisme de troupe : 1 mort, 2 blessé', () => {
    const b = band();
    const t = b.operatives.find((o) => !o.elite)!;
    const dead = ok(A.applyTrauma(ctx(), b, t.id, traumaResult(rules, t, 1)!)).band;
    expect(dead.operatives.find((o) => o.id === t.id)!.status).toBe('dead');
    const hurt = ok(A.applyTrauma(ctx(), b, t.id, traumaResult(rules, t, 2)!)).band;
    expect(hurt.operatives.find((o) => o.id === t.id)!.status).toBe('injured');
  });
  it('traumatisme d’Élite : séquelle + cicatrice, 3e cicatrice = retraite, pas de doublon', () => {
    let b = band();
    const e = b.operatives.find((o) => o.elite)!;
    b = ok(A.applyTrauma(ctx(), b, e.id, traumaResult(rules, e, 31)!)).band; // Jambe blessée
    const o = () => b.operatives.find((x) => x.id === e.id)!;
    expect(o()).toMatchObject({ scars: 1, sequelae: ['Jambe blessée'] });
    expect(A.applyTrauma(ctx(), b, e.id, traumaResult(rules, e, 31)!).ok).toBe(false);
    b = ok(A.applyTrauma(ctx(), b, e.id, traumaResult(rules, e, 45)!)).band; // Récupération totale
    expect(o().scars).toBe(1);
    b = ok(A.applyTrauma(ctx(), b, e.id, traumaResult(rules, e, 15)!)).band;
    b = ok(A.applyTrauma(ctx(), b, e.id, traumaResult(rules, e, 15)!)).band; // Œil crevé répétable
    expect(o().status).toBe('retired');
    const fresh = band(), fe = fresh.operatives.find((x) => x.elite)!;
    const after = ok(A.applyTrauma(ctx(fixedRng([2])), fresh, fe.id, traumaResult(rules, fe, 65)!)).band; // Amères leçons
    expect(after.operatives.find((x) => x.id === fe.id)!).toMatchObject({ xp: 2, scars: 0 });
  });
  it('vente d’équipement à moitié prix arrondi au supérieur', () => {
    let b = { ...band(), requisitions: 10 };
    b = ok(A.buyEquipment(ctx(), b, 'Chain Snare', false)).band;
    expect(b.requisitions).toBe(7);
    b = ok(A.sellEquipment(ctx(), b, 0)).band;
    expect(b.requisitions).toBe(9);
  });
});

describe('contrôles et seuil', () => {
  it('signale trop d’Élites et trop d’agents', () => {
    let b = band();
    b.operatives.forEach((o) => (o.elite = true));
    expect(rosterChecks(rules, b).some((m) => m.includes('Élites'))).toBe(true);
    for (let i = 0; i < 5; i++) b = ok(A.recruit(ctx(), b, def('Murderwing', 'Raptor'), 'A' + i, true)).band;
    expect(rosterChecks(rules, b).some((m) => m.includes('agents'))).toBe(true);
  });
  it('seuil de renforts : agents alignés + améliorations', () => {
    let b = { ...band(), requisitions: 10 };
    b = ok(A.recruit(ctx(), b, def('Murderwing', 'Raptor'), 'Vol', true)).band;
    b.operatives.at(-1)!.fielded = true;
    const L = lineup(rules, b, []);
    expect(L.reinforcementValue).toBe(7);
    expect(L.act.threshold).toBe(4);
    expect(L.warnings.some((w) => w.includes('seuil'))).toBe(true);
  });
});

describe('parties et classement', () => {
  it('points 3/2/1 + exploits, 12e partie doublée', () => {
    const a = band(), b = band();
    const games = Array.from({ length: 12 }, (_, i) => createGame(i, { date: `2027-01-${String(i + 1).padStart(2, '0')}`, mission: '', notes: '',
      sides: [{ bandId: a.id, result: 'win', exploits: 1 }, { bandId: b.id, result: 'loss', exploits: 0 }] }));
    expect(bandStats(rules, a.id, games).points).toBe(11 * 4 + 8);
    expect(bandStats(rules, b.id, games).points).toBe(11 + 2);
    const rk = ranking(rules, [b, a], games);
    expect(rk[0]!.band.id).toBe(a.id);
    expect(rk[1]!.catchUp).toBe(true);
    expect(gameErrors({ date: '', mission: '', notes: '', sides: [{ bandId: a.id, result: 'win', exploits: 0 }, { bandId: a.id, result: 'loss', exploits: 0 }] })).toHaveLength(1);
  });
  it('actes', () => {
    expect([1, 4, 5, 9, 12, 15].map((n) => actFor(rules, n).threshold)).toEqual([4, 4, 10, 18, 25, 25]);
  });
});

describe('phase de campagne', () => {
  it('rangs, exploration et honneurs', () => {
    expect(rankOf(rules, 5)).toEqual({ name: 'Aguerri', honoursDue: 2 });
    expect(explorationFor(rules, 0)).toEqual({ dice: 3, tables: ['Courante'] });
    expect(explorationFor(rules, 10).dice).toBe(6);
    const res = explorationResult(rules, 'Courante', [5, 4, 3], 0);
    expect(res).toMatchObject({ total: 12, loot: 2 });
    expect(res.place!.name).toBe('Prisonnier');
    const h = rollHonours(rules, fixedRng([3, 4, 6, 6]), ['Mêlée', 'Tir']);
    expect(h[0]).toMatchObject({ value: 7, name: 'Maître d’armes'.replace('’', "'") });
    expect(h[1]).toMatchObject({ value: 12, free: true });
  });
});

describe('catalogue de recrutement', () => {
  it('filtre par faction, alliance et texte', () => {
    const b = band('Nemesis Claw');
    const own = catalogue(rules, b, { faction: 'Chaos Space Marines' });
    expect(own[0]!.killteam).toBe('Nemesis Claw');
    expect(own.every((p) => p.faction === 'Chaos Space Marines')).toBe(true);
    expect(catalogue(rules, b, { faction: 'alliance' }).every((p) => p.alliance === 'Chaos')).toBe(true);
    expect(catalogue(rules, b, { faction: '*', text: 'intercessor' }).length).toBeGreaterThan(0);
  });
});
