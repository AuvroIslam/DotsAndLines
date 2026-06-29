import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { useSettingsStore } from '@/store';

export type SoundName = 'line' | 'box' | 'win' | 'lose';

/**
 * Lightweight sound manager built on `expo-audio` (SDK 54). Drop `.mp3`/`.wav`
 * files into `assets/sounds/` and register them in SOUND_SOURCES to enable
 * playback; until then `play()` is a safe no-op so the rest of the app needn't
 * care whether assets exist yet.
 */
const SOUND_SOURCES: Partial<Record<SoundName, number>> = {
  // line: require('../../../assets/sounds/line.wav'),
  // box: require('../../../assets/sounds/box.wav'),
  // win: require('../../../assets/sounds/win.wav'),
  // lose: require('../../../assets/sounds/lose.wav'),
};

const cache = new Map<SoundName, AudioPlayer>();
let configured = false;

async function ensureConfigured(): Promise<void> {
  if (configured) return;
  await setAudioModeAsync({ playsInSilentMode: true });
  configured = true;
}

export const sound = {
  async play(name: SoundName): Promise<void> {
    if (!useSettingsStore.getState().soundEnabled) return;
    const source = SOUND_SOURCES[name];
    if (source === undefined) return; // no asset registered yet
    try {
      await ensureConfigured();
      let player = cache.get(name);
      if (!player) {
        player = createAudioPlayer(source);
        cache.set(name, player);
      }
      player.seekTo(0);
      player.play();
    } catch {
      // Audio failures must never interrupt gameplay.
    }
  },

  unloadAll(): void {
    for (const player of cache.values()) {
      try {
        player.remove();
      } catch {
        // ignore teardown errors
      }
    }
    cache.clear();
  },
};
