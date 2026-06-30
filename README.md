# Dots & Boxes

A production-ready realtime multiplayer **Dots & Boxes** game built with Expo,
React Native, TypeScript, Firebase, and a framework-agnostic game engine.

## Tech Stack

- **React Native 0.81 + Expo SDK 54** (React 19) with **Expo Router** (file-based routing)
- **TypeScript** (strict)
- **Zustand** for client state (`authStore`, `gameStore`, `friendStore`, `profileStore`, `settingsStore`)
- **React Query** for server-state caching (Firestore reads)
- **Firebase**: Authentication, Realtime Database (live game state), Firestore (durable data), Cloud Messaging
- **Reanimated** + **Gesture Handler** for animations and input

## Architecture

Clean Architecture + Feature-First. **UI never contains business logic.**

```
src/
  app/             # Expo Router routes (screens only; thin, call hooks/stores)
  components/      # Shared, reusable presentational components
    ui/
  features/        # Feature-first modules (each: components, hooks, services, store)
    game/
    friends/
    profile/
  services/        # Infrastructure adapters
    firebase/      # Firebase SDK init + repositories (Repository Pattern)
  gameEngine/      # PURE TypeScript engine — zero React/Firebase imports
  store/           # Cross-cutting Zustand stores
  hooks/           # Shared custom hooks
  navigation/      # Navigation helpers / route constants
  theme/           # Colors, spacing, typography tokens
  types/           # Domain models (engine + data contracts)
  utils/           # Pure helpers and constants
```

### Layering rules

- `gameEngine/` is pure and has **no** dependency on React, Expo, or Firebase.
- The UI calls hooks; hooks call stores/services; services call Firebase.
- Data access goes through repositories (services/firebase), never raw SDK calls from UI.

## Getting Started

```bash
npm install
cp .env.example .env   # fill Firebase + Google OAuth values (Step 2/3)
npm run start
```

## Local Hotseat (Offline 1v1)

You can now play a local 1v1 (hotseat) game on a single device without Firebase or authentication.

- Entry screen: open the app and choose "Local Play" from the main menu.
- Files: `src/app/(app)/local-game.tsx`, `src/features/game/hooks/useLocalGame.ts` (new additions).

Run the app locally (Metro on port 8081):

```bash
npx expo start --clear --port 8081
```

Notes:
- Hotseat uses the pure `gameEngine` (no network calls). Player identities are ephemeral (`local-1`, `local-2`).
- Turn timer network-skipping is disabled for hotseat; turns are handled locally.
- Future additions may include Local vs AI and an in-memory repo to reuse online UI.

Scripts: `lint`, `lint:fix`, `format`, `typecheck`, `test`.

## Build Plan (incremental)

1. ✅ **Project structure** ← current
2. Firebase configuration
3. Authentication (anonymous + Google)
4. Navigation
5. Game Engine (pure TS)
6. Realtime Multiplayer
7. Friends
8. Random Matchmaking
9. Animations / haptics / sound
10. Testing

> Path aliases (`@/*`, `@gameEngine/*`, …) are configured in `tsconfig.json`.
