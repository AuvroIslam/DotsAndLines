## Plan: Offline 1v1 (Local Hotseat)

TL;DR — Implement a minimal, non-networked hotseat mode so two players can play on one device. Reuse the existing engine and UI components; keep the change isolated to a new screen and a small local hook.

Goal
- Provide a single-device 1v1 play mode (hotseat) with configurable board size and ephemeral local players. No Firebase, no matchmaking, no auth required.

Steps
1. Add `LocalGame` screen and route
   - Create `src/app/(app)/local-game.tsx` that renders the game UI and settings.
   - Add a navigation entry (e.g., "Local Play") in the main menu that opens this route.

2. Implement `useLocalGame` hook
   - File: `src/features/game/hooks/useLocalGame.ts`
   - Responsibilities: create initial game via `GameManager.create({ ... })`, hold `game` in React state, expose `makeMove(line)`, `isMyTurn(playerId)`, `switchActivePlayer()` and a `reset()` function.
   - Use `GameManager`/`MoveValidator`/`WinChecker` for all state transitions and validation (no network calls).

3. Reuse existing UI components
   - Use `GameBoard`, `Scoreboard`, `GameOverlay`, and `TurnTimerBar` where applicable. Pass `interactive` and handlers from `useLocalGame`.
   - Keep visual parity with online mode (same components, same props) so players get a consistent experience.

4. Settings & ephemeral players
   - On `LocalGame` screen allow selecting board size (e.g., 3x3, 5x5), and entering two local player names/colors.
   - Create ephemeral `player` objects (id: `local-1`, `local-2`) stored in component state; do not require authentication.

5. Turn handling & timers
   - For hotseat, disable automatic network-driven skip behavior; optionally show a manual "End Turn" button or keep the existing turn timer but have it only change the active local player (no network call).

6. Tests & verification
   - Add unit tests for `useLocalGame` behavior: creating game, making valid/invalid moves, scoring, end-of-game detection.
   - Manual smoke: run app, open `LocalGame`, play two-player game, verify `Scoreboard` updates and `WinChecker` produces correct result.

Files to add/modify (minimal)
- `src/app/(app)/local-game.tsx` — new screen.
- `src/features/game/hooks/useLocalGame.ts` — new hook.
- small change to navigation to surface the route (e.g., `src/navigation/routes.ts` or main menu component).

Verification checklist
- Start app, open `Local Play` → create game with chosen size and names.
- Both players take turns drawing lines; invalid moves are blocked by `MoveValidator`.
- Scores update and final winner is shown by `GameOverlay`/`Scoreboard`.
- No network calls are made (confirm via devtools or by toggling network offline).

Assumptions & notes
- `GameManager`, `MoveValidator`, `Board`, and `WinChecker` are pure and ready to be used client-side.
- This approach intentionally keeps the multiplayer codepath unchanged.
- Optional follow-ups: implement local vs AI (simple heuristic AI) or an in-memory repo to reuse multiplayer hooks — both separate tasks.

 
