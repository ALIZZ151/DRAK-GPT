import { APP_CONFIG } from '../database.js';
import { createId, formatBytes } from './sanitize.js';

const TEXT_TYPES = ['text/plain', 'application/json', 'text/markdown'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function cameraFileName() {
  const pad = (value) => String(value).padStart(2, '0');
  const now = new Date();
  return `camera-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;
}

function normalizeName(file, source, forcedExt = '') {
  const name = String(file?.name || '').trim();
  if (source === 'camera' && (!name || /^image\.?\w*$/i.test(name) || /^photo\.?\w*$/i.test(name))) {
    return cameraFileName();
  }
  if (forcedExt && name) return name.replace(/\.[a-z0-9]+$/i, forcedExt);
  return name || (source === 'camera' ? cameraFileName() : `attachment${forcedExt || ''}`);
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal baca file teks.'));
    reader.readAsText(file);
  });
}

function readAsDataURL(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal baca file gambar.'));
    reader.readAsDataURL(fileOrBlob);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memproses gambar.'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Browser gagal kompres gambar.'));
    }, 'image/jpeg', quality);
  });
}

function getTargetSize(width, height) {
  const maxW = APP_CONFIG.upload.imageMaxWidth || 1280;
  const maxH = APP_CONFIG.upload.imageMaxHeight || 1280;
  const ratio = Math.min(1, maxW / width, maxH / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

async function compressImageFile(file, source) {
  const maxOriginal = APP_CONFIG.upload.maxOriginalImageBytes || 10 * 1024 * 1024;
  const maxFinal = APP_CONFIG.upload.maxSizeBytes || 2 * 1024 * 1024;
  const target = APP_CONFIG.upload.targetImageBytes || 1 * 1024 * 1024;
  const startQuality = APP_CONFIG.upload.imageQuality || 0.78;

  if (file.size > maxOriginal) {
    throw new Error(`Foto kegedean, Bos. Maksimal original ${APP_CONFIG.upload.maxOriginalImageMB || 10}MB dulu. Coba ambil ulang atau pilih gambar lebih kecil.`);
  }

  const originalDataUrl = await readAsDataURL(file);
  const image = await loadImage(originalDataUrl);
  let { width, height } = getTargetSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  let bestBlob = null;

  // Coba beberapa quality + resize bertahap supaya kamera HP 3–5MB tetap bisa masuk.
  for (const quality of [startQuality, 0.72, 0.66, 0.58]) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, quality);
    bestBlob = blob;
    if (blob.size <= target || blob.size <= maxFinal) break;
    width = Math.max(480, Math.round(width * 0.86));
    height = Math.max(480, Math.round(height * 0.86));
  }

  if (!bestBlob || bestBlob.size > maxFinal) {
    throw new Error('Foto masih kegedean, Bos. Coba ambil ulang atau pilih gambar yang lebih kecil. Server jangan dipaksa makan batu.');
  }

  const dataUrl = await readAsDataURL(bestBlob);
  const name = normalizeName(file, source, '.jpg');
  return {
    id: createId('att'),
    name,
    type: 'image',
    kind: 'image',
    mime: 'image/jpeg',
    size: bestBlob.size,
    originalSize: file.size,
    sizeLabel: `${formatBytes(bestBlob.size)}${file.size !== bestBlob.size ? ` · dikompres dari ${formatBytes(file.size)}` : ''}`,
    width,
    height,
    preview: dataUrl,
    previewUrl: dataUrl,
    thumbnailUrl: dataUrl,
    dataUrl,
    content: '',
    compressed: file.size !== bestBlob.size,
    createdAt: new Date().toISOString()
  };
}

export async function fileToAttachment(file, options = {}) {
  const { maxSizeBytes, maxSizeMB, allowedTypes } = APP_CONFIG.upload;

  if (!file) throw new Error('File tidak ditemukan.');

  const type = file.type || ((options.source === 'camera' || options.source === 'image') ? 'image/jpeg' : 'application/octet-stream');
  const isImage = IMAGE_TYPES.includes(type) || (options.source === 'camera' && type.startsWith('image/'));

  if (!allowedTypes.includes(type) && !isImage) {
    throw new Error('Tipe file belum didukung. Pakai TXT, JSON, MD, PNG, JPG, WEBP, atau PDF kecil.');
  }

  if (isImage) {
    return compressImageFile(file, options.source);
  }

  if (file.size > maxSizeBytes) {
    throw new Error(`File kegedean, Bos. Maksimal ${maxSizeMB}MB dulu biar server gak megap-megap.`);
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
  return attachments.some((attachment) => attachment.kind === 'image' || attachment.type === 'image');
}
