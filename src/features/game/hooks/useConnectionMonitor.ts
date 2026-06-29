import { onValue, ref } from 'firebase/database';
import { useEffect } from 'react';

import { realtimeDb } from '@/services/firebase';
import { useGameStore } from '@/store';

/**
 * Reflects the realtime transport's health into the game store so the UI can
 * show a reconnect banner. RTDB reconnects automatically; we just observe its
 * `.info/connected` flag and never block gameplay on it.
 */
export function useConnectionMonitor(active: boolean): void {
  const setConnection = useGameStore((s) => s.setConnection);

  useEffect(() => {
    if (!active) return;
    const connectedRef = ref(realtimeDb, '.info/connected');
    const unsub = onValue(connectedRef, (snap) => {
      setConnection(snap.val() === true ? 'online' : 'reconnecting');
    });
    return unsub;
  }, [active, setConnection]);
}
