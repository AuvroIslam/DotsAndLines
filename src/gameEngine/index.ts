/**
 * Pure TypeScript game engine for Dots & Boxes.
 * No React, no Expo, no Firebase — fully unit-testable in isolation.
 */
export { Board } from './Board';
export { MoveValidator } from './MoveValidator';
export type { MoveRejectionReason, ValidationResult } from './MoveValidator';
export { TurnManager } from './TurnManager';
export { ScoreManager } from './ScoreManager';
export { WinChecker } from './WinChecker';
export { GameManager } from './GameManager';
export type { CreateGameParams, ApplyMoveOutcome } from './GameManager';
