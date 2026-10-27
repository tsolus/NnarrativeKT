import type { Rules } from '../data';
import { Band, Game, Operative, OperativeStatus, Profile, SCHEMA_VERSION, STATUS_LABEL, Transaction, gone } from './model';
import type { Reward } from '../data/schema';
import { Rng } from './dice';
import { equipmentPrice, recruitCost, sellPrice, upgradeLimit } from './costs';
import { isAgent, killteamOf, newId, newOperative } from './roster';
import type { TraumaResult } from './phase';
import { addTransaction, balance } from './treasury';

// Toutes les modifications d'une bande passent par ces fonctions.
// Elles ne touchent jamais la bande reçue : elles renvoient une copie modifiée (ou une erreur lisible),
// et inscrivent l'opération au journal. L'interface ne fait qu'appeler ces fonctions puis enregistrer.

/** games sert à connaître la Gloire gagnée en partie (voir treasury.ts). */
export interface Ctx { r: Rules; now: number; rng: Rng; games: Game[] }
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

/** Débite la bande si elle a de quoi payer. Un prix nul n'écrit rien. */
function pay(ctx: Ctx, b: Band, label: string, rq: number, glory = 0, kind: Transaction['kind'] = 'purchase'): { error: string } | null {
  const bal = balance(ctx.r, b, ctx.games);
  if (rq > bal.rq) return { error: `Pas assez de Réquisitions (${bal.rq} RQ pour ${rq}).` };
  if (glory > bal.glory) return { error: `Pas assez de Gloire (${bal.glory} ☼ pour ${glory}).` };
  if (rq || glory) addTransaction(b, ctx.now, { label, rq: -rq, glory: -glory, kind });
  return null;
}
const credit = (ctx: Ctx, b: Band, label: string, t: { rq?: number; glory?: number; points?: number }, kind: Transaction['kind']) => {
  if (t.rq || t.glory || t.points) addTransaction(b, ctx.now, { label, kind, ...t });
};

/** Gloire des rangs (Légendaire : +1 ☼), versée en franchissant le seuil d'XP et reprise si l'XP est corrigée à la baisse. */
function rankGlory(ctx: Ctx, b: Band, o: Operative, oldXp: number) {
  for (const k of ctx.r.ranks) {
    if (!k.glory) continue;
    if (oldXp < k.xp && o.xp >= k.xp) credit(ctx, b, `${o.name} atteint le rang ${k.name}`, { glory: k.glory }, 'rank');
    if (oldXp >= k.xp && o.xp < k.xp) credit(ctx, b, `${o.name} redescend sous le rang ${k.name} (correction)`, { glory: -k.glory }, 'rank');
  }
}
function gainXp(ctx: Ctx, b: Band, o: Operative, delta: number) {
  const old = o.xp;
  o.xp = Math.max(0, o.xp + delta);
  rankGlory(ctx, b, o, old);
}
const priceText = (rq: number, glory = 0) => (rq ? ` : −${rq} RQ` : glory ? ` : −${glory} ☼` : ' (gratuit)');

/* ---------- bande ---------- */

export interface NewBand { name: string; player: string; ownerId: string | null; killteam: string; faction: string; operatives: Operative[]; arsenal: string[] }

export function createBand(ctx: Ctx, n: NewBand): Band {
  const s = ctx.r.campaign.start;
  return Band.parse({
    schemaVersion: SCHEMA_VERSION, id: newId(), name: n.name.trim(), player: n.player.trim(), ownerId: n.ownerId,
    killteam: n.killteam, faction: n.faction,
    operatives: n.operatives, arsenal: n.arsenal, createdAt: ctx.now, updatedAt: ctx.now,
    transactions: s.requisitions || s.glory
      ? [{ id: newId(), at: ctx.now, label: 'Dotation de départ', rq: s.requisitions, glory: s.glory, points: 0, kind: 'opening' }] : [],
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

/** Correction exceptionnelle (rançon, oubli, règle maison) : un mouvement motivé, jamais un solde écrasé. */
export function correction(ctx: Ctx, band: Band, delta: { rq: number; glory: number; points: number }, reason: string): Outcome {
  if (!reason.trim()) return fail('Indiquez le motif de la correction.');
  const d = { rq: Math.round(delta.rq) || 0, glory: Math.round(delta.glory) || 0, points: Math.round(delta.points) || 0 };
  if (!d.rq && !d.glory && !d.points) return fail('Aucun montant à corriger.');
  const bal = balance(ctx.r, band, ctx.games);
  if (bal.rq + d.rq < 0 || bal.glory + d.glory < 0) return fail('La correction rendrait un solde négatif.');
  return edit(ctx, band, (b) => {
    addTransaction(b, ctx.now, { label: `Correction : ${reason.trim()}`, kind: 'correction', ...d });
    return `Correction (${reason.trim()}) : ${[d.rq && `${d.rq > 0 ? '+' : ''}${d.rq} RQ`, d.glory && `${d.glory > 0 ? '+' : ''}${d.glory} ☼`, d.points && `${d.points > 0 ? '+' : ''}${d.points} pts`].filter(Boolean).join(', ')}`;
  });
}

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
    const agent = isAgent(b, { profile });
    const err = pay(ctx, b, `Recrutement de ${name.trim() || profile.name} (${profile.name})`, price);
    if (err) return err;
    b.operatives.push(newOperative(profile, name.trim() || profile.name, { elite: false, fielded: false, origin: agent ? 'agent' : 'recruit', cost: price }));
    return `Recrutement de ${name.trim() || profile.name} (${profile.name}${agent ? ', agent' : ''})${priceText(price)}`;
  });
}

export const adjustXp = (ctx: Ctx, band: Band, opId: string, delta: number) =>
  edit(ctx, band, (b) => { gainXp(ctx, b, opOf(b, opId), delta); });

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
    const err = pay(ctx, b, `${o.name} : ${upgrade}${equipment ? ` (${equipment})` : ''}`, price);
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
    if (refund) credit(ctx, b, `Annulation de ${u.name} pour ${o.name}`, { rq: ctx.r.campaign.upgrades.price }, 'correction');
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
    const err = pay(ctx, b, `Chirurgie : ${o.name} perd ${s}`, price);
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
      case 'gainXpD3': { const g = ctx.rng(3); gainXp(ctx, b, o, g); text += ` (+${g} XP)`; break; }
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
    els.forEach((o) => gainXp(ctx, b, o, 1));
    return `+1 XP aux Élites alignées (${els.map((o) => o.name).join(', ')})`;
  });

export const callReinforcements = (ctx: Ctx, band: Band) =>
  edit(ctx, band, (b) => {
    const rq = balance(ctx.r, b, ctx.games).rq;
    b.arsenal = [];
    if (rq) addTransaction(b, ctx.now, { label: 'Renforts : Réquisitions vidées', rq: -rq, kind: 'reinforcements' });
    return 'Renforts : arsenal et Réquisitions vidés';
  });

export interface ExplorationChoice {
  loot: number;
  place: string | null;
  reward?: Reward;          // la récompense choisie parmi celles du lieu
  equipment?: string[];     // équipements gratuits choisis
  relic?: string;           // relique gratuite choisie
  gloryToPoints?: number;   // Faveur du commandement
}

/** Encaisse le butin d'exploration et applique la récompense du lieu (sauf lieu déjà découvert). */
export function explore(ctx: Ctx, band: Band, c: ExplorationChoice): Outcome {
  const kt = killteamOf(ctx.r, band);
  return edit(ctx, band, (b) => {
    const known = !!c.place && c.place !== 'Pillé' && b.discoveredPlaces.includes(c.place);
    const parts: string[] = [`butin +${c.loot} RQ`];
    credit(ctx, b, `Exploration : butin (${c.place ?? '?'})`, { rq: c.loot }, 'loot');
    const rw = known ? undefined : c.reward;
    if (rw) {
      const label = `Exploration : ${c.place}`;
      if (rw.rq || rw.glory) { credit(ctx, b, label, { rq: rw.rq, glory: rw.glory }, 'reward'); parts.push([rw.rq && `+${rw.rq} RQ`, rw.glory && `+${rw.glory} ☼`].filter(Boolean).join(' ')); }
      if (rw.equipment) {
        const allowed = rw.equipment.type === 'faction' ? kt.factionEquipment : ctx.r.universalEquipment.map((e) => e.name);
        const eq = c.equipment ?? [];
        if (eq.length !== rw.equipment.count || eq.some((e) => !allowed.includes(e)))
          return { error: `Choisissez ${rw.equipment.count} équipement(s) ${rw.equipment.type === 'faction' ? 'de faction' : 'universel(s)'}.` };
        b.arsenal.push(...eq);
        parts.push(`arsenal : ${eq.join(', ')}`);
      }
      if (rw.relic) {
        const def = ctx.r.relics.find((x) => x.name === c.relic);
        if (!def || (rw.relic.maxGlory !== null && def.glory > rw.relic.maxGlory)) return { error: 'Choisissez une relique autorisée.' };
        b.relics.push(def.name);
        parts.push(`relique ${def.name}`);
      }
      if (rw.xpFieldedElites) {
        const els = b.operatives.filter((o) => !gone(o) && o.elite && o.fielded);
        els.forEach((o) => gainXp(ctx, b, o, rw.xpFieldedElites!));
        parts.push(`+${rw.xpFieldedElites} XP à ${els.length} Élite(s)`);
      }
      if (rw.gloryToPoints) {
        const n = Math.max(0, Math.min(rw.gloryToPoints, Math.round(c.gloryToPoints ?? 0)));
        if (n > balance(ctx.r, b, ctx.games).glory) return { error: 'Pas assez de Gloire à échanger.' };
        if (n) { credit(ctx, b, `${c.place} : ${n} ☼ échangés`, { glory: -n, points: n }, 'reward'); parts.push(`${n} ☼ → ${n} points`); }
      }
    }
    if (c.place && c.place !== 'Pillé' && !known) b.discoveredPlaces.push(c.place);
    return `Exploration : ${c.place ?? '?'}${known ? ' (déjà découvert, compte comme Pillé)' : ''}, ${parts.join(', ')}`;
  });
}

export const removePlace = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => { b.discoveredPlaces.splice(index, 1); });

/* ---------- arsenal et reliques ---------- */

export function buyEquipment(ctx: Ctx, band: Band, equipment: string, free: boolean): Outcome {
  const kt = killteamOf(ctx.r, band);
  if (!kt.factionEquipment.includes(equipment) && !ctx.r.universalEquipment.some((e) => e.name === equipment)) return fail(`Équipement inconnu : ${equipment}`);
  return edit(ctx, band, (b) => {
    const price = free ? 0 : equipmentPrice(ctx.r, equipment);
    const err = pay(ctx, b, `Achat de ${equipment}`, price);
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
    credit(ctx, b, `Vente de ${e}`, { rq: gain }, 'sale');
    return `Vente de ${e} : +${gain} RQ`;
  });

export const discardEquipment = (ctx: Ctx, band: Band, index: number) =>
  edit(ctx, band, (b) => { const [e] = b.arsenal.splice(index, 1); if (e) return `${e} retiré de l'arsenal`; });

export function buyRelic(ctx: Ctx, band: Band, relic: string, free: boolean): Outcome {
  const def = ctx.r.relics.find((x) => x.name === relic);
  if (!def) return fail(`Relique inconnue : ${relic}`);
  return edit(ctx, band, (b) => {
    const price = free ? 0 : def.glory;
    const err = pay(ctx, b, `Achat de la relique ${relic}`, 0, price);
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
    const err = pay(ctx, b, 'Location d\u2019un mercenaire', 0, price);
    if (err) return err;
    return `Mercenaire loué pour une partie${priceText(0, price)}`;
  });
