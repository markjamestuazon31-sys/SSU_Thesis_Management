import { getValue, removeValue, setValue } from './db.service.js';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const TARGET_SIZE = 320;
const MAX_STORED_BYTES = 280 * 1024;

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected file is not a valid image.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Unable to process the profile photo.')),
      'image/jpeg',
      quality,
    );
  });
}

async function compressSquarePhoto(file) {
  if (!file) throw new Error('Choose a profile photo first.');
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Profile photo must be a JPG, PNG, or WEBP image.');
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Profile photo must be 5 MB or smaller.');
  }

  const image = await loadImage(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sy = Math.max(0, (image.naturalHeight - sourceSize) / 2);

  let outputSize = TARGET_SIZE;
  let quality = 0.86;
  let blob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Your browser cannot process the profile photo.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputSize, outputSize);
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
    blob = await canvasToBlob(canvas, quality);

    if (blob.size <= MAX_STORED_BYTES) break;
    if (quality > 0.58) quality -= 0.08;
    else outputSize = Math.max(220, outputSize - 24);
  }

  if (!blob || blob.size > MAX_STORED_BYTES) {
    throw new Error('The photo is still too large after optimization. Please choose a smaller image.');
  }

  const dataUrl = await readAsDataUrl(blob);
  return {
    dataUrl,
    mimeType: 'image/jpeg',
    size: blob.size,
    width: outputSize,
    height: outputSize,
    originalName: String(file.name || 'profile-photo').slice(0, 120),
    updatedAt: Date.now(),
  };
}

export async function getProfilePhoto(uid) {
  if (!uid) return null;
  return getValue(`profilePhotos/${uid}`);
}

export async function uploadOwnProfilePhoto(uid, file) {
  if (!uid) throw new Error('You must be signed in to upload a profile photo.');
  const photo = await compressSquarePhoto(file);
  await setValue(`profilePhotos/${uid}`, photo);
  return photo;
}

export async function removeOwnProfilePhoto(uid) {
  if (!uid) throw new Error('You must be signed in to remove a profile photo.');
  await removeValue(`profilePhotos/${uid}`);
}
