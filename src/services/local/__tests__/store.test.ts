import { LocalCollection } from '../store';

describe('LocalCollection', () => {
  it('stores and retrieves values by id', () => {
    const c = new LocalCollection<{ n: number }>();
    expect(c.get('a')).toBeNull();
    c.set('a', { n: 1 });
    expect(c.get('a')).toEqual({ n: 1 });
    expect(c.values()).toEqual([{ n: 1 }]);
  });

  it('deletes values', () => {
    const c = new LocalCollection<{ n: number }>();
    c.set('a', { n: 1 });
    c.delete('a');
    expect(c.get('a')).toBeNull();
  });

  it('notifies subscribers on set/delete, and delivers the current value asynchronously on subscribe', async () => {
    const c = new LocalCollection<{ n: number }>();
    c.set('a', { n: 1 });

    const seen: ({ n: number } | null)[] = [];
    const unsub = c.subscribe('a', (v) => seen.push(v));
    expect(seen).toEqual([]); // async, not yet delivered

    await Promise.resolve();
    expect(seen).toEqual([{ n: 1 }]);

    c.set('a', { n: 2 });
    expect(seen).toEqual([{ n: 1 }, { n: 2 }]);

    unsub();
    c.set('a', { n: 3 });
    expect(seen).toEqual([{ n: 1 }, { n: 2 }]); // no more updates after unsubscribe
  });

  it('transaction commits on a defined return, deletes on null, aborts on undefined', () => {
    const c = new LocalCollection<{ n: number }>();
    c.set('a', { n: 1 });

    const commit = c.transaction('a', (cur) => ({ n: (cur?.n ?? 0) + 1 }));
    expect(commit).toEqual({ committed: true });
    expect(c.get('a')).toEqual({ n: 2 });

    const abort = c.transaction('a', () => undefined);
    expect(abort).toEqual({ committed: false });
    expect(c.get('a')).toEqual({ n: 2 }); // unchanged

    const del = c.transaction('a', () => null);
    expect(del).toEqual({ committed: true });
    expect(c.get('a')).toBeNull();
  });
});
