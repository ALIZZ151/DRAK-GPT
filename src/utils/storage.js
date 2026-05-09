import { APP_CONFIG } from '../database.js';
import { ensureFirebaseAuth, getFirebaseAuthHeader, getFirebaseConfig, getFirebaseStatus, isFirebaseReady } from '../firebase.js';
import { createId } from './sanitize.js';

const PREFIX = APP_CONFIG.app.storagePrefix;
const KEYS = {
  session: `${PREFIX}:sessionId`,
  chats: `${PREFIX}:chats`,
  last: `${PREFIX}:lastChatId`,
  prefs: `${PREFIX}:preferences`
};

function safeParse(json, fallback) {
  try {
    return JSON.parse(json) ?? fallback;
  } catch {
    return fallback;
  }
}

function localGetChats() {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(KEYS.chats), []);
}

function localSetChats(chats) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEYS.chats, JSON.stringify(chats));
  } catch {
    localStorage.setItem(KEYS.chats, JSON.stringify(slimChatsForLocal(chats).slice(0, 25)));
  }
}

function dataUrlBudget(url, maxChars) {
  return typeof url === 'string' && url.length <= maxChars ? url : '';
}

function slimAttachment(attachment, maxChars = 950_000) {
  if (!attachment || typeof attachment !== 'object') return attachment;
  if (attachment.kind !== 'image' && attachment.type !== 'image') return attachment;

  const bestPreview = attachment.thumbnailUrl || attachment.dataUrl || attachment.previewUrl || attachment.preview || '';
  const safePreview = dataUrlBudget(bestPreview, maxChars);

  return {
    id: attachment.id,
    kind: attachment.kind || 'image',
    type: attachment.type || 'image',
    name: attachment.name || 'image.jpg',
    mime: attachment.mime || 'image/jpeg',
    size: Number(attachment.size || 0),
    width: Number(attachment.width || 0),
    height: Number(attachment.height || 0),
    compressed: Boolean(attachment.compressed),
    createdAt: attachment.createdAt || new Date().toISOString(),
    dataUrl: safePreview,
    previewUrl: safePreview,
    preview: safePreview,
    thumbnailUrl: safePreview
  };
}

function slimChatsForLocal(chats) {
  return chats.map((chat) => ({
    ...chat,
    messages: (chat.messages || []).map((message) => ({
      ...message,
      attachments: (message.attachments || []).map((attachment) => slimAttachment(attachment, 950_000))
    }))
  }));
}

function slimChatForCloud(chat) {
  return {
    ...chat,
    messages: (chat.messages || []).map((message) => ({
      ...message,
      // Firestore document limit ±1MiB. Simpan thumbnail kecil/metadata agar sync tidak mental gara-gara foto gede.
      attachments: (message.attachments || []).map((attachment) => slimAttachment(attachment, 260_000))
    }))
  };
}

async function getRemoteUserId(fallbackSessionId) {
  const auth = await ensureFirebaseAuth();
  return auth?.localId || fallbackSessionId;
}

function firestoreBase(userId) {
  const config = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/users/${encodeURIComponent(userId)}/chats`;
}

function firestoreUrl(userId, chatId = '') {
  const config = getFirebaseConfig();
  const suffix = chatId ? `/${encodeURIComponent(chatId)}` : '';
  return `${firestoreBase(userId)}${suffix}?key=${encodeURIComponent(config.apiKey)}`;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]))
      }
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)]));
  }
  return null;
}

function chatToFirestore(chat) {
  return {
    fields: Object.fromEntries(Object.entries(slimChatForCloud(chat)).map(([key, value]) => [key, toFirestoreValue(value)]))
  };
}

function chatFromFirestore(document) {
  const fields = document?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function remoteFetch(url, options = {}) {
  const authHeader = await getFirebaseAuthHeader();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeader
    }
  });
}

async function remoteListChats(sessionId) {
  const userId = await getRemoteUserId(sessionId);
  const response = await remoteFetch(firestoreUrl(userId));
  if (!response.ok) throw new Error(`Firestore list ${response.status}`);
  const data = await response.json();
  return (data.documents || []).map(chatFromFirestore).filter((chat) => chat.id);
}

async function remoteSaveChat(sessionId, chat) {
  const userId = await getRemoteUserId(sessionId);
  const response = await remoteFetch(firestoreUrl(userId, chat.id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatToFirestore(chat))
  });
  if (!response.ok) throw new Error(`Firestore save ${response.status}`);
}

async function remoteDeleteChat(sessionId, chatId) {
  const userId = await getRemoteUserId(sessionId);
  const response = await remoteFetch(firestoreUrl(userId, chatId), { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`Firestore delete ${response.status}`);
}

async function uploadLocalChatsToRemote(sessionId, chats) {
  if (!isFirebaseReady() || !chats.length) return;
  const batch = chats.slice(0, 30);
  await Promise.all(batch.map((chat) => remoteSaveChat(sessionId, chat).catch((error) => {
    console.warn('Firebase migration skipped one chat:', error.message);
  })));
}

export function getSessionId() {
  if (typeof localStorage === 'undefined') return createId('session');
  let sessionId = localStorage.getItem(KEYS.session);
  if (!sessionId) {
    sessionId = createId('session');
    localStorage.setItem(KEYS.session, sessionId);
  }
  return sessionId;
}

export function getStorageMode() {
  const status = getFirebaseStatus();
  if (!status.ready) return 'Local Session';
  if (status.authCached) return 'Firebase Sync';
  return 'Firebase Ready';
}

export async function loadChats(sessionId = getSessionId()) {
  const localChats = localGetChats();
  if (!isFirebaseReady()) return localChats;

  try {
    const remoteChats = await remoteListChats(sessionId);
    const sorted = remoteChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (sorted.length) {
      const merged = mergeChats(localChats, sorted);
      localSetChats(merged);
      if (localChats.length > sorted.length) await uploadLocalChatsToRemote(sessionId, merged);
      return merged;
    }

    // Pertama kali Firebase aktif: dorong riwayat local lama ke Firestore biar user gak kehilangan history.
    if (localChats.length) await uploadLocalChatsToRemote(sessionId, localChats);
    return localChats;
  } catch (error) {
    console.warn('Firebase sync load failed, using localStorage:', error.message);
    return localChats;
  }
}

function mergeChats(localChats, remoteChats) {
  const map = new Map();
  for (const chat of [...remoteChats, ...localChats]) {
    const old = map.get(chat.id);
    if (!old || new Date(chat.updatedAt || 0) > new Date(old.updatedAt || 0)) {
      map.set(chat.id, chat);
    }
  }
  return [...map.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveChat(chat, sessionId = getSessionId()) {
  const chats = localGetChats();
  const next = [chat, ...chats.filter((item) => item.id !== chat.id)].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  localSetChats(next);

  if (isFirebaseReady()) {
    try {
      await remoteSaveChat(sessionId, chat);
    } catch (error) {
      console.warn('Firebase sync save failed, kept in localStorage:', error.message);
    }
  }
  return next;
}

export async function deleteChat(chatId, sessionId = getSessionId()) {
  const next = localGetChats().filter((chat) => chat.id !== chatId);
  localSetChats(next);
  if (isFirebaseReady()) {
    try {
      await remoteDeleteChat(sessionId, chatId);
    } catch (error) {
      console.warn('Firebase sync delete failed:', error.message);
    }
  }
  return next;
}

export async function clearAllChats(sessionId = getSessionId()) {
  const existing = localGetChats();
  localSetChats([]);
  localStorage.removeItem(KEYS.last);
  if (isFirebaseReady()) {
    await Promise.all(existing.map((chat) => remoteDeleteChat(sessionId, chat.id).catch(() => null)));
  }
  return [];
}

export function getLastChatId() {
  return localStorage.getItem(KEYS.last);
}

export function setLastChatId(chatId) {
  if (!chatId) return localStorage.removeItem(KEYS.last);
  localStorage.setItem(KEYS.last, chatId);
}

export function loadPreferences() {
  return safeParse(localStorage.getItem(KEYS.prefs), { theme: APP_CONFIG.defaultTheme, model: APP_CONFIG.models[0].id });
}

export function savePreferences(preferences) {
  localStorage.setItem(KEYS.prefs, JSON.stringify(preferences));
}
