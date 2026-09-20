/**
 * Image preprocessing and optimization service.
 * Resizes large images for optimal face recognition performance and creates cached thumbnails.
 */

export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar dari file: ' + String(e)));
    };
    img.src = url;
  });
}

export async function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Gagal memuat data URL gambar: ' + String(e)));
    img.src = dataUrl;
  });
}

/**
 * Resizes image down to max dimension (e.g. 800px) and creates an optimized HTMLCanvasElement
 */
export function optimizeImageForDetection(
  img: HTMLImageElement,
  maxDimension = 800
): { canvas: HTMLCanvasElement; scale: number } {
  let { naturalWidth: width, naturalHeight: height } = img;

  let scale = 1;
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      scale = maxDimension / width;
      height = Math.round(height * scale);
      width = maxDimension;
    } else {
      scale = maxDimension / height;
      width = Math.round(width * scale);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
  }

  return { canvas, scale };
}

/**
 * Create a small thumbnail data URL (e.g. 200x200) for fast UI rendering in tables and cards
 */
export function createThumbnailDataUrl(img: HTMLImageElement | HTMLCanvasElement, size = 200): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;

  // Center crop square
  const minDim = Math.min(w, h);
  const sx = (w - minDim) / 2;
  const sy = (h - minDim) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Generate a clean avatar placeholder data URL if photo is absent
 */
export function generateInitialsAvatar(name: string, nomorInduk: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 160, 160);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 160);

  // Initials
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || nomorInduk.slice(-2);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 80, 80);

  return canvas.toDataURL('image/png');
}
