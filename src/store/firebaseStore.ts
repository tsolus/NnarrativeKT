import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';
import { firebaseEmulator } from '../firebase.config';
import type { Store, StoreListener } from './store';
import { decode } from './store';

// Base en ligne Firebase (Firestore). Chaque campagne est rangée sous campaigns/{code}/bands et /games :
// connaître le code donne accès à la campagne, sans compte (connexion anonyme propre à chaque navigateur).
// Seul ce fichier dépend de Firebase.

/** Se connecte et renvoie le stockage de la campagne, avec l'identifiant de ce navigateur. */
export async function connectFirebase(config: FirebaseOptions, campaign: string, onError: (msg: string) => void): Promise<{ store: Store; userId: string }> {
  const fresh = !getApps().length;
  const app = fresh ? initializeApp(config) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (fresh && firebaseEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const cred = await signInAnonymously(auth);
  const coll = (name: 'bands' | 'games') => collection(db, 'campaigns', campaign, name);
  const plain = (x: unknown) => JSON.parse(JSON.stringify(x)) as Record<string, unknown>;
  const store: Store = {
    kind: 'shared',
    subscribe(listener: StoreListener) {
      let bands: [string, unknown][] | null = null;
      let games: [string, unknown][] | null = null;
      const emit = () => { if (bands && games) listener(decode(bands, games)); };
      const err = (e: { message: string }) => onError(`Base indisponible : ${e.message}`);
      const u1 = onSnapshot(coll('bands'), (s) => { bands = s.docs.map((d) => [d.id, d.data()]); emit(); }, err);
      const u2 = onSnapshot(coll('games'), (s) => { games = s.docs.map((d) => [d.id, d.data()]); emit(); }, err);
      return () => { u1(); u2(); };
    },
    saveBand: (b) => setDoc(doc(coll('bands'), b.id), plain(b)),
    deleteBand: (id) => deleteDoc(doc(coll('bands'), id)),
    saveGame: (g) => setDoc(doc(coll('games'), g.id), plain(g)),
    deleteGame: (id) => deleteDoc(doc(coll('games'), id)),
  };
  return { store, userId: cred.user.uid };
}
