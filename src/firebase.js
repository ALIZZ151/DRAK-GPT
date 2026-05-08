const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredKeys = ['apiKey', 'projectId', 'appId'];
export const firebaseConfigured = requiredKeys.every((key) => Boolean(firebaseConfig[key]));

export function isFirebaseReady() {
  return firebaseConfigured && typeof fetch === 'function';
}

export function getFirebaseConfig() {
  return firebaseConfig;
}

export function getFirebaseStatus() {
  return {
    configured: firebaseConfigured,
    ready: isFirebaseReady(),
    mode: isFirebaseReady() ? 'Firestore REST' : 'Local Session'
  };
}
