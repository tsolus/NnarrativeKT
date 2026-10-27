import type { FirebaseOptions } from 'firebase/app';

// Configuration du projet Firebase (console Firebase → Paramètres du projet → Vos applications).
// Ces valeurs ne sont pas secrètes : l'accès aux données est réglé par firestore.rules et le code de campagne.
// null : pas de base en ligne, l'appli garde les données dans le navigateur.
const project: FirebaseOptions | null = {
  apiKey: 'AIzaSyCp5R1ELhP07LdaC9mrKFvCf96bYmK_RyQ',
  authDomain: 'narrativekt.firebaseapp.com',
  projectId: 'narrativekt',
  storageBucket: 'narrativekt.firebasestorage.app',
  messagingSenderId: '7881071202',
  appId: '1:7881071202:web:1c52558879362164468f3b',
};

// Pour les tests : VITE_FIREBASE_EMULATOR=1 vise les émulateurs Firebase locaux (npm run smoke:online).
export const firebaseEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
export const firebaseConfig: FirebaseOptions | null = firebaseEmulator ? { apiKey: 'demo', projectId: 'demo-ktc', appId: 'demo' } : project;
