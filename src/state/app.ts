import { computed, signal } from '@preact/signals';
import type { ComponentChild } from 'preact';
import { loadRules } from '../data';
import type { Ctx, Outcome } from '../domain/actions';
import { cryptoRng } from '../domain/dice';
import type { Band, Game } from '../domain/model';
import { artifactStore, connectClaudeDb } from '../store/artifactStore';
import { localStore } from '../store/localStore';
import type { Store } from '../store/store';

// État global de l'interface. Les écrans lisent ces signaux et appellent les fonctions ci-dessous ;
// ils ne parlent jamais directement au stockage.

export const rules = loadRules();

export const bands = signal<Band[]>([]);
export const games = signal<Game[]>([]);
export const unreadable = signal<string[]>([]);
export const me = signal<string | null>(null);
export const storeKind = signal<Store['kind'] | 'loading'>('loading');

export type Route = { view: 'bands' | 'games' | 'ranking' | 'rules' } | { view: 'band'; id: string; tab: BandTab };
export type BandTab = 'roster' | 'phase' | 'arsenal' | 'log';
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
  store = shared ? artifactStore(shared.db, notify) : localStore();
  me.value = shared?.userId ?? null;
  storeKind.value = store.kind;
  store.subscribe((s) => {
    bands.value = s.bands;
    games.value = s.games;
    unreadable.value = s.unreadable;
  });
}

export const ctx = (): Ctx => ({ r: rules, now: Date.now(), rng: cryptoRng });

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
