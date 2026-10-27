import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initialProfile, type AuthUser } from '@/lib/auth';
import { firebase } from './firebase';

export interface ProfileRepository {
  /** Crea `users/{uid}` en el primer ingreso; si ya existe, no lo toca. */
  ensureProfile(user: AuthUser): Promise<void>;
}

export const firebaseProfileRepository: ProfileRepository = {
  async ensureProfile(user) {
    const ref = doc(firebase().db, 'users', user.uid);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) await setDoc(ref, initialProfile(user));
  },
};
