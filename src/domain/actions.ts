import type { Rules } from '../data';
import { Band, Operative, OperativeStatus, Profile, SCHEMA_VERSION, STATUS_LABEL, gone } from './model';
import { Rng } from './dice';
import { equipmentPrice, recruitCost, sellPrice, upgradeLimit } from './costs';
import { isAgent, killteamOf, newId, newOperative } from './roster';
import type { TraumaResult } from './phase';

// Toutes les modifications d'une bande passent par ces fonctions.
// Elles ne touchent jamais la bande reçue : elles renvoient une copie modifiée (ou une erreur lisible),
// et inscrivent l'opération au journal. L'interface ne fait qu'appeler ces fonctions puis enregistrer.

export interface Ctx { r: Rules; now: number; rng: Rng }
export type Outcome = { ok: true; band: Band; message?: string } | { ok: false; error: string };

const MAX_LOG = 300;
const fail = (error: string): Outcome => ({ ok: false, error });

function edit(ctx: Ctx, band: Band, fn: (b: Band) => string | { error: string } | void): Outcome {
  const b: Band = structuredClone(band);
  const res = fn(b);
  if (res && typeof res === 'object') return fail(res.error);
  if (typeof res === 'string') {
    b.log.unshift({ at: ctx.now, text: res });
    if (b.log.length > MAX_LOG) b.log.length = MAX_LOG;
  }
  b.updatedAt = ctx.now;
  return { ok: true, band: b };
}

function opOf(b: Band, id: string): Operative {
  const o = b.operatives.find((x) => x.id === id);
  if (!o) throw new Error(`Opérateur introuvable : ${id}`);
  return o;
}

function pay(b: Band, rq: number, glory = 0): { error: string } | null {
  if (rq > b.requisitions) return { error: `Pas assez de Réquisitions (${b.requisitions} RQ pour ${rq}).` };
  if (glory > b.glory) return { error: `Pas assez de Gloire (${b.glory} ☼ pour ${glory}).` };
  b.requisitions -= rq;
  b.glory -= glory;
  return null;
}
const priceText = (rq: number, glory = 0) => (rq ? ` : −${rq} RQ` : glory ? ` : −${glory} ☼` : ' (gratuit)');

/* ---------- bande ---------- */

export interface NewBand { name: string; player: string; ownerId: string | null; killteam: string; faction: string; operatives: Operative[]; arsenal: string[] }

export function createBand(ctx: Ctx, n: NewBand): Band {
  const s = ctx.r.campaign.start;
  return Band.parse({
    schemaVersion: SCHEMA_VERSION, id: newId(), name: n.name.trim(), player: n.player.trim(), ownerId: n.ownerId,
    killteam: n.killteam, faction: n.faction, requisitions: s.requisitions, glory: s.glory,
    operatives: n.operatives, arsenal: n.arsenal, createdAt: ctx.now, updatedAt: ctx.now,
    log: [{ at: ctx.now, text: `Création : ${n.operatives.length} opérateurs, arsenal ${n.arsenal.join(', ') || 'vide'}.` }],
  });
}

export function startingChecks(r: Rules, n: Pick<NewBand, 'killteam' | 'operatives' | 'name'>): string[] {
  const kt = r.killteamByName.get(n.killteam);
  if (!kt) return ['Kill team inconnue.'];
  const w: string[] = [];
  if (!n.name.trim()) w.push('Donnez un nom à la bande.');
  const elites = n.operatives.filter((o) => o.elite).length;
  if (elites !== r.campaign.start.elites) w.push(`${elites} Élite(s) : la bande commence avec le chef + 1 opérateur Élite.`);
  if (!n.operatives.some((o) => o.profile.leader)) w.push('Aucun chef dans la sélection.');
  return w;
}

type BandField = 'name' | 'player' | 'faction' | 'explorationSkills';
export const setBandField = (ctx: Ctx, band: Band, field: BandField, value: string) =>
  edit(ctx, band, (b) => { b[field] = value; });

export const correctResources = (ctx: Ctx, band: Band, requisitions: number, glory: number) =>
  edit(ctx, band, (b) => {
    if (b.requisitions === requisitions && b.glory === glory) return;
    b.requisitions = Math.max(0, Math.round(requisitions));
    b.glory = Math.max(0, Math.round(glory));
    return `Correction manuelle : ${b.requisitions} RQ, ${b.glory} ☼`;
  });

/* ---------- opérateurs ---------- */

type OpField = Partial<Pick<Operative, 'name' | 'notes' | 'fielded' | 'status' | 'relic'>>;
export const updateOperative = (ctx: Ctx, band: Band, opId: string, patch: OpField) =>
  edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    if (patch.relic) b.operatives.forEach((x) => { if (x !== o && x.relic === patch.relic) x.relic = ''; });
    Object.assign(o, patch);
    if (patch.status && patch.status !== band.operatives.find((x) => x.id === opId)?.status) return `${o.name} : ${STATUS_LABEL[patch.status]}`;
  });

export function recruit(ctx: Ctx, band: Band, profile: Profile, name: string, free: boolean): Outcome {
  const cost = recruitCost(ctx.r, band, profile);
  if (cost == null && !free) return fail(`${profile.name} n'a pas de coût en points 40k : recrutez-le gratuitement après accord de vos adversaires.`);
  return edit(ctx, band, (b) => {
    const price = free ? 0 : cost!;
    const err = pay(b, price);
    if (err) return err;
    const agent = isAgent(b, { profile });
    b.operatives.push(newOperative(profile, name.trim() || profile.name, { elite: false, fielded: false, origin: agent ? 'agent' : 'recruit', cost: price }));
    return `Recrutement de ${name.trim() || profile.name} (${profile.name}${agent ? ', agent' : ''})${priceText(price)}`;
  });
}

export const adjustXp = (ctx: Ctx, band: Band, opId: string, delta: number) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); o.xp = Math.max(0, o.xp + delta); });

export const adjustScars = (ctx: Ctx, band: Band, opId: string, delta: number) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); o.scars = Math.max(0, o.scars + delta); });

export const setElite = (ctx: Ctx, band: Band, opId: string, elite: boolean) =>
  edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    if (elite && o.profile.noUpgrades) return { error: `${o.name} ne peut pas devenir Élite.` };
    o.elite = elite;
    return `${o.name} ${elite ? 'promu Élite' : 'repasse troupe'}`;
  });

/** Mort ou retraite : l'opérateur reste dans l'historique, sa relique revient à la bande, ses améliorations sont perdues. */
export const removeFromRoster = (ctx: Ctx, band: Band, opId: string, status: Extract<OperativeStatus, 'dead' | 'retired'>) =>
  edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    o.status = status;
    o.relic = '';
    o.fielded = false;
    return `${o.name} ${status === 'dead' ? 'est mort' : 'quitte la bande'}`;
  });

export const reinstate = (ctx: Ctx, band: Band, opId: string) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); o.status = 'active'; return `${o.name} revient au registre`; });

export const deleteOperative = (ctx: Ctx, band: Band, opId: string) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); b.operatives = b.operatives.filter((x) => x !== o); return `${o.name} effacé du registre`; });

/* ---------- améliorations, honneurs, séquelles ---------- */

export function buyUpgrade(ctx: Ctx, band: Band, opId: string, upgrade: string, equipment: string | undefined, free: boolean): Outcome {
  const def = ctx.r.upgrades.find((u) => u.name === upgrade);
  if (!def) return fail(`Amélioration inconnue : ${upgrade}`);
  return edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    if (o.profile.noUpgrades) return { error: `${o.name} ne peut pas recevoir d'amélioration.` };
    if (o.upgrades.length >= upgradeLimit(ctx.r, o)) return { error: `${o.name} a déjà ${o.upgrades.length} amélioration(s), le maximum pour ${o.elite ? 'une Élite' : 'une troupe'}.` };
    if (o.upgrades.some((u) => u.name === upgrade)) return { error: `${o.name} a déjà ${upgrade}.` };
    if (def.needsEquipment) {
      if (!equipment) return { error: 'Choisissez l’équipement attitré.' };
      if (b.operatives.some((x) => !gone(x) && x.upgrades.some((u) => u.equipment === equipment))) return { error: `${equipment} est déjà attitré dans la bande.` };
    }
    const price = free ? 0 : ctx.r.campaign.upgrades.price;
    const err = pay(b, price);
    if (err) return err;
    o.upgrades.push(def.needsEquipment ? { name: upgrade, equipment } : { name: upgrade });
    return `${o.name} : ${upgrade}${equipment ? ` (${equipment})` : ''}${priceText(price)}`;
  });
}

/** Une amélioration ne se revend pas ; refund sert uniquement à corriger une erreur de saisie. */
export const removeUpgrade = (ctx: Ctx, band: Band, opId: string, index: number, refund: boolean) =>
  edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    const [u] = o.upgrades.splice(index, 1);
    if (!u) return;
    if (refund) b.requisitions += ctx.r.campaign.upgrades.price;
    return refund ? `Amélioration ${u.name} annulée pour ${o.name} : +${ctx.r.campaign.upgrades.price} RQ` : `${o.name} perd ${u.name}`;
  });

export const addHonour = (ctx: Ctx, band: Band, opId: string, honour: string) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); o.honours.push(honour); return `${o.name} gagne l'Honneur ${honour}`; });

export const removeHonour = (ctx: Ctx, band: Band, opId: string, index: number) =>
  edit(ctx, band, (b) => { const o = opOf(b, opId); const [h] = o.honours.splice(index, 1); if (h) return `${o.name} perd l'Honneur ${h}`; });

export const removeSequela = (ctx: Ctx, band: Band, opId: string, index: number, surgery: boolean) =>
  edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    const s = o.sequelae[index];
    if (!s) return;
    const price = surgery ? ctx.r.campaign.prices.surgery : 0;
    const err = pay(b, price);
    if (err) return err;
    o.sequelae.splice(index, 1);
    return surgery ? `Chirurgie : ${o.name} perd ${s}${priceText(price)}` : `${o.name} perd la Séquelle ${s}`;
  });

/* ---------- phase de campagne ---------- */

export function applyTrauma(ctx: Ctx, band: Band, opId: string, t: TraumaResult): Outcome {
  return edit(ctx, band, (b) => {
    const o = opOf(b, opId);
    let text = `Traumatisme de ${o.name} : ${t.value}, ${t.title}`;
    if (t.die === 'd6') {
      if (t.outcome === 'dead') { o.status = 'dead'; o.relic = ''; o.fielded = false; }
      if (t.outcome === 'missNextGame') o.status = 'injured';
      return text;
    }
    const s = t.sequela;
    if (s.kind === 'sequela' && o.sequelae.includes(s.name) && !s.repeatable) return { error: `${o.name} a déjà « ${s.name} » : relancez le dé.` };
    if (t.scar) o.scars++;
    switch (s.kind) {
      case 'dead': o.status = 'dead'; o.relic = ''; o.fielded = false; break;
      case 'captured': o.status = 'captured'; break;
      case 'missNextGame': o.sequelae.push(s.name); o.status = 'injured'; break;
      case 'robbed': o.sequelae.push(s.name); o.relic = ''; o.upgrades = o.upgrades.filter((u) => !u.equipment); break;
      case 'trait': case 'sequela': o.sequelae.push(s.name); break;
      case 'gainXpD3': { const g = ctx.rng(3); o.xp += g; text += ` (+${g} XP)`; break; }
      case 'none': break;
    }
    if (o.scars >= ctx.r.campaign.trauma.scarsToRetire && !gone(o)) {
      o.status = 'retired'; o.relic = ''; o.fielded = false;
      text += ' : 3e Cicatrice, inapte au service';
    }
    return text;
  });
}

export const xpToFieldedElites = (ctx: Ctx, band: Band) =>
  edit(ctx, band, (b) => {
    const els = b.operatives.filter((o) => !gone(o) && o.elite && o.fielded);
    if (!els.length) return { error: 'Aucune Élite alignée.' };
    els.forEach((o) => o.xp++);
    return `+1 XP aux Élites alignées (${els.map((o) => o.name).join(', ')})`;
  });

export const callReinforcements = (ctx: Ctx, band: Band) =>
  edit(ctx, band, (b) => { b.arsenal = []; b.requisitions = 0; return 'Renforts : arsenal et Réquisitions vidés'; });

export const collectLoot = (ctx: Ctx, band: Band, loot: number, place: string | null) =>
  edit(ctx, band, (b) => {
    b.requisitions += loot;
    const isNew = !!place && place !== 'Pillé' && !b.discoveredPlaces.includes(place);
    if (isNew) b.discoveredPlaces.push(place!);
    return `Exploration : ${place ?? '?'}${place && !isNew && place !== 'Pillé' ? ' (déjà découvert)' : ''}, butin +${loot} RQ`;
  });

export const removePlace = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => { b.discoveredPlaces.splice(index, 1); });

/* ---------- arsenal et reliques ---------- */

export function buyEquipment(ctx: Ctx, band: Band, equipment: string, free: boolean): Outcome {
  const kt = killteamOf(ctx.r, band);
  if (!kt.factionEquipment.includes(equipment) && !ctx.r.universalEquipment.some((e) => e.name === equipment)) return fail(`Équipement inconnu : ${equipment}`);
  return edit(ctx, band, (b) => {
    const price = free ? 0 : equipmentPrice(ctx.r, equipment);
    const err = pay(b, price);
    if (err) return err;
    b.arsenal.push(equipment);
    return `Arsenal : ${equipment}${priceText(price)}`;
  });
}

export const sellEquipment = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => {
    const [e] = b.arsenal.splice(index, 1);
    if (!e) return;
    const gain = sellPrice(ctx.r, equipmentPrice(ctx.r, e));
    b.requisitions += gain;
    return `Vente de ${e} : +${gain} RQ`;
  });

export const discardEquipment = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => { const [e] = b.arsenal.splice(index, 1); if (e) return `${e} retiré de l'arsenal`; });

export function buyRelic(ctx: Ctx, band: Band, relic: string, free: boolean): Outcome {
  const def = ctx.r.relics.find((x) => x.name === relic);
  if (!def) return fail(`Relique inconnue : ${relic}`);
  return edit(ctx, band, (b) => {
    const price = free ? 0 : def.glory;
    const err = pay(b, 0, price);
    if (err) return err;
    b.relics.push(relic);
    return `Relique ${relic}${priceText(0, price)}`;
  });
}

export const discardRelic = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => {
    const [n] = b.relics.splice(index, 1);
    if (!n) return;
    if (!b.relics.includes(n)) b.operatives.forEach((o) => { if (o.relic === n) o.relic = ''; });
    return `Relique ${n} retirée`;
  });

export const hireMercenary = (ctx: Ctx, band: Band) =>
  edit(ctx, band, (b) => {
    const price = ctx.r.campaign.prices.mercenaryGlory;
    const err = pay(b, 0, price);
    if (err) return err;
    return `Mercenaire loué pour une partie${priceText(0, price)}`;
  });
