import { APP_CONFIG } from '../database.js';
import { createId, formatBytes } from './sanitize.js';

const TEXT_TYPES = ['text/plain', 'application/json', 'text/markdown'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function cameraFileName() {
  const pad = (value) => String(value).padStart(2, '0');
  const now = new Date();
  return `camera-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;
}

function normalizeName(file, source) {
  const name = String(file?.name || '').trim();
  if (source === 'camera' && (!name || /^image\.?\w*$/i.test(name) || /^photo\.?\w*$/i.test(name))) {
    return cameraFileName();
  }
  return name || (source === 'camera' ? cameraFileName() : 'attachment');
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal baca file teks.'));
    reader.readAsText(file);
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal baca file gambar.'));
    reader.readAsDataURL(file);
  });
}

export async function fileToAttachment(file, options = {}) {
  const { maxSizeBytes, maxSizeMB, allowedTypes } = APP_CONFIG.upload;

  if (!file) throw new Error('File tidak ditemukan.');
  if (file.size > maxSizeBytes) {
    throw new Error(`File kegedean, maksimal ${maxSizeMB}MB dulu biar server gak ngambek.`);
  }

  const type = file.type || ((options.source === 'camera' || options.source === 'image') ? 'image/jpeg' : 'application/octet-stream');
  if (!allowedTypes.includes(type)) {
    throw new Error('Tipe file belum didukung. Pakai TXT, JSON, MD, PNG, JPG, WEBP, atau PDF kecil.');
  }

  const base = {
    id: createId('att'),
    name: normalizeName(file, options.source),
    type: 'file',
    mime: type,
    size: file.size,
    sizeLabel: formatBytes(file.size),
    createdAt: new Date().toISOString()
  };

  if (TEXT_TYPES.includes(type)) {
    const content = await readAsText(file);
    return {
      ...base,
      kind: 'text',
      type: 'text',
      content: content.slice(0, 12000),
      preview: content.slice(0, 400)
    };
  }

  if (IMAGE_TYPES.includes(type)) {
    const dataUrl = await readAsDataURL(file);
    return {
      ...base,
      kind: 'image',
      type: 'image',
      preview: dataUrl,
      previewUrl: dataUrl,
      dataUrl,
      content: ''
    };
  }

  return {
    ...base,
    kind: 'file',
    type: 'file',
    preview: 'PDF diterima, tapi parsing PDF belum aktif di versi awal.',
    content: ''
  };
}

export function attachmentsToPromptContext(attachments = []) {
  const readable = attachments.filter((attachment) => attachment.kind === 'text' && attachment.content);
  if (!readable.length) return '';

  return readable
    .map((attachment) => [
      `\n\n[FILE: ${attachment.name}]`,
      '```',
      attachment.content,
      '```'
    ].join('\n'))
    .join('\n');
}

export function hasImageAttachment(attachments = []) {
  return attachments.some((attachment) => attachment.kind === 'image');
}
