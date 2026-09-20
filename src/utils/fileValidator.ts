/**
 * Photo file validation utilities
 */

const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function isImageFile(file: File): boolean {
  const ext = getFileExtension(file.name).toLowerCase();
  return VALID_IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/');
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.substring(idx) : '';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
