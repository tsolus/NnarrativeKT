import type { Band, Game } from '../domain/model';
import { readBand, readGame } from '../domain/migrations';

/**
 * Accès aux données partagées. L'interface ne connaît que ce contrat :
 * changer d'hébergement (Supabase, Firebase…) revient à écrire une nouvelle implémentation.
 */
export interface Store {
  readonly kind: 'shared' | 'local' | 'memory';
  subscribe(listener: StoreListener): () => void;
  saveBand(band: Band): Promise<void>;
  deleteBand(id: string): Promise<void>;
  saveGame(game: Game): Promise<void>;
  deleteGame(id: string): Promise<void>;
}

export interface Snapshot { bands: Band[]; games: Game[]; unreadable: string[] }
export type StoreListener = (s: Snapshot) => void;

/** Convertit des documents bruts en objets valides ; les documents illisibles sont signalés, jamais supprimés. */
export function decode(rawBands: [string, unknown][], rawGames: [string, unknown][]): Snapshot {
  const unreadable: string[] = [];
  const bands: Band[] = [];
  const games: Game[] = [];
  for (const [id, raw] of rawBands) {
    try { bands.push(readBand(id, raw)); } catch (e) { unreadable.push(`Bande ${id} : ${(e as Error).message.slice(0, 200)}`); }
  }
  for (const [id, raw] of rawGames) {
    try { games.push(readGame(id, raw)); } catch (e) { unreadable.push(`Partie ${id} : ${(e as Error).message.slice(0, 200)}`); }
  }
  bands.sort((a, b) => a.createdAt - b.createdAt);
  return { bands, games, unreadable };
}

/** Stockage en mémoire, pour les tests. */
export function memoryStore(initial: { bands?: [string, unknown][]; games?: [string, unknown][] } = {}): Store {
  const bands = new Map(initial.bands ?? []);
  const games = new Map(initial.games ?? []);
  const listeners = new Set<StoreListener>();
  const emit = () => { const s = decode([...bands], [...games]); listeners.forEach((l) => l(s)); };
  return {
    kind: 'memory',
    subscribe(l) { listeners.add(l); l(decode([...bands], [...games])); return () => listeners.delete(l); },
    async saveBand(b) { bands.set(b.id, structuredClone(b)); emit(); },
    async deleteBand(id) { bands.delete(id); emit(); },
    async saveGame(g) { games.set(g.id, structuredClone(g)); emit(); },
    async deleteGame(id) { games.delete(id); emit(); },
  };
}
