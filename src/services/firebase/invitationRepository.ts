import { onValue, ref, remove, update } from 'firebase/database';

import type { BoardSize, GameInvite, UserProfile } from '@/types';
import { createLogger } from '@/utils';

import { realtimeDb } from './config';
import { RtdbPaths } from './paths';

const log = createLogger('INVITE');

/**
 * Game invitations: a per-recipient record at `gameInvites/{toUid}/{roomId}`, so a
 * remote friend actually learns they were invited (the room alone told them
 * nothing). Written by the inviter, read by the invitee, cleared when the invite
 * is acted on or the room is swept (see `sweepStaleRoom`).
 */
export const invitationRepository = {
  /** Invite `toUid` to the room the caller just created. */
  async send(
    from: UserProfile,
    toUid: string,
    roomId: string,
    code: string,
    boardSize: BoardSize,
  ): Promise<void> {
    const invite: GameInvite = {
      roomId,
      code,
      fromUid: from.uid,
      fromName: from.displayName,
      boardSize,
      createdAt: Date.now(),
    };
    // One atomic multi-path write: the invite itself and a room-side marker so the
    // sweep can clear it when it deletes the room. Both, or neither — never a
    // marker without an invite (or vice versa). Each path is checked against its
    // own security rule.
    await update(ref(realtimeDb), {
      [RtdbPaths.roomInvitedUid(roomId, toUid)]: true,
      [RtdbPaths.gameInvite(toUid, roomId)]: invite,
    });
  },

  /** Watch my incoming invitations. Error handler is mandatory (see friendRepository). */
  subscribe(uid: string, cb: (invites: GameInvite[]) => void): () => void {
    return onValue(
      ref(realtimeDb, RtdbPaths.gameInvites(uid)),
      (snap) => {
        const val = (snap.val() as Record<string, GameInvite> | null) ?? {};
        cb(Object.values(val));
      },
      (e) => log.error('invites listener error (retrying)', describe(e)),
    );
  },

  /** Drop one of my invitations (joined or dismissed, or the room is gone). */
  async remove(uid: string, roomId: string): Promise<void> {
    try {
      await remove(ref(realtimeDb, RtdbPaths.gameInvite(uid, roomId)));
    } catch (e) {
      log.error('invite remove failed', describe(e));
    }
  },
};

function describe(e: unknown): { code?: string; message: string } {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? String(e) };
}
