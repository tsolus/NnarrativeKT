import type { Store, StoreListener } from './store';
import { decode } from './store';

// Repli hors de claude.ai (développement, ouverture du fichier en local) : données dans ce navigateur.
const KEY = 'ktc-local-v1';

interface Saved { bands: Record<string, unknown>; games: Record<string, unknown> | unknown[] }

export function localStore(): Store {
  const listeners = new Set<StoreListener>();
  const read = (): { bands: Record<string, unknown>; games: Record<string, unknown> } => {
    try {
      const j = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
      // La v1 rangeait les parties dans un tableau.
      const games = Array.isArray(j.games) ? Object.fromEntries(j.games.map((g: any) => [g.id, g])) : (j.games ?? {});
      return { bands: j.bands ?? {}, games };
    } catch { return { bands: {}, games: {} }; }
  };
  const write = (s: ReturnType<typeof read>) => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible : on garde la session en mémoire */ }
    const snap = decode(Object.entries(s.bands), Object.entries(s.games));
    listeners.forEach((l) => l(snap));
  };
  let state = read();
  const mutate = async (fn: (s: typeof state) => void) => { fn(state); write(state); };
  return {
    kind: 'local',
    subscribe(l) { listeners.add(l); l(decode(Object.entries(state.bands), Object.entries(state.games))); return () => listeners.delete(l); },
    saveBand: (b) => mutate((s) => { s.bands[b.id] = structuredClone(b); }),
    deleteBand: (id) => mutate((s) => { delete s.bands[id]; }),
    saveGame: (g) => mutate((s) => { s.games[g.id] = structuredClone(g); }),
    deleteGame: (id) => mutate((s) => { delete s.games[id]; }),
  };
}
