import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { initialProfile, type AuthUser, type Profile } from '@/lib/auth';
import {
  parseProfile,
  profileSummary,
  type FirearmStatus,
  type Preferences,
  type ProfileSummary,
  type SessionShots,
} from '@/lib/profile';
import { firebase } from './firebase';

export interface ProfileRepository {
  /** Crea `users/{uid}` en el primer ingreso; si ya existe, no lo toca. */
  ensureProfile(user: AuthUser): Promise<void>;
  /** Avisa con el perfil cada vez que cambia (`null` si todavía no existe). */
  subscribeProfile(
    uid: string,
    onProfile: (profile: Profile | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
  updatePreferences(uid: string, preferences: Partial<Preferences>): Promise<void>;
  /** Resumen de M11 (sesiones, disparos y armas), en vivo. */
  subscribeSummary(
    uid: string,
    onSummary: (summary: ProfileSummary) => void,
    onError: (error: unknown) => void,
  ): () => void;
}

export const firebaseProfileRepository: ProfileRepository = {
  async ensureProfile(user) {
    const ref = doc(firebase().db, 'users', user.uid);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) await setDoc(ref, initialProfile(user));
  },

  subscribeProfile(uid, onProfile, onError) {
    return onSnapshot(
      doc(firebase().db, 'users', uid),
      (snapshot) => {
        const data = snapshot.data();
        onProfile(data ? parseProfile(data) : null);
      },
      onError,
    );
  },

  updatePreferences(uid, preferences) {
    return updateDoc(doc(firebase().db, 'users', uid), preferences);
  },

  subscribeSummary(uid, onSummary, onError) {
    const { db } = firebase();
    let sessions: SessionShots[] | undefined;
    let firearms: FirearmStatus[] | undefined;
    const emit = () => {
      if (sessions && firearms) onSummary(profileSummary(sessions, firearms));
    };
    const unsubscribeSessions = onSnapshot(
      collection(db, 'users', uid, 'sessions'),
      (snapshot) => {
        sessions = snapshot.docs.map((d) => d.data() as SessionShots);
        emit();
      },
      onError,
    );
    const unsubscribeFirearms = onSnapshot(
      collection(db, 'users', uid, 'firearms'),
      (snapshot) => {
        firearms = snapshot.docs.map((d) => d.data() as FirearmStatus);
        emit();
      },
      onError,
    );
    return () => {
      unsubscribeSessions();
      unsubscribeFirearms();
    };
  },
};
