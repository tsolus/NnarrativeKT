import { computed, signal } from '@preact/signals';
import type { ComponentChild } from 'preact';
import { loadRules } from '../data';
import type { Ctx, Outcome } from '../domain/actions';
import { cryptoRng } from '../domain/dice';
import type { Band, Game } from '../domain/model';
import { artifactStore, connectClaudeDb } from '../store/artifactStore';
import { localStore } from '../store/localStore';
import type { Store } from '../store/store';
import { firebaseConfig } from '../firebase.config';
import { currentCampaign, rememberCampaign } from './campaign';

// État global de l'interface. Les écrans lisent ces signaux et appellent les fonctions ci-dessous ;
// ils ne parlent jamais directement au stockage.

export const rules = loadRules();

export const bands = signal<Band[]>([]);
export const games = signal<Game[]>([]);
export const unreadable = signal<string[]>([]);
export const me = signal<string | null>(null);
/** 'join' : appli en ligne sans code de campagne, l'écran d'accueil le demande. */
export const storeKind = signal<Store['kind'] | 'loading' | 'join'>('loading');
/** Code de la campagne en ligne ouverte, null sur la page Claude ou en mode local. */
export const campaign = signal<string | null>(null);

export type Route = { view: 'bands' | 'games' | 'ranking' | 'rules' } | { view: 'band'; id: string; tab: BandTab };
export type BandTab = 'roster' | 'sheet' | 'phase' | 'arsenal' | 'log';
export const route = signal<Route>({ view: 'bands' });
export const currentBand = computed(() => {
  const r = route.value;
  return r.view === 'band' ? bands.value.find((b) => b.id === r.id) ?? null : null;
});

export const toast = signal<{ text: string; at: number } | null>(null);
export const notify = (text: string) => { toast.value = { text, at: Date.now() }; };
export const modal = signal<ComponentChild | null>(null);
export const openModal = (c: ComponentChild) => { modal.value = c; };
export const closeModal = () => { modal.value = null; };

let store: Store | null = null;

export async function boot(): Promise<void> {
  const shared = await connectClaudeDb().catch(() => null);
  if (shared) return use(artifactStore(shared.db, notify), shared.userId);
  // fichier ouvert depuis le disque (tests, essais) : données dans le navigateur, sans base en ligne
  if (!firebaseConfig || location.protocol === 'file:') return use(localStore(), null);
  // un lien d'invitation ouvert dans un onglet déjà lancé change de campagne
  window.addEventListener('hashchange', () => {
    const next = currentCampaign();
    if (next && next !== campaign.value) void openCampaign(next);
  });
  const code = currentCampaign();
  if (code) return openCampaign(code);
  storeKind.value = 'join';
}

let unsubscribe: (() => void) | null = null;

function use(s: Store, userId: string | null): void {
  unsubscribe?.();
  store = s;
  me.value = userId;
  storeKind.value = s.kind;
  unsubscribe = s.subscribe((snap) => {
    bands.value = snap.bands;
    games.value = snap.games;
    unreadable.value = snap.unreadable;
  });
}

/** Ouvre (ou crée, s'il est nouveau) la campagne en ligne de ce code. */
export async function openCampaign(code: string): Promise<void> {
  if (!firebaseConfig) return;
  storeKind.value = 'loading';
  try {
    const { connectFirebase } = await import('../store/firebaseStore');
    const { store: s, userId } = await connectFirebase(firebaseConfig, code, notify);
    rememberCampaign(code);
    campaign.value = code;
    use(s, userId);
  } catch (e) {
    notify(`Connexion impossible : ${(e as Error).message ?? e}`);
    storeKind.value = 'join';
  }
}

/** Quitte la campagne sur ce navigateur (les données restent en ligne). */
export function leaveCampaign(): void {
  unsubscribe?.();
  unsubscribe = null;
  store = null;
  rememberCampaign(null);
  campaign.value = null;
  bands.value = [];
  games.value = [];
  route.value = { view: 'bands' };
  storeKind.value = 'join';
}

export const ctx = (): Ctx => ({ r: rules, now: Date.now(), rng: cryptoRng, games: games.value });

const failed = (e: unknown) => notify(`Échec de l'enregistrement : ${(e as Error).message ?? e}`);

/** Enregistre une bande : mise à jour immédiate à l'écran, puis écriture dans la base. */
export async function saveBand(b: Band): Promise<void> {
  const i = bands.value.findIndex((x) => x.id === b.id);
  bands.value = i >= 0 ? bands.value.map((x) => (x.id === b.id ? b : x)) : [...bands.value, b];
  await store?.saveBand(b).catch(failed);
}

/**
 * Applique une action du domaine à une bande ; affiche l'erreur éventuelle. Renvoie vrai si c'est fait.
 * L'action porte toujours sur la version la plus récente de la bande (une fenêtre ouverte a pu vieillir).
 */
export function act(band: Band | string, fn: (c: Ctx, b: Band) => Outcome, success?: string): boolean {
  const id = typeof band === 'string' ? band : band.id;
  const latest = bands.value.find((b) => b.id === id) ?? (typeof band === 'string' ? null : band);
  if (!latest) { notify('Cette bande n\u2019existe plus.'); return false; }
  const o = fn(ctx(), latest);
  if (!o.ok) { notify(o.error); return false; }
  void saveBand(o.band);
  if (success) notify(success);
  return true;
}

export async function deleteBand(id: string) {
  bands.value = bands.value.filter((b) => b.id !== id);
  route.value = { view: 'bands' };
  await store?.deleteBand(id).catch(failed);
}
export async function saveGame(g: Game) {
  games.value = [...games.value.filter((x) => x.id !== g.id), g];
  await store?.saveGame(g).catch(failed);
}
export async function deleteGame(id: string) {
  games.value = games.value.filter((g) => g.id !== id);
  await store?.deleteGame(id).catch(failed);
}

export const openBand = (id: string, tab: BandTab = 'roster') => { route.value = { view: 'band', id, tab }; window.scrollTo(0, 0); };
