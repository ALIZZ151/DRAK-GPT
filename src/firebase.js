const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const AUTH_STORAGE_KEY = 'drak_gpt_firebase_auth_v1';
const requiredKeys = ['apiKey', 'projectId', 'appId'];

export const firebaseConfigured = requiredKeys.every((key) => Boolean(firebaseConfig[key]));

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json) ?? fallback;
  } catch {
    return fallback;
  }
}

function readAuthCache() {
  if (typeof localStorage === 'undefined') return null;
  return safeParse(localStorage.getItem(AUTH_STORAGE_KEY), null);
}

function writeAuthCache(auth) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearAuthCache() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function authStillFresh(auth) {
  return Boolean(auth?.idToken && auth?.localId && auth?.expiresAt && Date.now() < auth.expiresAt - 90_000);
}

async function firebasePost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `Firebase request ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function createAnonymousAuth() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const data = await firebasePost(url, { returnSecureToken: true });
  const expiresIn = Number(data.expiresIn || 3600);
  const auth = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    expiresAt: Date.now() + expiresIn * 1000
  };
  writeAuthCache(auth);
  return auth;
}

async function refreshAnonymousAuth(auth) {
  if (!auth?.refreshToken) return createAnonymousAuth();

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', auth.refreshToken);

  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    clearAuthCache();
    return createAnonymousAuth();
  }

  const expiresIn = Number(data.expires_in || 3600);
  const nextAuth = {
    idToken: data.id_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    localId: data.user_id,
    expiresAt: Date.now() + expiresIn * 1000
  };
  writeAuthCache(nextAuth);
  return nextAuth;
}

export function isFirebaseReady() {
  return firebaseConfigured && typeof fetch === 'function';
}

export function getFirebaseConfig() {
  return firebaseConfig;
}

export function getCachedFirebaseUserId() {
  const auth = readAuthCache();
  return auth?.localId || '';
}

export async function ensureFirebaseAuth() {
  if (!isFirebaseReady()) return null;
  const cached = readAuthCache();
  if (authStillFresh(cached)) return cached;
  if (cached?.refreshToken) return refreshAnonymousAuth(cached);
  return createAnonymousAuth();
}

export async function getFirebaseAuthHeader() {
  const auth = await ensureFirebaseAuth();
  return auth?.idToken ? { Authorization: `Bearer ${auth.idToken}` } : {};
}

export function resetFirebaseAuth() {
  clearAuthCache();
}

export function getFirebaseStatus() {
  const cached = readAuthCache();
  return {
    configured: firebaseConfigured,
    ready: isFirebaseReady(),
    authCached: Boolean(cached?.localId),
    uid: cached?.localId || '',
    mode: isFirebaseReady() ? 'Firebase Sync' : 'Local Session'
  };
}
