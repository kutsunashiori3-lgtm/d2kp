/**
 * Vector distance and confidence score calculation utilities
 */

/**
 * Calculate Euclidean distance between two 128-dimensional face embedding vectors
 */
export function euclideanDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calculate Cosine similarity between two vectors (-1.0 to 1.0)
 */
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert Euclidean distance to confidence percentage (0% - 100%)
 * In face-api ResNet model:
 * distance 0.20 -> 98%
 * distance 0.35 -> 92%
 * distance 0.45 -> 85%
 * distance 0.55 -> 72%
 * distance 0.65 -> 50%
 */
export function distanceToConfidence(distance: number): number {
  // Linear mapped with clamp: at distance 0 -> 100%, at distance 0.75 -> 0%
  const score = (1 - (distance / 0.75)) * 100;
  return Math.max(0, Math.min(99.9, Math.round(score * 10) / 10));
}
