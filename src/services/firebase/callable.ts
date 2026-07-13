import { httpsCallable, type FunctionsError } from 'firebase/functions';

import { createLogger } from '@/utils';

import { functions } from './config';

const log = createLogger('FN');

/**
 * Callables that report failure instead of throwing it.
 *
 * `httpsCallable` rejects on any server-side refusal — permission-denied, a
 * stale request, or the `aborted` we return when two moves race for the same
 * turn. Callers were awaiting these directly, so a throw skipped their rollback
 * entirely: a refused move stayed on the board, an unhandled rejection was
 * logged, and the Leave button silently failed to navigate.
 *
 * Refusals are a normal part of a turn-based game (someone taps a line a
 * fraction of a second too late), not exceptional, so they belong in the return
 * value where callers must actually look at them.
 */

export type CallResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: CallErrorCode; message: string };

export type CallErrorCode =
  /** Two writers raced; the caller should re-read and may retry. */
  | 'aborted'
  /** Not a player in this game, or not allowed to start it. */
  | 'permission-denied'
  /** Signed out, or the token expired. */
  | 'unauthenticated'
  /** The game or room is gone. */
  | 'not-found'
  /** Anything else, including the network being down. */
  | 'unavailable';

const KNOWN: CallErrorCode[] = [
  'aborted',
  'permission-denied',
  'unauthenticated',
  'not-found',
  'unavailable',
];

function toCode(err: unknown): CallErrorCode {
  const code = (err as FunctionsError)?.code?.replace(/^functions\//, '') as CallErrorCode;
  return KNOWN.includes(code) ? code : 'unavailable';
}

/** Wrap a callable so it resolves with a typed result rather than throwing. */
export function callable<Req, Res>(name: string): (payload: Req) => Promise<CallResult<Res>> {
  const fn = httpsCallable<Req, Res>(functions, name);

  return async (payload: Req) => {
    try {
      const res = await fn(payload);
      return { ok: true, data: res.data };
    } catch (err) {
      const code = toCode(err);
      const message = (err as Error)?.message ?? 'Request failed';
      log.error(`${name} failed`, { code, message });
      return { ok: false, code, message };
    }
  };
}
