/** Reads a local image file and returns a small JPEG data URL. */

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class ImageFileError extends Error {
  constructor(
    readonly reason: 'not-image' | 'too-large' | 'read-failed',
  ) {
    super(reason);
  }
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageFileError('read-failed'));
    image.src = source;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new ImageFileError('read-failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resizes the picture so it fits in a square of `maxSize`, keeping its aspect
 * ratio, and re-encodes it as JPEG. Artist photos are stored per user in
 * Firestore, so the result must stay well below the 1 MiB document limit.
 */
export async function imageFileToDataUrl(
  file: File,
  maxSize = 600,
  quality = 0.8,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageFileError('not-image');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageFileError('too-large');
  }

  const dataUrl = await readFile(file);
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return dataUrl;

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

export function isImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
