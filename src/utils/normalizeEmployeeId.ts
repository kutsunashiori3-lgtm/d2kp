/**
 * Utility to strictly normalize employee identification numbers (Nomor Induk / NIP)
 * ensuring no precision loss or scientific notation corruption from Excel.
 */

export function normalizeEmployeeId(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }

  let str = String(raw).trim();

  // Check if it's in scientific notation like "1.98701012010011e+17" or "1.98701012010011E+17"
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    try {
      // If scientific notation is encountered from raw excel number, convert carefully using BigInt if integer
      const [mantissa, exponent] = str.toLowerCase().split('e');
      const exp = parseInt(exponent, 10);
      if (!isNaN(exp) && exp > 0) {
        const parts = mantissa.split('.');
        const integerPart = parts[0];
        const fractionalPart = parts[1] || '';
        if (exp >= fractionalPart.length) {
          str = integerPart + fractionalPart.padEnd(exp, '0');
        } else {
          str = integerPart + fractionalPart.slice(0, exp);
        }
      }
    } catch {
      // fallback
    }
  }

  // Remove common artifacts like leading apostrophe used in Excel to force text format ('1987...)
  if (str.startsWith("'")) {
    str = str.substring(1);
  }

  // Remove invisible control characters, spaces, and hyphens/dots if desired,
  // but keep alphanumeric characters (Nomor Induk can be numeric like NIP or alphanumeric)
  str = str.replace(/[\s]/g, '');

  return str;
}

/**
 * Extract Nomor Induk from photo filename.
 * E.g., "198701012010011001.jpg" -> "198701012010011001"
 * "198701012010011001 - Ahmad.png" -> "198701012010011001"
 */
export function extractIdFromFilename(filename: string): string {
  // Remove extension
  const lastDot = filename.lastIndexOf('.');
  const nameWithoutExt = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
  const trimmed = nameWithoutExt.trim();

  // If filename starts with an ID prefix separated by space, hyphen, or underscore
  // e.g. "198701012010011001 - Ahmad.jpg" or "198701012010011001_Ahmad.jpg"
  const prefixMatch = trimmed.match(/^([a-zA-Z0-9]+)[\s_\-]+.+$/);
  if (prefixMatch && prefixMatch[1]) {
    return normalizeEmployeeId(prefixMatch[1]);
  }

  // Exact filename without extension, e.g. "198701012010011001.jpg"
  return normalizeEmployeeId(trimmed);
}
