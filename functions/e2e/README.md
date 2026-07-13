# End-to-end suites

```bash
cd functions
npm run e2e              # all suites
npm run e2e -- moves     # one suite (moves | disconnect | rooms | scaling)
```

Builds the functions, bundles the engine for the harness, boots the Firebase
emulator (RTDB + Auth + Functions), runs every suite against it, and exits
non-zero if anything fails. No Blaze plan and no cloud project needed — it runs
entirely on `demo-dotsandlines` locally. Requires Java (the RTDB emulator).

## Why these exist

They cover the ground unit tests structurally *cannot*: real security rules, real
auth tokens, real callables over HTTP, real RTDB semantics. Every bug in this
system that the unit tests missed was caught here —

- RTDB drops empty arrays, so a no-contest result read back with `winners`
  undefined and would have crashed the very screen reporting it.
- The Admin SDK calls a transaction's update fn with a cold `null` cache, so our
  abort convention silently dropped every legitimate write.
- A 2nd-gen RTDB trigger never fires unless co-located with its database — it
  just quietly does nothing.
- A security rule rejected a *legitimate* move, freezing every 3–4 player game
  after an elimination.

None of those are reachable from a mocked test.

## Layout

| File | Purpose |
|---|---|
| `run.cjs` | Runner. Wipes the DB between suites, aggregates results, sets the exit code. |
| `lib/harness.cjs` | Shared plumbing: emulator wiring, auth, callables, seeding. |
| `suites/moves.cjs` | Moves are server-authoritative: rules enforced, board unforgeable, deltas only, races rejected. |
| `suites/disconnect.cjs` | Abandoned games resolve by missed turns, not connection state. |
| `suites/rooms.cjs` | 3- and 4-player games, where an elimination does *not* end the match. |
| `suites/scaling.cjs` | The structural properties: due-index reads, presence isolation, no per-move trigger. |

## Writing a suite

Export `{ name, run(t) }` and add it to `SUITES` in `run.cjs`. Use `t.section()`
to group and `t.check(name, ok, detail)` to assert.

One thing to keep straight — there are two write paths, and mixing them up makes
a security assertion **vacuous**:

- **`seedGame` / `db.*`** — Admin SDK, **bypasses security rules**. Use to *set up* a scenario.
- **`clientPut` / `callFn`** — real REST/HTTPS with a user's ID token, so **rules are enforced**.
  Use to prove what a real (or malicious) client can and cannot do.

Asserting "a cheater cannot write X" with `db.ref().set()` would pass no matter
how broken the rules were.
