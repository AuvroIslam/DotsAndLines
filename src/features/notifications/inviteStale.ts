import type { Room } from '@/types';

/**
 * A game invitation is dead once its room is gone or no longer an open lobby (the
 * game already started, or it was closed). Pure so the self-heal is testable —
 * the invite bell drops these instead of offering a Join that leads nowhere.
 */
export function isInviteStale(room: Room | null): boolean {
  return !room || !!room.gameId || room.status !== 'open';
}
