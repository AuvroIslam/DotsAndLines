/* eslint-disable */
'use strict';

/**
 * Runs every end-to-end suite against a live Firebase emulator, in one boot.
 *
 * Invoked by `npm run e2e` (from functions/), which builds the functions, bundles
 * the engine for the harness, starts the emulator and calls this. Exits non-zero
 * if any check fails, so it works as a gate in CI.
 *
 * These cover the ground unit tests structurally cannot: real security rules,
 * real auth tokens, real Cloud Functions over HTTP, real RTDB semantics. Every
 * bug found in this system that unit tests missed — RTDB dropping empty arrays,
 * the Admin SDK aborting a transaction on a cold cache, a trigger silently never
 * firing, rules rejecting a legitimate move — was caught here.
 */

const { Checker, db, resetDb } = require('./lib/harness.cjs');

const SUITES = [
  require('./suites/creation.cjs'),
  require('./suites/moves.cjs'),
  require('./suites/disconnect.cjs'),
  require('./suites/rooms.cjs'),
  require('./suites/results.cjs'),
  require('./suites/scaling.cjs'),
];

async function main() {
  const only = process.argv[2]; // optional: `npm run e2e -- moves`
  const suites = only ? SUITES.filter((s) => s.name.startsWith(only)) : SUITES;

  if (suites.length === 0) {
    console.error(`No suite matches "${only}". Available: ${SUITES.map((s) => s.name.split(' ')[0]).join(', ')}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const summary = [];

  for (const suite of suites) {
    console.log(`\n▶ ${suite.name}`);
    const t = new Checker(suite.name);
    try {
      // Suites share one emulator boot, so isolate them explicitly — otherwise
      // leftover games from an earlier suite quietly weaken later assertions.
      await resetDb();
      await suite.run(t);
    } catch (err) {
      t.check(`suite crashed: ${err.message}`, false);
      console.error(err);
    }
    passed += t.passed;
    failed += t.failed;
    summary.push({ name: suite.name, passed: t.passed, failed: t.failed });
  }

  console.log('\n────────────────────────────────────────────');
  for (const s of summary) {
    const mark = s.failed === 0 ? '✅' : '❌';
    console.log(`${mark} ${s.name.padEnd(38)} ${s.passed} passed, ${s.failed} failed`);
  }
  console.log('────────────────────────────────────────────');
  console.log(`${failed === 0 ? '✅' : '❌'} TOTAL: ${passed} passed, ${failed} failed\n`);

  await db.goOffline();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('e2e runner crashed:', err);
  process.exit(1);
});
