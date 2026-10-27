import type { FirebaseOptions } from 'firebase/app';

// Configuration du projet Firebase (console Firebase → Paramètres du projet → Vos applications).
// Ces valeurs ne sont pas secrètes : l'accès aux données est réglé par firestore.rules et le code de campagne.
// null : pas de base en ligne, l'appli garde les données dans le navigateur.
const project: FirebaseOptions | null = null;

// Pour les tests : VITE_FIREBASE_EMULATOR=1 vise les émulateurs Firebase locaux (npm run smoke:online).
export const firebaseEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
export const firebaseConfig: FirebaseOptions | null = firebaseEmulator ? { apiKey: 'demo', projectId: 'demo-ktc', appId: 'demo' } : project;
