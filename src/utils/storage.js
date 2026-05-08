import { APP_CONFIG } from '../database.js';
import { getFirebaseConfig, isFirebaseReady } from '../firebase.js';
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
  localStorage.setItem(KEYS.chats, JSON.stringify(chats));
}

function firestoreBase(sessionId) {
  const config = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/users/${encodeURIComponent(sessionId)}/chats`;
}

function firestoreUrl(sessionId, chatId = '') {
  const config = getFirebaseConfig();
  const suffix = chatId ? `/${encodeURIComponent(chatId)}` : '';
  return `${firestoreBase(sessionId)}${suffix}?key=${encodeURIComponent(config.apiKey)}`;
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
    fields: Object.fromEntries(Object.entries(chat).map(([key, value]) => [key, toFirestoreValue(value)]))
  };
}

function chatFromFirestore(document) {
  const fields = document?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function remoteListChats(sessionId) {
  const response = await fetch(firestoreUrl(sessionId));
  if (!response.ok) throw new Error(`Firestore list ${response.status}`);
  const data = await response.json();
  return (data.documents || []).map(chatFromFirestore).filter((chat) => chat.id);
}

async function remoteSaveChat(sessionId, chat) {
  const response = await fetch(firestoreUrl(sessionId, chat.id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatToFirestore(chat))
  });
  if (!response.ok) throw new Error(`Firestore save ${response.status}`);
}

async function remoteDeleteChat(sessionId, chatId) {
  const response = await fetch(firestoreUrl(sessionId, chatId), { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`Firestore delete ${response.status}`);
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
  return isFirebaseReady() ? 'Firebase Sync' : 'Local Session';
}

export async function loadChats(sessionId = getSessionId()) {
  const localChats = localGetChats();
  if (!isFirebaseReady()) return localChats;

  try {
    const remoteChats = await remoteListChats(sessionId);
    const sorted = remoteChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (sorted.length) {
      localSetChats(sorted);
      return sorted;
    }
    return localChats;
  } catch (error) {
    console.warn('Firebase REST load failed, using localStorage:', error.message);
    return localChats;
  }
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
      console.warn('Firebase REST save failed, kept in localStorage:', error.message);
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
      console.warn('Firebase REST delete failed:', error.message);
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
