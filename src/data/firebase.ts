import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | undefined;

/**
 * Inicializa Firebase la primera vez que se usa, así los tests (que usan repositorios
 * simulados) no lo cargan. Con `VITE_USE_EMULATORS=true` se conecta a los emuladores locales.
 */
export function firebase(): FirebaseServices {
  if (services) return services;

  const env = import.meta.env;
  const useEmulators = env.VITE_USE_EMULATORS === 'true';
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'demo-rangebook';

  const app = initializeApp({
    // Los emuladores aceptan cualquier API key.
    apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : undefined),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }

  services = { app, auth, db, storage };
  return services;
}
