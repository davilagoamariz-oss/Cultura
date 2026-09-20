import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const usaEmulador = env.VITE_USE_EMULATOR === 'true';
export const fotosNoStorage = env.VITE_ENABLE_PHOTO_UPLOAD === 'true';

/** false quando o .env.local ainda não foi preenchido: a tela avisa em vez de quebrar. */
export const firebaseConfigurado = Boolean(config.apiKey && config.projectId);

let app = null;
let auth = null;
let db = null;

if (firebaseConfigurado) {
  app = initializeApp(config);
  auth = getAuth(app);
  // Cache offline persistente (IndexedDB), compartilhado entre abas.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (usaEmulador) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export { app, auth, db };
