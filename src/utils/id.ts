const ADJECTIVES = [
  'Swift',
  'Brave',
  'Clever',
  'Sneaky',
  'Mighty',
  'Lucky',
  'Cosmic',
  'Silent',
  'Golden',
  'Crimson',
];
const NOUNS = ['Fox', 'Otter', 'Falcon', 'Tiger', 'Panda', 'Wolf', 'Raven', 'Lynx', 'Bear', 'Hawk'];

/** Deterministic, friendly username derived from a uid (stable per user). */
export function generateUsername(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[(hash >> 8) % NOUNS.length];
  const num = hash % 1000;
  return `${adj}${noun}${num}`;
}

/** Reasonably-unique id for client-generated documents. */
export function randomId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
