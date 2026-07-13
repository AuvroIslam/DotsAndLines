/* eslint-disable */
'use strict';

/**
 * Shared plumbing for the end-to-end suites.
 *
 * These run against a live Firebase emulator (RTDB + Auth + Functions), driving
 * the real Cloud Functions over HTTP with real auth tokens, and the real game
 * engine to simulate what a client would do. That combination is what has caught
 * the bugs unit tests structurally cannot: RTDB dropping empty arrays, the Admin
 * SDK aborting transactions on a cold cache, a trigger silently never firing,
 * and security rules that rejected a legitimate move.
 *
 * A note on trust: the suites deliberately use two different write paths.
 *   - `admin.*`  bypasses security rules — used to *seed* a scenario.
 *   - `clientPut` goes over REST with a user's ID token, so rules ARE enforced —
 *     used to prove what a real (or malicious) client can and cannot do.
 * Mixing those up would make a security assertion vacuous, so they're separate.
 */

const admin = require('firebase-admin');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-dotsandlines';
const REGION = 'asia-southeast1';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const NS = `${PROJECT}-default-rtdb`;

const TURN_MS = 30_000;
const MAX_MISSES = 3; // keep in step with MAX_CONSECUTIVE_MISSES

const engine = require('../.generated/engine.cjs');
const authority = require('../.generated/authority.cjs');

admin.initializeApp({ projectId: PROJECT, databaseURL: `http://${DB_HOST}/?ns=${NS}` });
const db = admin.database();

/** Per-suite pass/fail recorder. */
class Checker {
  constructor(suite) {
    this.suite = suite;
    this.passed = 0;
    this.failed = 0;
  }
  section(title) {
    console.log(`\n  ── ${title}`);
  }
  check(name, ok, detail) {
    if (ok) {
      this.passed += 1;
      console.log(`     ✅ ${name}`);
    } else {
      this.failed += 1;
      console.log(`     ❌ ${name}${detail !== undefined ? ` — ${detail}` : ''}`);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wipe the database between suites.
 *
 * Suites share one emulator boot (four cold starts is slow), so without this
 * they leak into each other — and not harmlessly: the scaling suite asserts that
 * a due-index query returns *exactly* the overdue games, which silently becomes
 * a much weaker claim if a previous suite left games lying around.
 */
async function resetDb() {
  await db.ref().set(null);
}

/** Mint a real Firebase Auth user in the emulator. */
async function signUp() {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const body = await res.json();
  return { uid: body.localId, idToken: body.idToken };
}

/** Call a Cloud Function callable exactly as the client SDK would. */
async function callFn(name, data, user) {
  const res = await fetch(`http://${FN_HOST}/${PROJECT}/${REGION}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  return {
    status: res.status,
    ok: body?.result?.ok === true,
    result: body?.result,
    error: body?.error,
  };
}

/**
 * Write as a *client*, over REST with an ID token — so security rules apply.
 * Returns the HTTP status: >= 400 means the rules refused it.
 */
async function clientPut(path, value, user) {
  const res = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}&auth=${user.idToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  return res.status;
}

const getGame = async (id) => engine.normalizeGame((await db.ref(`games/${id}`).get()).val());
const getDue = async (id) => (await db.ref(`activeGames/${id}`).get()).val();
const getPendingResult = async (id) => (await db.ref(`pendingResults/${id}`).get()).val();
const getFinished = async (id) => (await db.ref(`finishedGames/${id}`).get()).val();

// Match history and statistics are written by the server (Firestore Admin), so
// the suites read them back the same way to prove the record is real.
const firestore = admin.firestore();
const getStats = async (uid) => (await firestore.doc(`statistics/${uid}`).get()).data() ?? null;
const getHistory = async (uid, gameId) =>
  (await firestore.doc(`users/${uid}/matchHistory/${gameId}`).get()).data() ?? null;

/** Build a pristine game, as `GameManager.create` does for a real room. */
function buildGame(id, users, size = 3, overrides = {}) {
  return {
    ...engine.GameManager.create({
      id,
      mode: 'friend',
      size,
      players: users.map((u, i) => ({
        id: `P${i + 1}`,
        uid: u.uid,
        index: i,
        displayName: `P${i + 1}`,
        color: '#abc',
        isEliminated: false,
        consecutiveMisses: 0,
        score: 0,
      })),
    }),
    ...overrides,
  };
}

/** Seed a game straight into the database (admin — bypasses rules). */
async function seedGame(id, users, size = 3, overrides = {}) {
  const game = buildGame(id, users, size, overrides);
  const members = {};
  for (const u of users) members[u.uid] = true;
  await db.ref(`gameMembers/${id}`).set(members);
  await db.ref(`games/${id}`).set(game);
  await db.ref(`activeGames/${id}`).set(game.turnStartedAt + game.turnDurationMs);
  return game;
}

/** Seed a room with `users[0]` as host, as roomRepository would. */
async function seedRoom(roomId, users, size = 3) {
  const members = {};
  users.forEach((u, i) => {
    members[u.uid] = {
      uid: u.uid,
      displayName: `P${i + 1}`,
      index: i,
      isReady: true,
      isHost: i === 0,
      joinedAt: Date.now(),
    };
  });
  await db.ref(`rooms/${roomId}`).set({
    id: roomId,
    code: roomId.slice(0, 6).toUpperCase(),
    hostUid: users[0].uid,
    mode: 'friend',
    boardSize: size,
    maxPlayers: users.length,
    status: 'open',
    members,
    gameId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Start a game the way a real client now does: seed a room, then ask the *server*
 * to create the game. The client never authors game state — that's the point.
 * Returns the callable's result.
 */
async function startGameFromRoom(roomId, users, size = 3) {
  await seedRoom(roomId, users, size);
  return callFn('createGame', { source: 'room', roomId }, users[0]);
}

/** Ask the server to play `line` for `user`. */
const playMove = (id, line, user) => callFn('playMove', { gameId: id, line }, user);

/** The first line not yet drawn on this board. */
const firstFreeLine = (game) =>
  engine.Board.getAllLines(game.board.size).find((l) => !engine.Board.isLineDrawn(game.board, l));

/** Run the active player's clock out, then have `user` ask the server to apply it. */
async function expireTurn(id, user) {
  await db.ref(`games/${id}`).update({ turnStartedAt: Date.now() - TURN_MS - 1_000 });
  return callFn('requestTurnTimeout', { gameId: id }, user);
}

module.exports = {
  admin,
  db,
  engine,
  authority,
  Checker,
  sleep,
  resetDb,
  signUp,
  callFn,
  clientPut,
  getGame,
  getDue,
  getPendingResult,
  getFinished,
  getStats,
  getHistory,
  firestore,
  buildGame,
  seedGame,
  seedRoom,
  startGameFromRoom,
  playMove,
  firstFreeLine,
  expireTurn,
  TURN_MS,
  MAX_MISSES,
};
