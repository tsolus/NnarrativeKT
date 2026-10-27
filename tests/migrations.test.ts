import { describe, expect, it } from 'vitest';
import { readBand, readGame } from '../src/domain/migrations';
import { memoryStore } from '../src/store/store';
import { band } from './helpers';

// Documents tels que la première webapp (v1) les enregistrait.
const v1Band = {
  name: 'Les Griffes', player: 'Tristan', owner: 'u_1', kt: 'Nemesis Claw', faction: 'Chaos Space Marines', rq: 3, glory: 1,
  ops: [
    { id: 'o1', name: 'Visionary', card: { src: 'kt', kt: 'Nemesis Claw', n: 'Visionary', pts: 22, lead: true, half: false, noup: false, faction: 'Chaos Space Marines', alliance: 'Chaos' },
      elite: true, xp: 3, scars: 1, seq: ['Jambe blessée'], hon: ['Coureur (Ruse)'], upg: [{ t: 'Équipement attitré', d: 'Chain Snare' }], relic: '', status: 'blessé', next: true, notes: '', origin: 'départ', cost: 0 },
    { id: 'o2', name: 'Pote', card: { src: '40k', n: 'Chaos Terminators', pts: 36, faction: "Emperor's Children", alliance: 'Chaos' },
      elite: false, xp: 0, scars: 0, seq: [], hon: [], upg: [], relic: '', status: 'actif', next: false, notes: '', origin: 'agent', cost: 10 },
  ],
  arsenal: ['Mines'], relics: [], places: ['Prisonnier'], skills: 'Relance', created: 5, updated: 6, log: [{ t: 7, txt: 'Création' }],
};
const v1Game = { id: 'g1', date: '2026-10-26', mission: 'M', notes: '', sides: [{ band: 'b1', res: 'V', ex: 2 }, { band: 'b2', res: 'D', ex: 0 }], created: 9 };

describe('migrations', () => {
  it('v1 → v2 : bande', () => {
    const b = readBand('b1', v1Band);
    expect(b).toMatchObject({ schemaVersion: 2, id: 'b1', killteam: 'Nemesis Claw', requisitions: 3, ownerId: 'u_1', discoveredPlaces: ['Prisonnier'], explorationSkills: 'Relance' });
    expect(b.operatives[0]).toMatchObject({ status: 'injured', fielded: true, sequelae: ['Jambe blessée'], upgrades: [{ name: 'Équipement attitré', equipment: 'Chain Snare' }], origin: 'start' });
    expect(b.operatives[1]!.profile).toMatchObject({ source: 'unit40k', faction: "Emperor's Children", pts40k: 36 });
    expect(b.log[0]).toEqual({ at: 7, text: 'Création' });
  });
  it('v1 → v2 : partie', () => {
    expect(readGame('g1', v1Game).sides).toEqual([{ bandId: 'b1', result: 'win', exploits: 2 }, { bandId: 'b2', result: 'loss', exploits: 0 }]);
  });
  it('v2 relu tel quel', () => {
    const b = band();
    expect(readBand(b.id, JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it('document illisible signalé sans bloquer les autres', () => {
    const store = memoryStore({ bands: [['b1', v1Band], ['bad', { schemaVersion: 2, name: 3 }]] });
    let snap: any;
    store.subscribe((s) => (snap = s));
    expect(snap.bands).toHaveLength(1);
    expect(snap.unreadable[0]).toMatch(/^Bande bad/);
  });
  it('version future refusée', () => {
    expect(() => readBand('x', { schemaVersion: 99 })).toThrow(/plus récente/);
  });
});
