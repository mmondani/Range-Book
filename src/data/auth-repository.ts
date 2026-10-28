import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { allowedEmailId, type AuthUser, type SignInMethod } from '@/lib/auth';
import { firebase } from './firebase';

export interface AuthRepository {
  /** Avisa cada vez que cambia el usuario de Firebase (también al iniciar). */
  onUserChanged(callback: (user: AuthUser | null) => void): () => void;
  signIn(method: SignInMethod): Promise<void>;
  /** Termina un login por redirect; rechaza si falló. */
  completeRedirect(): Promise<void>;
  signOut(): Promise<void>;
  isEmailAllowed(email: string): Promise<boolean>;
}

function toAuthUser({ uid, email, displayName, photoURL }: User): AuthUser {
  return { uid, email, displayName, photoURL };
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Siempre muestra el selector de cuentas, para poder probar con otra si no está autorizada.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export const firebaseAuthRepository: AuthRepository = {
  onUserChanged(callback) {
    return onAuthStateChanged(firebase().auth, (user) => callback(user && toAuthUser(user)));
  },

  async signIn(method) {
    const { auth } = firebase();
    if (method === 'redirect') await signInWithRedirect(auth, googleProvider());
    else await signInWithPopup(auth, googleProvider());
  },

  async completeRedirect() {
    await getRedirectResult(firebase().auth);
  },

  signOut() {
    return signOut(firebase().auth);
  },

  async isEmailAllowed(email) {
    const snapshot = await getDoc(doc(firebase().db, 'allowedEmails', allowedEmailId(email)));
    return snapshot.exists();
  },
};
