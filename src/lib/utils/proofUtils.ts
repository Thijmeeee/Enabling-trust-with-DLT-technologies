/**
 * Helper functions for Merkle proof visualization
 */

/**
 * Calculate batch size from leaf index
 * Uses next power of 2 as estimate of the batch size the leaf belongs to
 */
export function calculateBatchSize(leafIndex: number, proofLength: number): number {
  // If we have proofLength siblings, the total number of leaves is up to 2^proofLength
  return Math.pow(2, proofLength);
}

/**
 * Truncate hash for display
 */
export function truncateHash(hash: string, showFull: boolean = false): string {
  if (!hash) return '';
  if (showFull || hash.length <= 20) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * Determine sibling position from leaf index at a specific level
 */
export function getSiblingPosition(leafIndex: number, level: number): 'left' | 'right' {
  return ((leafIndex >> level) & 1) === 0 ? 'right' : 'left';
}

/**
 * Generate placeholder operations for batch context
 */
export function generateBatchPlaceholders(
  batchSize: number,
  currentIndex: number
): { index: number, isHidden: boolean }[] {
  return Array.from({ length: batchSize }, (_, i) => ({
    index: i,
    isHidden: i !== currentIndex
  }));
}
