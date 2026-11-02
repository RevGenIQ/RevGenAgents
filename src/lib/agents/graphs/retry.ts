/**
 * Retry policy for nodes that call providers or the database.
 * Tools already convert provider failures into typed outcomes, so a thrown error
 * here is a transient fault (network, Supabase) worth one or two more attempts.
 */

export const NETWORK_RETRY = {
  maxAttempts: 3,
  initialInterval: 1_000,
  backoffFactor: 2,
  maxInterval: 8_000,
  jitter: true,
};
