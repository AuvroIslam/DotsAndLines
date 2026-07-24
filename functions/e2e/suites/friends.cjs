/* eslint-disable */
'use strict';

const { firestore: admin, Checker } = require('../lib/harness.cjs');

// The friend graph lives in Firestore, so these run the client SDK against the
// Firestore emulator (which loads firestore.rules) rather than the RTDB harness.
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} = require('firebase/firestore');
const { getAuth, connectAuthEmulator, signInAnonymously } = require('firebase/auth');

let appSeq = 0;
async function clientUser() {
  const app = initializeApp({ projectId: 'demo-dotsandlines', apiKey: 'fake' }, `friends-${appSeq++}`);
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  const uid = (await signInAnonymously(auth)).user.uid;
  return { uid, fs };
}

const pairId = (a, b) => [a, b].sort().join('_');
/** Did a client write/read succeed? (permission-denied → false) */
const ok = (p) => p.then(() => true).catch(() => false);

module.exports = {
  name: 'friends — a single edge, gated on a real request',
  async run(t) {
    const a = await clientUser();
    const b = await clientUser();
    const c = await clientUser();

    t.section('a friendship can only be created when the other person asked');
    {
      // B has sent A a request (seed as B via the client so the rule sees a real doc).
      await setDoc(doc(b.fs, 'friendRequests', `${b.uid}_${a.uid}`), {
        id: `${b.uid}_${a.uid}`,
        fromUid: b.uid,
        toUid: a.uid,
        fromDisplayName: 'B',
        fromUsername: 'b',
        fromPhotoURL: null,
        status: 'pending',
        createdAt: Date.now(),
      });

      const edge = (users, profilesFor) => ({
        users: [...users].sort(),
        profiles: Object.fromEntries(profilesFor.map((u) => [u, { displayName: 'x', username: 'x', photoURL: null }])),
        createdAt: Date.now(),
      });

      // A accepts: there IS a request from B → allowed.
      t.check(
        'accepting a real request creates the edge',
        await ok(setDoc(doc(a.fs, 'friendships', pairId(a.uid, b.uid)), edge([a.uid, b.uid], [a.uid, b.uid]))),
      );

      // A tries to force-friend C, who never asked → denied (the old bypass).
      t.check(
        'you CANNOT force-friend someone who never sent a request',
        !(await ok(setDoc(doc(a.fs, 'friendships', pairId(a.uid, c.uid)), edge([a.uid, c.uid], [a.uid, c.uid])))),
      );
    }

    t.section('an edge is private to its two members');
    {
      // The A–B edge exists from above.
      t.check('a member can read their own edge', await ok(getDoc(doc(a.fs, 'friendships', pairId(a.uid, b.uid)))));
      // A non-member reading it: rules deny, and the client SDK surfaces that as an error on get.
      const outsiderCanRead = await getDoc(doc(c.fs, 'friendships', pairId(a.uid, b.uid)))
        .then(() => true)
        .catch(() => false);
      t.check('a non-member CANNOT read it', !outsiderCanRead);

      t.check('a non-member CANNOT delete it', !(await ok(deleteDoc(doc(c.fs, 'friendships', pairId(a.uid, b.uid))))));
      t.check('a member CAN unfriend (delete the edge)', await ok(deleteDoc(doc(a.fs, 'friendships', pairId(a.uid, b.uid)))));
    }

    t.section('sending a request can read the docs it must probe before writing');
    {
      // sendRequest() reads friendships/{pair}, friendRequests/{reverse} and
      // friendRequests/{forward} BEFORE it writes — and all three are usually
      // MISSING. A read rule that dereferences resource.data DENIES a get on a
      // missing doc, so these probes threw permission-denied and "Add friend"
      // silently did nothing. The get rules must permit a missing-doc read.
      const d = await clientUser();
      const e = await clientUser();
      t.check(
        'a get on a missing friendships edge is allowed',
        await ok(getDoc(doc(d.fs, 'friendships', pairId(d.uid, e.uid)))),
      );
      t.check(
        'a get on a missing reverse request is allowed',
        await ok(getDoc(doc(d.fs, 'friendRequests', `${e.uid}_${d.uid}`))),
      );
      t.check(
        'a get on a missing forward request is allowed',
        await ok(getDoc(doc(d.fs, 'friendRequests', `${d.uid}_${e.uid}`))),
      );
      t.check(
        'and then the request itself writes',
        await ok(setDoc(doc(d.fs, 'friendRequests', `${d.uid}_${e.uid}`), {
          id: `${d.uid}_${e.uid}`, fromUid: d.uid, toUid: e.uid,
          fromDisplayName: 'D', fromUsername: 'd', fromPhotoURL: null,
          status: 'pending', createdAt: Date.now(),
        })),
      );
      // The recipient's incoming list still works; a stranger cannot borrow it.
      t.check(
        'the recipient can list their incoming requests',
        await ok(getDocs(query(
          collection(e.fs, 'friendRequests'),
          where('toUid', '==', e.uid),
          where('status', '==', 'pending'),
        ))),
      );
      t.check(
        'a stranger cannot list someone else’s incoming requests',
        !(await ok(getDocs(query(
          collection(d.fs, 'friendRequests'),
          where('toUid', '==', e.uid),
          where('status', '==', 'pending'),
        )))),
      );
    }

    t.section('accepting a request is one atomic batch — even with no reverse request');
    {
      // The real acceptRequest() batch: create the edge AND delete both the
      // accepted request and its reverse. The reverse almost never exists, and
      // deleting a MISSING doc under a resource.data delete rule is denied — which
      // rejected the whole batch, so accept threw "Missing or insufficient
      // permissions", no edge was created, and the "friend" stayed a request.
      const g = await clientUser();
      const h = await clientUser();
      // H asks G. G never asked H, so the reverse request G_H does NOT exist.
      await setDoc(doc(h.fs, 'friendRequests', `${h.uid}_${g.uid}`), {
        id: `${h.uid}_${g.uid}`, fromUid: h.uid, toUid: g.uid,
        fromDisplayName: 'H', fromUsername: 'h', fromPhotoURL: null,
        status: 'pending', createdAt: Date.now(),
      });

      const batch = writeBatch(g.fs);
      batch.set(doc(g.fs, 'friendships', pairId(g.uid, h.uid)), {
        users: [g.uid, h.uid].sort(),
        profiles: {
          [h.uid]: { displayName: 'H', username: 'h', photoURL: null },
          [g.uid]: { displayName: 'G', username: 'g', photoURL: null },
        },
        createdAt: Date.now(),
      });
      batch.delete(doc(g.fs, 'friendRequests', `${h.uid}_${g.uid}`)); // the accepted one
      batch.delete(doc(g.fs, 'friendRequests', `${g.uid}_${h.uid}`)); // reverse — MISSING

      t.check('the whole accept batch commits', await ok(batch.commit()));
      t.check(
        'the friendship edge was created',
        await ok(getDoc(doc(g.fs, 'friendships', pairId(g.uid, h.uid))).then((s) => {
          if (!s.exists()) throw new Error('edge missing');
        })),
      );
      const stillReq = await getDoc(doc(g.fs, 'friendRequests', `${h.uid}_${g.uid}`));
      t.check('the accepted request was cleared, not left as a phantom', !stillReq.exists());
    }

    t.section('you cannot send a friend request to yourself');
    {
      t.check(
        'a self-request is refused',
        !(await ok(setDoc(doc(a.fs, 'friendRequests', `${a.uid}_${a.uid}`), {
          id: `${a.uid}_${a.uid}`,
          fromUid: a.uid,
          toUid: a.uid,
          fromDisplayName: 'A',
          fromUsername: 'a',
          fromPhotoURL: null,
          status: 'pending',
          createdAt: Date.now(),
        }))),
      );
    }
  },
};
