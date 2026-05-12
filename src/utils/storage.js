import { APP_CONFIG } from '../database.js';
import { createId } from './sanitize.js';

const PREFIX = APP_CONFIG.app.storagePrefix;
const KEYS = {
  session: `${PREFIX}:sessionId`,
  chats: `${PREFIX}:chats`,
  last: `${PREFIX}:lastChatId`,
  prefs: `${PREFIX}:preferences`,
  device: `${PREFIX}:deviceId`
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

export function getSessionId() {
  if (typeof localStorage === 'undefined') return createId('session');
  let sessionId = localStorage.getItem(KEYS.session);
  if (!sessionId) {
    sessionId = createId('session');
    localStorage.setItem(KEYS.session, sessionId);
  }
  return sessionId;
}

export function getDeviceId() {
  if (typeof localStorage === 'undefined') return createId('device');
  let deviceId = localStorage.getItem(KEYS.device);
  if (!deviceId) {
    deviceId = createId('device');
    localStorage.setItem(KEYS.device, deviceId);
  }
  return deviceId;
}

export function resetLocalDeviceId() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEYS.device);
  return getDeviceId();
}

export function getStorageMode() {
  return 'Local Chat';
}

export async function loadChats() {
  return localGetChats().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveChat(chat) {
  const chats = localGetChats();
  const next = [chat, ...chats.filter((item) => item.id !== chat.id)].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  localSetChats(next);
  return next;
}

export async function deleteChat(chatId) {
  const next = localGetChats().filter((chat) => chat.id !== chatId);
  localSetChats(next);
  return next;
}

export async function clearAllChats() {
  localSetChats([]);
  localStorage.removeItem(KEYS.last);
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
