import type { Store, StoreListener } from './store';
import { decode } from './store';

// Base partagée des pages Claude (capacité « db »). Collections : bands, games.
// Seul ce fichier dépend de l'API window.claude.

interface DocSnap { id: string; data(): Record<string, unknown> | undefined }
interface QuerySnap { docs: DocSnap[] }
interface DocRef { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
interface CollRef { doc(id: string): DocRef; onSnapshot(next: (s: QuerySnap) => void, err?: (e: { message: string }) => void): () => void }
export interface ClaudeDb { collection(path: string): CollRef }

declare global {
  interface Window { claude?: { use(name: string): Promise<any> } }
}

/** Renvoie la base partagée, ou null hors de claude.ai / sans connexion. */
export async function connectClaudeDb(): Promise<{ db: ClaudeDb; userId: string | null } | null> {
  const use = window.claude?.use;
  if (!use) return null;
  const db = (await window.claude!.use('db').catch(() => null)) as ClaudeDb | null;
  if (!db) return null;
  const user = await window.claude!.use('user').catch(() => null);
  const userId: string | null = user ? await user.id().catch(() => null) : null;
  return { db, userId };
}

export function artifactStore(db: ClaudeDb, onError: (msg: string) => void): Store {
  const plain = (x: unknown) => JSON.parse(JSON.stringify(x)) as Record<string, unknown>;
  return {
    kind: 'shared',
    subscribe(listener: StoreListener) {
      let bands: [string, unknown][] | null = null;
      let games: [string, unknown][] | null = null;
      const emit = () => { if (bands && games) listener(decode(bands, games)); };
      const err = (e: { message: string }) => onError(`Base indisponible : ${e.message}`);
      const u1 = db.collection('bands').onSnapshot((s) => { bands = s.docs.map((d) => [d.id, d.data()]); emit(); }, err);
      const u2 = db.collection('games').onSnapshot((s) => { games = s.docs.map((d) => [d.id, d.data()]); emit(); }, err);
      return () => { u1(); u2(); };
    },
    saveBand: (b) => db.collection('bands').doc(b.id).set(plain(b)),
    deleteBand: (id) => db.collection('bands').doc(id).delete(),
    saveGame: (g) => db.collection('games').doc(g.id).set(plain(g)),
    deleteGame: (id) => db.collection('games').doc(id).delete(),
  };
}
