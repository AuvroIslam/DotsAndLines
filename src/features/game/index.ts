export { GameBoard } from './components/GameBoard';
export { Scoreboard } from './components/Scoreboard';
export { TurnTimerBar } from './components/TurnTimerBar';
export { GameOverlay } from './components/GameOverlay';
export { ConnectionBanner } from './components/ConnectionBanner';
export { PeerDisconnectBanner } from './components/PeerDisconnectBanner';

export { useLiveGame } from './hooks/useLiveGame';
export { useTurnTimer } from './hooks/useTurnTimer';
export { useRoom } from './hooks/useRoom';
export { useRandomMatchmaking } from './hooks/useRandomMatchmaking';
export { useActiveGameWatcher } from './hooks/useActiveGameWatcher';
export { decideActiveGame } from './hooks/activeGameDecision';
export type { ActiveGameDecision } from './hooks/activeGameDecision';
export { useConnectionMonitor } from './hooks/useConnectionMonitor';
export { useMatchRecorder } from './hooks/useMatchRecorder';
export { useLocalGame } from './hooks/useLocalGame';
export type { LocalPlayer, UseLocalGameReturn } from './hooks/useLocalGame';
export { useTrackPlayerConnection } from './hooks/useTrackPlayerConnection';
export { usePeerDisconnectStatus } from './hooks/usePeerDisconnectStatus';
export { computeAwayPeers } from './hooks/awayPeers';

export { chooseMoveAI } from './ai';
export type { AIDifficulty } from './ai';
