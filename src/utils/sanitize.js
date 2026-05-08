export function stripUnsafeText(value = '') {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, 50000);
}

export function clampText(value = '', maxLength = 8000) {
  return stripUnsafeText(value).trim().slice(0, maxLength);
}

export function safeTitle(value = 'Chat Baru') {
  const title = stripUnsafeText(value).replace(/\s+/g, ' ').trim();
  if (!title) return 'Chat Baru';
  return title.length > 42 ? `${title.slice(0, 42)}...` : title;
}

export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function createId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function dateLabel(value) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(new Date(value));
  } catch {
    return '';
  }
}
