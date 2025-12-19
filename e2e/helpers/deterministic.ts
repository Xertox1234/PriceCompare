let uniqueCounter = 0;

/**
 * Deterministic, in-process unique suffix.
 *
 * NOTE: Our Playwright config runs with 1 worker, so this is stable across runs.
 * If we ever enable multi-worker parallelism, prefer including the worker index.
 */
export function nextDeterministicSuffix(prefix = 'id'): string {
  uniqueCounter += 1;
  return `${prefix}-${uniqueCounter}`;
}

function lcg(seed: number): number {
  // Simple LCG (Numerical Recipes). Returns [0, 1).
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return next / 0x100000000;
}

export function deterministicNumberInRange(seed: number, min: number, max: number): number {
  const t = lcg(seed);
  return min + t * (max - min);
}

export function deterministicPriceString(seed: number, min: number, max: number): string {
  return deterministicNumberInRange(seed, min, max).toFixed(2);
}
