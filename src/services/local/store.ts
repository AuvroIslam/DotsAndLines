type Listener<T> = (value: T | null) => void;

/**
 * In-process analogue of an RTDB collection: keyed values with subscribe and
 * transaction semantics compatible enough with the real SDK to drive the
 * multiplayer hooks/repositories without a network.
 */
export class LocalCollection<T> {
  private entries = new Map<string, T>();
  private listeners = new Map<string, Set<Listener<T>>>();

  get(id: string): T | null {
    return this.entries.get(id) ?? null;
  }

  values(): T[] {
    return [...this.entries.values()];
  }

  set(id: string, value: T): void {
    this.entries.set(id, value);
    this.notify(id);
  }

  delete(id: string): void {
    this.entries.delete(id);
    this.notify(id);
  }

  /**
   * Synchronous analogue of RTDB's `runTransaction`: the updater sees the
   * current value and returns the next value to commit, `null` to delete,
   * or `undefined` to abort — same contract as the real SDK.
   */
  transaction(
    id: string,
    updater: (current: T | null) => T | null | undefined,
  ): { committed: boolean } {
    const result = updater(this.get(id));
    if (result === undefined) return { committed: false };
    if (result === null) this.delete(id);
    else this.set(id, result);
    return { committed: true };
  }

  /** Fires asynchronously, even for the current value — RTDB's `onValue` never calls back synchronously. */
  subscribe(id: string, cb: Listener<T>): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(cb);
    queueMicrotask(() => cb(this.get(id)));
    return () => set!.delete(cb);
  }

  private notify(id: string): void {
    const value = this.get(id);
    for (const cb of this.listeners.get(id) ?? []) cb(value);
  }
}
