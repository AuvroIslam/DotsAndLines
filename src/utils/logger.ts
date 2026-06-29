/**
 * Tiny tagged logger. Keeps diagnostic output consistent and greppable in the
 * Metro console, and lets us silence categories in production via __DEV__.
 *
 * Usage: const log = createLogger('MM'); log('enqueued', { uid });
 */
type LogArgs = unknown[];

export function createLogger(tag: string) {
  const prefix = `[${tag}]`;
  const enabled = typeof __DEV__ === 'undefined' ? true : __DEV__;

  const base = (...args: LogArgs) => {
    if (enabled) console.log(prefix, ...args);
  };
  base.warn = (...args: LogArgs) => {
    if (enabled) console.warn(prefix, ...args);
  };
  base.error = (...args: LogArgs) => {
    // Always surface errors, even in production builds.
    console.error(prefix, ...args);
  };
  return base;
}
