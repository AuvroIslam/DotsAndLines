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
