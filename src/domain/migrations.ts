import { Band, Game, SCHEMA_VERSION } from './model';

// Chaque étape transforme un document de la version N vers N+1.
// Ne jamais modifier une étape publiée : en ajouter une nouvelle.
type Doc = Record<string, any>;
type Step = (doc: Doc) => Doc;

const STATUS_V1: Record<string, string> = { actif: 'active', 'blessé': 'injured', 'capturé': 'captured', mort: 'dead', 'retiré': 'retired' };
const ORIGIN_V1: Record<string, string> = { 'départ': 'start', recrue: 'recruit', agent: 'agent' };

/** v1 = première webapp (page unique, champs abrégés). */
const bandSteps: Record<number, Step> = {
  1: (b) => ({
    schemaVersion: 2,
    id: b.id,
    name: b.name ?? 'Bande',
    player: b.player ?? '',
    ownerId: b.owner ?? null,
    killteam: b.kt,
    faction: b.faction,
    requisitions: b.rq ?? 0,
    glory: b.glory ?? 0,
    operatives: (b.ops ?? []).map((o: Doc) => ({
      id: o.id,
      name: o.name,
      profile: {
        source: o.card?.src === '40k' ? 'unit40k' : 'killteam',
        killteam: o.card?.src === 'kt' ? o.card.kt : undefined,
        name: o.card?.n ?? o.name,
        faction: o.card?.faction ?? b.faction,
        alliance: o.card?.alliance ?? '',
        pts40k: o.card?.pts ?? null,
        leader: !!o.card?.lead,
        halfSelection: !!o.card?.half,
        noUpgrades: !!o.card?.noup,
      },
      elite: !!o.elite,
      xp: o.xp ?? 0,
      scars: o.scars ?? 0,
      sequelae: o.seq ?? [],
      honours: o.hon ?? [],
      upgrades: (o.upg ?? []).map((u: Doc) => (u.d ? { name: u.t, equipment: u.d } : { name: u.t })),
      relic: o.relic ?? '',
      status: STATUS_V1[o.status] ?? 'active',
      fielded: o.next ?? true,
      notes: o.notes ?? '',
      origin: ORIGIN_V1[o.origin] ?? 'start',
      cost: o.cost ?? 0,
    })),
    arsenal: b.arsenal ?? [],
    relics: b.relics ?? [],
    discoveredPlaces: b.places ?? [],
    explorationSkills: b.skills ?? '',
    createdAt: b.created ?? 0,
    updatedAt: b.updated ?? 0,
    log: (b.log ?? []).map((l: Doc) => ({ at: l.t, text: l.txt })),
  }),
};

const RESULT_V1: Record<string, string> = { V: 'win', N: 'draw', D: 'loss' };
const gameSteps: Record<number, Step> = {
  1: (g) => ({
    schemaVersion: 2,
    id: g.id,
    date: g.date ?? '',
    mission: g.mission ?? '',
    notes: g.notes ?? '',
    sides: (g.sides ?? []).map((s: Doc) => ({ bandId: s.band, result: RESULT_V1[s.res] ?? 'loss', exploits: +s.ex || 0 })),
    createdAt: g.created ?? 0,
  }),
};

function migrate(doc: Doc, steps: Record<number, Step>): Doc {
  let d = doc;
  let v: number = typeof d.schemaVersion === 'number' ? d.schemaVersion : 1;
  if (v > SCHEMA_VERSION) throw new Error(`Document ${d.id} créé par une version plus récente de l'appli (v${v}) : rechargez la page.`);
  while (v < SCHEMA_VERSION) {
    const step = steps[v];
    if (!step) throw new Error(`Pas de migration depuis la version ${v}`);
    d = step(d);
    v = d.schemaVersion;
  }
  return d;
}

/** Lit un document brut de la base : migre puis valide. Lève une erreur lisible si le document est inutilisable. */
export function readBand(id: string, raw: unknown): Band {
  return Band.parse(migrate({ id, ...(raw as Doc) }, bandSteps));
}
export function readGame(id: string, raw: unknown): Game {
  return Game.parse(migrate({ id, ...(raw as Doc) }, gameSteps));
}
