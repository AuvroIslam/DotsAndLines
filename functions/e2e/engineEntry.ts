/**
 * Bundled into `e2e/.generated/engine.cjs` so the suites can drive the *real*
 * engine — simulating a genuine client move rather than hand-built state, and
 * checking the server against the same rules the app plays by.
 */
export { Board, GameManager, WinChecker } from '@/gameEngine';
export { normalizeGame } from '@/services/firebase/rtdbSerialize';
