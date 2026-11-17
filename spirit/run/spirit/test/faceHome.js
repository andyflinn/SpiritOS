'use strict';

// spirit/run/spirit/test/faceHome.js
// The tests of spirit/faceHome.js, and of no other module (spec: ./faceHome.md). This file holds goal/G41.30, the review's
// RC1: "any relay a node is connected to can run every owner verb on that node by sending a face event". The verbs G41.30
// took off the face went with the half face (goal/G43.18, box v29: "a face it answers is a full face"), so a relay with no
// face of this node's, or no star, gets nothing at all. createFaceHome runs on stand-ins that keep what reached them: the door
// (o.call), the file route and the save. An answer is read from the stand-in upload, sealed or not.
// The one test file of faceHome.js: the star part (the star end to end, on a real node, relay and face) and the
// starApps part (a star shows every app, read in a real Chrome), once faceHome-star.js and faceHome-starApps.js, are
// sections of it, run after its own checks.
// ONE test.run PER CHECK (goal/G47.2): the tests run in order and share W, what earlier ones made; a test whose world is
// missing fails, saying so, never skips. A refusal that keeps a relay out is a security check, 0.8.

const fs = require('fs');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/faceHome/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/faceHome'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const seal = require(path.join(RUN, 'spirit', 'seal.js'));
const { createFaceHome } = require(path.join(RUN, 'spirit', 'faceHome.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const settle = async function () { for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); }); };

// What the tests made, for the tests after them.
const W = {};
// A thing of W, made the first time a test needs it, so a throw lands on that test.
function lazy(k, make) { if (!W[k]) W[k] = make(); return W[k]; }

const ME = auth.generateIdentity('home');
const FACE = auth.generateIdentity('face');
const MINE = 'https://my-face-is-here.example';
const OTHER = 'https://a-relay-with-no-face-of-mine.example';

// THE OPTIONS THE FIX NEEDS: faceSet(url), true when this node set a face on that relay, and faceOwned(url), the star
// (server.js gives both from the relay's row; see the spec).
function world(faceSet, faceOwned) {
  const w = { calls: [], files: [], saved: [], uploads: {} };
  const o = {
    call: function (v, a) { w.calls.push(v); return Promise.resolve({ status: 200, body: { ok: true } }); },
    serveFile: function (rel, res) { w.files.push(rel); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('file'); },
    saveFrom: function (work, rel) { w.saved.push(rel); return { ok: true }; },
    identity: function () { return ME; },
    relayKey: function () { return 'RELAYKEY'; },
    upload: function (url, p, headers) {
      const u = { url: url, path: p, headers: headers, chunks: [], on: function () {}, once: function () {}, destroy: function () {}, write: function (c) { u.chunks.push(Buffer.from(c)); return true; }, end: function (c) { if (c) u.chunks.push(Buffer.from(c)); u.ended = true; } };
      w.uploads[p] = u;
      return u;
    },
    jobs: { listJobs: function () { return []; }, onEvent: function () {} },
    log: function () {},
  };
  if (faceSet) o.faceSet = faceSet;
  if (faceOwned) o.faceOwned = faceOwned;
  w.home = createFaceHome(o);
  return w;
}
const onlyMine = function (url) { return url === MINE; };
const never = function () { return false; };

let n = 0;
// One request through the relay: what the door got, and the answer: { status, body }, opened if it came sealed.
async function send(w, url, request) {
  n += 1;
  const id = 'r' + n;
  const calls = w.calls.length;
  let thrown = null;
  try { w.home.request(url, { id: id, request: request }); } catch (e) { thrown = e; }
  await settle();
  const u = w.uploads['/api/relay/face/answer?id=' + id];
  const a = { reached: w.calls.slice(calls), thrown: thrown, status: u ? Number(u.headers['x-spirit-status']) : 0, body: null };
  if (u) {
    const text = Buffer.concat(u.chunks).toString('utf8');
    if (u.headers['x-spirit-type'] === 'application/x-ndjson') {
      const lines = text.split('\n').filter(Boolean).map(function (l) { const g = seal.open(FACE.sealPrivateKey, ME.publicKey, FACE.sealPublicKey, JSON.parse(l)); return g ? g.text : ''; });
      let head = null; try { head = JSON.parse(lines[0]); } catch (e) { head = null; }
      a.status = head ? head.status : 0;
      try { a.body = JSON.parse(Buffer.from(lines.slice(1).join(''), 'base64').toString('utf8')); } catch (e) { a.body = null; }
    } else { try { a.body = JSON.parse(text); } catch (e) { a.body = null; } }
  }
  return a;
}
function sealed(call) {
  const value = seal.seal(ME.sealPublicKey, FACE.sealPublicKey, ME.publicKey, JSON.stringify(call));
  return Object.assign({ sealed: 1, k: FACE.sealPublicKey }, value);
}
function pieced(call) { return { piece: { id: 'p' + (n + 1), n: 0, of: 1, text: Buffer.from(JSON.stringify(call)).toString('base64') } }; }
const refused = function (a) { return !a.thrown && a.status >= 400 && a.status < 500 && !!a.body && typeof a.body.code === 'string' && a.body.code !== ''; };

const CARD = { call: 'node.card', args: {} };
const SHELL = { call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'id'] } };

// A request sent to a stand-in world, its answer kept under key; then that the answer never reached the door.
function sentAndHeld(key, worldKey, makeWorld, url, makeReq) {
  return async function () {
    const w = lazy(worldKey, makeWorld);
    const a = W[key] = await send(w, url, makeReq());
    return !a.reached.length || false;
  };
}
// The answer kept under key was a refusal with a code.
function wasRefused(key) {
  return function () { const a = W[key]; if (!a) return false; return refused(a) || false; };
}
// A request sent to a stand-in world: refused, and it never reached the door.
function sentAndRefused(worldKey, makeWorld, url, makeReq) {
  return async function () {
    const w = lazy(worldKey, makeWorld);
    const a = await send(w, url, makeReq());
    return (!a.reached.length && refused(a)) || false;
  };
}

// ── ITS OWN CHECKS ──────────────────────────────────────────────────────────────────────────────────────────────────────

// A relay where this node set no face gets nothing. The review: "the node never checks that it set a face on that relay,
// that a face is open, or who asked."; its fix: "accept face* events only from a relay where this node set a face".
const noFaceWorld = function () { return world(onlyMine); };
test.run('from a relay with no face of mine, an allowed verb never reaches the door', 0.8, sentAndHeld('o1', 'w', noFaceWorld, OTHER, function () { return CARD; }), test.limit.quick);
test.run('from a relay with no face of mine, an allowed verb is answered a refusal with a code', 0.8, wasRefused('o1'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell never reaches the door', 0.8, sentAndHeld('o2', 'w', noFaceWorld, OTHER, function () { return SHELL; }), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell is answered a refusal with a code', 0.8, wasRefused('o2'), test.limit.quick);
test.run('from a relay with no face of mine, a sealed job.create with a shell never reaches the door', 0.8, sentAndHeld('o3', 'w', noFaceWorld, OTHER, function () { return sealed(SHELL); }), test.limit.quick);
test.run('from a relay with no face of mine, a sealed job.create with a shell is answered a refusal with a code', 0.8, wasRefused('o3'), test.limit.quick);
test.run('from a relay with no face of mine, a job.create with a shell sent in pieces never reaches the door', 0.8, sentAndHeld('o4', 'w', noFaceWorld, OTHER, function () { return pieced(SHELL); }), test.limit.quick);
test.run('from a relay with no face of mine, a job.create with a shell sent in pieces is answered a refusal with a code', 0.8, wasRefused('o4'), test.limit.quick);
test.run('a file asked by it is not served, and refused', 0.8, async function () {
  const w = lazy('w', noFaceWorld);
  const file = await send(w, OTHER, { get: 'face.html' });
  return (!w.files.length && refused(file)) || false;
}, test.limit.quick);
test.run('the keys asked by it are refused', 0.8, async function () {
  const keys = await send(lazy('w', noFaceWorld), OTHER, { keys: 1 });
  return refused(keys) || false;
}, test.limit.quick);
test.run('face-open from it starts no stream of this node\'s events', 0.8, function () {
  const w = lazy('w', noFaceWorld);
  let opened = null;
  try { w.home.open(OTHER, ''); opened = !!w.uploads['/api/relay/face/stream']; } catch (e) { opened = null; }
  try { w.home.close(OTHER); } catch (e) { /* its own check is this one */ }
  return opened === false || false;
}, test.limit.quick);

// With no faceSet given at all, it refuses: closed, not open.
test.run('a face home told of no face takes no call', 0.8, async function () {
  const none = await send(world(null), MINE, CARD);
  return (!none.reached.length && refused(none)) || false;
}, test.limit.quick);

// Box v29: "The home node answers a face only from a starred relay, one check; a face it answers is a full face." The relay
// where this node set a face, and starred, works as before.
const starredWorld = function () { return world(onlyMine, onlyMine); };
test.run('node.card reaches the door', 0.2, async function () {
  const card = await send(lazy('m', starredWorld), MINE, CARD);
  return (card.reached.indexOf('node.card') !== -1 && card.status === 200) || false;
}, test.limit.quick);
test.run('a sealed node.card reaches the door too', 0.2, async function () {
  const cardSealed = await send(lazy('m', starredWorld), MINE, sealed(CARD));
  return (cardSealed.reached.indexOf('node.card') !== -1 && cardSealed.status === 200) || false;
}, test.limit.quick);
test.run('a file it asks is served (the face loads its parts so)', 0.2, async function () {
  const m = lazy('m', starredWorld);
  const f = await send(m, MINE, { get: 'face.html' });
  return (m.files.indexOf('face.html') !== -1 && f.status === 200) || false;
}, test.limit.quick);
test.run('the keys are answered', 0.2, async function () {
  const k = await send(lazy('m', starredWorld), MINE, { keys: 1 });
  return (k.status === 200 && !!k.body && k.body.publicKey === ME.publicKey) || false;
}, test.limit.quick);
test.run('face-open starts the stream', 0.2, function () {
  const m = lazy('m', starredWorld);
  let streaming = false;
  try { m.home.open(MINE, ''); streaming = !!m.uploads['/api/relay/face/stream']; } catch (e) { streaming = false; }
  try { m.home.close(MINE); } catch (e) { /* the stream is the stand-in's */ }
  return streaming || false;
}, test.limit.quick);

// A QUIET NODE IS NEVER TAKEN FOR DEAD ON A FACE (goal/G47.1, box v148: "the node beats each second when it has nothing else to
// send, on the page's stream ... and on a face's (spirit/faceHome.js, none today)"). A face's stream open on a node with nothing
// to send, what it writes to the relay timed for 4 s: no gap between two writes is longer than 1.5 s.
test.run('a quiet face stream carries a beat each second: no gap of more than 1.5 s in 4 s', 0.8, async function () {
  const w = starredWorld();
  try { w.home.open(MINE, ''); } catch (e) { return false; }
  const u = w.uploads['/api/relay/face/stream'];
  if (!u) return false;
  await settle();
  const times = [];
  const write = u.write;
  u.write = function (c) { times.push(Date.now()); return write.call(u, c); };
  const t0 = Date.now();
  await sleep(4000);
  try { w.home.close(MINE); } catch (e) { /* the stand-in's */ }
  const marks = [t0].concat(times).concat([t0 + 4000]);
  let worst = 0;
  for (let i = 1; i < marks.length; i++) worst = Math.max(worst, marks[i] - marks[i - 1]);
  return worst <= 1500 || false;
}, test.limit.slow);

// Every verb the families declare, from their own declarations.
const allFamilies = function () {
  // A test folder is no family: spirit/app/test/api.js is the app family's own test, not a branch.
  const dirs = function (d) { return fs.readdirSync(path.join(RUN, d), { withFileTypes: true }).filter(function (e) { return e.isDirectory() && e.name !== 'test'; }).map(function (e) { return e.name; }); };
  return dirs('spirit').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); })
    .concat(dirs('spirit/app').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', 'app', n, 'api.js')) && !fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); }));
};
const verbsOf = function (file) { return Object.keys(require(path.join(RUN, file)).verbs); };

// GOAL/G43.18, BOX V29, "A face is whole, or there is none" (Andy: "we remove ALL the star shit, like this,", "on the home
// node, NO face is offered (faceForm hides itself) for a relay without star."): the half face of G41.30 and G41.33 is gone.
// A relay with my face and no star gets nothing at all.
const plainWorld = function () { return world(onlyMine, never); };
test.run('with no star, node.card is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return CARD; }), test.limit.quick);
test.run('with no star, a sealed node.card is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return sealed(CARD); }), test.limit.quick);
test.run('with no star, fs.stat is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { call: 'fs.stat', args: { path: 'x' } }; }), test.limit.quick);
test.run('with no star, owner.command is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { call: 'owner.command', args: { key: 'x' } }; }), test.limit.quick);
test.run('with no star, job.create with a shell is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return SHELL; }), test.limit.quick);
test.run('with no star, a job.create with a shell sent in pieces is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return pieced(SHELL); }), test.limit.quick);
test.run('with no star, a file is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { get: 'face.html' }; }), test.limit.quick);
test.run('with no star, the ask for the keys is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { keys: 1 }; }), test.limit.quick);
test.run('with no star, a save in parts is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { upload: { id: 'abcdefgh', n: 0, of: 1, size: 1, path: 'x.txt', bytes: 'eA==' } }; }), test.limit.quick);
test.run('with no star, no file is served and none is written', 0.8, function () {
  const plain = W.plain;
  if (!plain) return false;
  return (!plain.files.length && !plain.saved.length) || false;
}, test.limit.quick);

// Starring takes the node's own word, and a face there.
test.run('only true counts as a star, so a truthy answer opens nothing', 0.8, sentAndRefused('loose', function () { return world(onlyMine, function () { return 'yes'; }); }, MINE, function () { return CARD; }), test.limit.quick);
test.run('a starred relay where this node set no face gets nothing', 0.8, sentAndRefused('noFace', function () { return world(never, function () { return true; }); }, MINE, function () { return CARD; }), test.limit.quick);

// THE STAR IS SET AT HOME (Andy: "so this button will put the star on relays and puppets. AND take it away."; every
// contact's panel has it "at home"). From a face, even on a relay this node owns, it would let whoever is in on one
// face hand the machine to another relay. contact.own never comes through a face.
const OWN_CALL = { call: 'contact.own', args: { key: 'K', own: true } };
test.run('an unsealed contact.own on a relay this node owns is refused with a code and never reaches the door', 0.8, sentAndRefused('ownMine', starredWorld, MINE, function () { return OWN_CALL; }), test.limit.quick);
test.run('a sealed contact.own on a relay this node owns is refused with a code and never reaches the door', 0.8, sentAndRefused('ownMine', starredWorld, MINE, function () { return sealed(OWN_CALL); }), test.limit.quick);
test.run('an unsealed contact.own on a relay it does not own is refused with a code and never reaches the door', 0.8, sentAndRefused('ownNot', plainWorld, MINE, function () { return OWN_CALL; }), test.limit.quick);
test.run('a sealed contact.own on a relay it does not own is refused with a code and never reaches the door', 0.8, sentAndRefused('ownNot', plainWorld, MINE, function () { return sealed(OWN_CALL); }), test.limit.quick);

// GOAL/G41.33. THE BOX: "anything andy gets on his loopback screen, he can get on his face, if he "stars" any relay he's
// a member of or owns", and "this includes" bundles, branches and grants; a job deleted; running jobs; join steps; relay
// events. "for a face(relay) with star, NO
// RESTRICTIONS AT ALL, except changing stars." Relay events "overrules goal/G30.13". Box v29 took the half face away: a
// face with no star hears nothing. Here o.events is a stand-in, and a relay event comes as server.js sends it, an
// owner's and the monitor's alike by the node's dispatcher alone (ownerEvent went with the half face).
const PRIORITIES_TODAY = { fs: 2, presence: 3, app: 4, stats: 5 };
const STARRED = 'https://a-relay-i-starred.example';
const PLAIN = 'https://a-relay-with-no-star.example';
function streams(star) {
  const s = { subs: [], jobs: [], ups: {}, busy: false, drains: [] };
  const o = {
    call: function () { return Promise.resolve({ status: 200, body: { ok: true } }); },
    serveFile: function () {}, saveFrom: function () { return { ok: true }; },
    identity: function () { return ME; },
    relayKey: function () { return 'RELAYKEY'; },
    upload: function (url, p) {
      const u = { url: url, path: p, chunks: [], on: function () {}, destroy: function () {}, once: function (e, fn) { if (e === 'drain') s.drains.push(fn); }, write: function (c) { u.chunks.push(String(c)); return !s.busy; }, end: function () {}, headers: {} };
      if (p === '/api/relay/face/stream') s.ups[url] = u;
      return u;
    },
    jobs: { listJobs: function () { return s.jobs; }, onEvent: function () {} },
    events: { subscribe: function (fn) { s.subs.push(fn); return function () {}; } },
    log: function () {},
    faceSet: function () { return true; },
    faceOwned: star,
  };
  s.home = createFaceHome(o);
  s.emit = function (kind, data) { s.subs.forEach(function (fn) { fn(kind, data); }); };
  s.lines = function (url) {
    const u = s.ups[url];
    return !u ? [] : u.chunks.join('').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return { unread: l }; } });
  };
  s.got = function (url, event, data) {
    const want = JSON.stringify(data);
    return s.lines(url).filter(function (l) { return l.event === event && JSON.stringify(l.data) === want; }).length;
  };
  return s;
}
const starAt = function (url) { return url === STARRED; };
const jobEvents = [
  ['a bundle', 'job-updated', { id: 'spirit.auth', kind: 'permanent', status: 'running', log: [], data: { table: 'bundle', row: { id: 1, label: 'zz' }, gone: false } }],
  ['a branch', 'job-updated', { id: 'spirit.auth', kind: 'permanent', status: 'running', log: [], data: { table: 'branch', row: { id: 2, bundle: 1 }, gone: false } }],
  ['a grant', 'job-updated', { id: 'spirit.auth', kind: 'permanent', status: 'running', log: [], data: { table: 'grant', row: { id: 3 }, gone: true } }],
  ['a job deleted', 'job-deleted', 'spirit.app.zz'],
  ['a running job of a process', 'job-updated', { id: 'spirit.app.zz', kind: 'process', status: 'running', module: 'spirit.app.zz', log: [{ timestamp: 1, message: 'job created' }], data: { command: 'node', progress: 0 } }],
  ['a running job of no module', 'job-updated', { id: 'spirit.app.zzOther', kind: 'process', status: 'running', log: [], data: {} }],
  ['a job of an id nobody has listed', 'job-updated', { id: 'spirit.zzNeverSeen', kind: 'zzKind', status: 'running', log: [], data: {} }],
  ['a server\'s job as a whole', 'job-updated', { id: 'spirit.app.zzServer', kind: 'server', status: 'running', module: 'spirit.app.zzServer', log: [{ timestamp: 1, message: 'job created' }], data: { pid: 1 } }],
  ['the join steps', 'job-updated', { id: 'spirit', kind: 'permanent', status: 'running', log: [], data: { join: { steps: ['zz'] } } }],
  ['a relay event of the monitor, a post', 'relay-event', { kind: 'post', relay: STARRED, from: 'zz' }],
  ['a relay event of the monitor, a reply', 'relay-event', { kind: 'reply', relay: STARRED, from: 'zz' }],
  ['a relay event of the monitor, a refusal', 'relay-event', { kind: 'refused', relay: STARRED, from: 'zz' }],
  ['a relay\'s status', 'relay-event', { kind: 'relay-status', relay: STARRED, report: { members: 1 } }],
];
// The i-th event emitted: it reaches the starred face once.
function arrivesOnce(i) {
  return function () {
    const sx = W.sx; if (!sx) return false;
    const c = jobEvents[i];
    sx.emit(c[1], c[2]);
    const on = sx.got(STARRED, c[1], c[2]);
    return on === 1 || false;
  };
}
// The i-th event, emitted above: it never reached the face with no star.
function staysHome(i) {
  return function () {
    const sx = W.sx; if (!sx) return false;
    const c = jobEvents[i];
    return sx.got(PLAIN, c[1], c[2]) === 0 || false;
  };
}

// A starred face hears what the loopback hears, each once, and a face with no star hears nothing (box v29).
test.run('both faces have their stream open', 0.2, async function () {
  const sx = W.sx = streams(starAt);
  sx.home.open(STARRED, '');
  sx.home.open(PLAIN, '');
  await settle();
  return (!!sx.ups[STARRED] && !!sx.ups[PLAIN]) || false;
}, test.limit.quick);
test.run('the home side subscribes to the node\'s events', 0.2, function () { if (!W.sx) return false; return W.sx.subs.length > 0 || false; }, test.limit.quick);
test.run('when starred, a bundle arrives whole, once', 0.2, arrivesOnce(0), test.limit.quick);
test.run('when starred, a branch arrives whole, once', 0.2, arrivesOnce(1), test.limit.quick);
test.run('when starred, a grant arrives whole, once', 0.2, arrivesOnce(2), test.limit.quick);
test.run('when starred, a deleted job arrives whole, once', 0.2, arrivesOnce(3), test.limit.quick);
test.run('when starred, a running job of a process arrives whole, once', 0.2, arrivesOnce(4), test.limit.quick);
test.run('when starred, a running job of no module arrives whole, once', 0.2, arrivesOnce(5), test.limit.quick);
test.run('when starred, a job of an id nobody has listed arrives whole, once', 0.2, arrivesOnce(6), test.limit.quick);
test.run('when starred, a server\'s job as a whole arrives whole, once', 0.2, arrivesOnce(7), test.limit.quick);
test.run('when starred, the join steps arrive whole, once', 0.2, arrivesOnce(8), test.limit.quick);
test.run('when starred, a post among the monitor\'s relay events arrives whole, once', 0.2, arrivesOnce(9), test.limit.quick);
test.run('when starred, a reply among the monitor\'s relay events arrives whole, once', 0.2, arrivesOnce(10), test.limit.quick);
test.run('when starred, a refusal among the monitor\'s relay events arrives whole, once', 0.2, arrivesOnce(11), test.limit.quick);
test.run('when starred, a relay\'s status arrives whole, once', 0.2, arrivesOnce(12), test.limit.quick);
test.run('with no star, a bundle stays home', 0.8, staysHome(0), test.limit.quick);
test.run('with no star, a branch stays home', 0.8, staysHome(1), test.limit.quick);
test.run('with no star, a grant stays home', 0.8, staysHome(2), test.limit.quick);
test.run('with no star, a deleted job stays home', 0.8, staysHome(3), test.limit.quick);
test.run('with no star, a running job of a process stays home', 0.8, staysHome(4), test.limit.quick);
test.run('with no star, a running job of no module stays home', 0.8, staysHome(5), test.limit.quick);
test.run('with no star, a job of an id nobody has listed stays home', 0.8, staysHome(6), test.limit.quick);
test.run('with no star, a server\'s job as a whole stays home', 0.8, staysHome(7), test.limit.quick);
test.run('with no star, the join steps stay home', 0.8, staysHome(8), test.limit.quick);
test.run('with no star, a post among the monitor\'s relay events stays home', 0.8, staysHome(9), test.limit.quick);
test.run('with no star, a reply among the monitor\'s relay events stays home', 0.8, staysHome(10), test.limit.quick);
test.run('with no star, a refusal among the monitor\'s relay events stays home', 0.8, staysHome(11), test.limit.quick);
test.run('with no star, a relay\'s status stays home', 0.8, staysHome(12), test.limit.quick);

// Box v29: a face with no star gets nothing, not even the file tree. Each event is emitted by its no-star check, and the
// starred check after it reads the same lines.
const today = [['the file tree', 'job-updated', { id: 'spirit.fs', kind: 'permanent', status: 'running', data: { command: { op: 'zz' } } }],
  ['a row of the one table', 'job-updated', { id: 'spirit.contact', kind: 'permanent', status: 'running', data: { row: 1 } }],
  ['a contact renamed', 'contact.rename', { key: 'K', name: 'zz' }]];
function todayStaysHome(i) {
  return function () {
    const sx = W.sx; if (!sx) return false;
    const c = today[i];
    sx.emit(c[1], c[2]);
    return sx.got(PLAIN, c[1], c[2]) === 0 || false;
  };
}
function todayArrives(i) {
  return function () {
    const sx = W.sx; if (!sx) return false;
    const c = today[i];
    return sx.got(STARRED, c[1], c[2]) === 1 || false;
  };
}
test.run('with no star, the file tree stays home', 0.8, todayStaysHome(0), test.limit.quick);
test.run('when starred, the file tree arrives, once', 0.2, todayArrives(0), test.limit.quick);
test.run('with no star, a row of the one table stays home', 0.8, todayStaysHome(1), test.limit.quick);
test.run('when starred, a row of the one table arrives, once', 0.2, todayArrives(1), test.limit.quick);
test.run('with no star, a renamed contact stays home', 0.8, todayStaysHome(2), test.limit.quick);
test.run('when starred, a renamed contact arrives, once', 0.2, todayArrives(2), test.limit.quick);
// An owner's event reaches a face by the node's dispatcher alone (ownerEvent went with the half face, box v29): one line.
const minted = { kind: 'invite-minted', relay: STARRED, invite: 'zz' };
test.run('when starred, an owner\'s relay event arrives once', 0.2, function () {
  const sx = W.sx; if (!sx) return false;
  sx.emit('relay-event', minted);
  return sx.got(STARRED, 'relay-event', minted) === 1 || false;
}, test.limit.quick);
test.run('with no star, an owner\'s relay event stays home', 0.8, function () {
  const sx = W.sx; if (!sx) return false;
  return sx.got(PLAIN, 'relay-event', minted) === 0 || false;
}, test.limit.quick);

// goal/G41.33: only true is a star, the star counts at each event, and it sends no catch-up.
test.run('a truthy answer is no star, so nothing arrives', 0.8, async function () {
  const loose2 = streams(function () { return 'yes'; });
  loose2.home.open(STARRED, '');
  await settle();
  loose2.emit('job-deleted', 'job_1');
  return loose2.got(STARRED, 'job-deleted', 'job_1') === 0 || false;
}, test.limit.quick);
test.run('before the star is pressed, nothing arrives', 0.8, async function () {
  W.pressed = false;
  const sw = W.sw = streams(function () { return W.pressed; });
  sw.home.open(STARRED, '');
  await settle();
  sw.emit('job-deleted', 'job_before');
  return sw.got(STARRED, 'job-deleted', 'job_before') === 0 || false;
}, test.limit.quick);
test.run('when the star is pressed with the face open, the next event arrives with no reopening', 0.2, async function () {
  const sw = W.sw; if (!sw) return false;
  W.pressed = true;
  await settle();
  W.atPress = sw.lines(STARRED).length;
  sw.emit('job-deleted', 'job_on');
  return sw.got(STARRED, 'job-deleted', 'job_on') === 1 || false;
}, test.limit.quick);
test.run('pressing the star sends no catch-up, so what went before the press never comes', 0.8, function () {
  const sw = W.sw; if (!sw || W.atPress === undefined) return false;
  return (sw.got(STARRED, 'job-deleted', 'job_before') === 0 && sw.lines(STARRED).length === W.atPress + 1) || false;
}, test.limit.quick);
test.run('once the star is taken off, the next event stays home at once', 0.8, function () {
  const sw = W.sw; if (!sw) return false;
  W.pressed = false;
  sw.emit('job-deleted', 'job_off');
  return sw.got(STARRED, 'job-deleted', 'job_off') === 0 || false;
}, test.limit.quick);

// goal/G41.33: a starred face that opens gets what a loopback page gets on connect.
// event.js handleSubscribe: "snapshot", { jobs: o.jobs.listJobs() }. The envelope is the builder's; the jobs are the box's.
const SNAPSHOT = [jobEvents[0][2], jobEvents[4][2], jobEvents[5][2], jobEvents[6][2], jobEvents[8][2]];
async function snapshotStreams() {
  if (W.sn) return W.sn;
  const sn = streams(starAt);
  sn.jobs = SNAPSHOT;
  sn.home.open(STARRED, '');
  sn.home.open(PLAIN, '');
  await settle();
  W.sn = sn;
  return sn;
}
const onWire = function (sn, url, id) { return JSON.stringify(sn.lines(url)).indexOf('"id":"' + id + '"') !== -1; };
function onOpening(id) {
  return async function () { const sn = await snapshotStreams(); return onWire(sn, STARRED, id) || false; };
}
function notOnOpening(id) {
  return async function () { const sn = await snapshotStreams(); return !onWire(sn, PLAIN, id) || false; };
}
test.run('when starred, the job spirit.auth is there on opening', 0.2, onOpening('spirit.auth'), test.limit.quick);
test.run('with no star, the job spirit.auth is not there on opening', 0.8, notOnOpening('spirit.auth'), test.limit.quick);
test.run('when starred, the job spirit.app.zz is there on opening', 0.2, onOpening('spirit.app.zz'), test.limit.quick);
test.run('with no star, the job spirit.app.zz is not there on opening', 0.8, notOnOpening('spirit.app.zz'), test.limit.quick);
test.run('when starred, the job spirit.app.zzOther is there on opening', 0.2, onOpening('spirit.app.zzOther'), test.limit.quick);
test.run('with no star, the job spirit.app.zzOther is not there on opening', 0.8, notOnOpening('spirit.app.zzOther'), test.limit.quick);
test.run('when starred, the job spirit.zzNeverSeen is there on opening', 0.2, onOpening('spirit.zzNeverSeen'), test.limit.quick);
test.run('with no star, the job spirit.zzNeverSeen is not there on opening', 0.8, notOnOpening('spirit.zzNeverSeen'), test.limit.quick);
test.run('when starred, the job spirit is there on opening', 0.2, onOpening('spirit'), test.limit.quick);
test.run('with no star, the job spirit is not there on opening', 0.8, notOnOpening('spirit'), test.limit.quick);

// goal/G41.33: the queue does not change, and it loses none of the new ones.
test.run('while the sink is busy only one event is written, and the rest wait for it', 0.2, async function () {
  const q = W.q = streams(starAt);
  q.home.open(STARRED, '');
  await settle();
  q.busy = true;
  q.emit('job-deleted', 'job_first');
  q.emit('job-deleted', 'job_while_busy');
  q.emit('job-updated', jobEvents[0][2]);
  q.emit('relay-event', jobEvents[9][2]);
  const whileBusy = q.lines(STARRED).length;
  q.busy = false;
  q.drains.splice(0).forEach(function (fn) { fn(); });
  return whileBusy === 1 || false;
}, test.limit.quick);
test.run('after the drain every waiting event has gone out', 0.2, function () {
  const q = W.q; if (!q) return false;
  return (q.got(STARRED, 'job-deleted', 'job_while_busy') === 1 && q.got(STARRED, 'job-updated', jobEvents[0][2]) === 1 && q.got(STARRED, 'relay-event', jobEvents[9][2]) === 1) || false;
}, test.limit.quick);
test.run('the queue\'s levels are as they were', 0.2, function () {
  const P = require(path.join(RUN, 'spirit', 'faceHome.js')).FACE_PRIORITY;
  return JSON.stringify(P) === JSON.stringify(PRIORITIES_TODAY) || false;
}, test.limit.quick);

// goal/G41.33: a starred face has no restrictions at all, except changing stars.
test.run('every verb of every family reaches the door, unsealed and sealed', 0.2, async function () {
  const free = lazy('free', starredWorld);
  let shut = 0;
  for (const fam of allFamilies()) {
    const inSpirit = fs.existsSync(path.join(RUN, 'spirit', fam, 'api.js'));
    for (const v of verbsOf(inSpirit ? 'spirit/' + fam + '/api.js' : require(path.join(RUN, 'spirit', 'spirit.js')).familyPath(fam))) {
      if (fam + '.' + v === 'contact.own') continue;
      const c = { call: fam + '.' + v, args: {} };
      for (const form of [c, sealed(c)]) {
        const a = await send(free, MINE, form);
        if (a.reached.indexOf(c.call) === -1) shut += 1;
      }
    }
  }
  return !shut || false;
}, test.limit.slow);
const THROUGH = { call: 'relay.face', args: { url: MINE, name: 'zz' } };
const FACE_POST = { call: 'peer.post', args: { to: 'RELAYKEY', text: JSON.stringify({ body: { face: 'zz' } }) } };
test.run('when starred, an unsealed relay.face on the relay it is called through reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, THROUGH);
  return on.reached.indexOf('relay.face') !== -1 || false;
}, test.limit.quick);
test.run('with no star, an unsealed relay.face on the relay it is called through stays refused', 0.8, sentAndRefused('off1', plainWorld, MINE, function () { return THROUGH; }), test.limit.quick);
test.run('when starred, a sealed relay.face on the relay it is called through reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, sealed(THROUGH));
  return on.reached.indexOf('relay.face') !== -1 || false;
}, test.limit.quick);
test.run('with no star, a sealed relay.face on the relay it is called through stays refused', 0.8, sentAndRefused('off2', plainWorld, MINE, function () { return sealed(THROUGH); }), test.limit.quick);
test.run('when starred, an unsealed peer.post to that relay carrying a face name reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, FACE_POST);
  return on.reached.indexOf('peer.post') !== -1 || false;
}, test.limit.quick);
test.run('with no star, an unsealed peer.post to that relay carrying a face name stays refused', 0.8, sentAndRefused('off3', plainWorld, MINE, function () { return FACE_POST; }), test.limit.quick);
test.run('when starred, a sealed peer.post to that relay carrying a face name reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, sealed(FACE_POST));
  return on.reached.indexOf('peer.post') !== -1 || false;
}, test.limit.quick);
test.run('with no star, a sealed peer.post to that relay carrying a face name stays refused', 0.8, sentAndRefused('off4', plainWorld, MINE, function () { return sealed(FACE_POST); }), test.limit.quick);
test.run('changing stars stays home, so an unsealed contact.own with own true is refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return { call: 'contact.own', args: { key: 'K', own: true } }; }), test.limit.quick);
test.run('changing stars stays home, so a sealed contact.own with own true is refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return sealed({ call: 'contact.own', args: { key: 'K', own: true } }); }), test.limit.quick);
test.run('changing stars stays home, so an unsealed contact.own with own false is refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return { call: 'contact.own', args: { key: 'K', own: false } }; }), test.limit.quick);
test.run('changing stars stays home, so a sealed contact.own with own false is refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return sealed({ call: 'contact.own', args: { key: 'K', own: false } }); }), test.limit.quick);

// ── THE STAR PART, once faceHome-star.js ────────────────────────────────────────────────────────────────────────────────
// THE STAR, END TO END (goal/G41.30; Andy: "why does no test assert the fix?", "wsl? do it."; "your face on a relay you
// own gets everything back, jobs, files, grants, puppets, under your login as it is now."; "so this button will put the star on relays and puppets. AND take it away."). spirit/test/
// faceHome.js stands in for "did this node set a face" and "is this relay starred"; here nothing of the node is stood in.
// A real scratch node joins real scratch relays by their mail, sets a face and logs in, and every call is what a page
// sends: POST /face/call with its cookie, its Origin and json. Only the relay's mailer keeps its mail. A step that could
// not run is red, never skipped.
// GOAL/G43.18, BOX V29, "A face is whole, or there is none" (Andy: "we remove ALL the star shit, like this,", "on the home
// node, NO face is offered (faceForm hides itself) for a relay without star."): "The home node answers a face only from a
// starred relay, one check; a face it answers is a full face.", "A star taken off a relay that has a face takes that face
// away (Q21).", "Starring is never asked from a face (contact.own)". So the half face of G41.30 and G41.33 is gone here:
// without the star the face gets no answer and no stream at all.

const WAIT_MS = 1500;
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// The node's own loopback door, as the owner at home.
async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// One POST as a page sends it, at the face's own host.
function page(relay, name, p, body, sid) {
  return new Promise(function (resolve) {
    const b = JSON.stringify(body);
    const host = name + '.relay.example';
    const headers = { Host: host, Origin: 'https://' + host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) };
    if (sid) headers.Cookie = 'spirit_face=' + sid;
    const t = setTimeout(function () { q.destroy(); resolve({ status: 0, text: '' }); }, 15000);
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: 'POST', headers: headers }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { clearTimeout(t); resolve({ status: r.statusCode, text: text, body: parsed(text), cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function () { clearTimeout(t); resolve({ status: 0, text: '' }); });
    q.end(b);
  });
}
const MAIL = 'bert@example.org';

// A real join: the node asks, the relay mails, the node confirms with the mail's code. True when joined.
async function join(N, R) {
  const added = await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  if (added.status !== 200) return false;
  const asked = await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  if (asked.status >= 300) return false;
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return false;
  const done = await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  if (done.status >= 300) return false;
  return true;
}
// relay.face at home; the first ask may still be waiting for the relay's card. True when the face is set.
async function setFace(N, R, name) {
  for (let i = 0; i < 10; i++) {
    const f = await home(N.base, 'relay.face', { url: R.base, name: name });
    if (f.status === 200) return true;
    await sleep(2000);
  }
  return false;
}
// The face's login: the member's email, then the token the mail holds.
async function logIn(R, name) {
  let state = null;
  await until(function () { return page(R, name, '/face/api', { call: 'state', args: {} }).then(function (s) { state = s; return s.status === 200; }); }, 15000);
  if (!state || state.status !== 200) return {};
  const from = R.mailed.length;
  await page(R, name, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const mail = R.mailed[from];
  const token = mail && String(mail.text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return {};
  const done = await page(R, name, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : {};
}
// Refused: an answer that is no answer, whatever its code (box v29 names none).
const starRefused = function (a) { return a.status >= 400 && a.status < 500; };

// The star part's world, in S; its relays, node and marks are stopped and removed by test.after.
const S = { relays: [] };
// A RELAY LET GO ONCE ITS PART IS DONE: the lab holds two relays (lab/labNodes.js), and this file uses five in turn, so each
// part's relay is stopped, and freed to the lab, before the next part takes one; the cleanup then stops only those left.
function letGo(r) {
  if (!r) return;
  try { r.stop(); } catch (e) { /* gone */ }
  S.relays = S.relays.filter(function (x) { return x !== r; });
}
const NOBODY = 'MCowBQYDK2VwAyEA' + 'zzStarNobodyzzStarNobodyzzStarNobodyzzStarNob'.slice(0, 43) + '=';
const OWNER = { call: 'owner.command', args: { to: NOBODY, command: 'zzNothing' } };
const SAVED = 'spirit/app/zzStar/saved.txt';
const JOB = { call: 'job.create', args: { command: process.execPath, args: ['spirit/app/zzStar/zzStar.js', 'fromTheFace'] } };
const SAVE = { call: 'fs.save', args: { path: SAVED, content: 'from the face' } };
const face = function (req) { return page(S.R, 'harbour', '/face/call', req, S.L.sid); };
const starOf = async function (key) { const a = await home(S.N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === key; })); };
const faceName = async function (base) { const g = await home(S.N.base, 'relay.get', { key: base }); const r = g.body && g.body.relay; return r && r.face && typeof r.face === 'object' ? String(r.face.name || '') : String((r && r.face) || ''); };
const loggedIn = function () { return !!(S.L && S.L.sid); };
// The face on the first relay asked q, with no star or after it came off: refused.
function faceRefused(q) {
  return async function () {
    if (!loggedIn()) return false;
    const a = await face(q);
    return starRefused(a) || false;
  };
}

test.after(function () {
  try { if (S.q) S.q.destroy(); } catch (e) { /* gone */ }
  S.relays.forEach(function (r) { try { r.stop(); } catch (e) { /* gone */ } });
  try { if (S.N && S.N.child) S.N.child.kill(); } catch (e) { /* gone */ }
  try { if (S.N && S.N.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(S.N); } catch (e) { /* scratch */ }
  try { if (S.marks) fs.rmSync(S.marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// faceHome-star: the star on a real node, a real relay and a real face (goal/G41.30).
test.run('the node says its key', 0.2, async function () {
  S.marks = ownTemp('spirit-star-marks-');
  const N = S.N = await scratchNode();
  if (!N.up) return false;
  const run = S.run = path.join(N.root, 'spirit', 'run');
  const card = await home(N.base, 'node.card');
  S.me = card.body && card.body.publicKey;
  if (!S.me) return false;
  // An app this node runs (its json says node run true, goal/G43.20): it leaves a mark only when started with the word a
  // face call gives it. Not intrinsic, so a file of its folder may be saved.
  S.mark = path.join(S.marks, 'ran');
  const script = path.join(run, 'spirit/app/zzStar/zzStar.js');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, 'if (process.argv[2] === "fromTheFace") require("fs").writeFileSync(' + JSON.stringify(S.mark) + ', "ran");\n');
  fs.writeFileSync(path.join(run, 'spirit/app/zzStar/zzStar.json'), JSON.stringify({ identity: { label: 'zz', intrinsic: false }, node: { run: true } }));
  S.savedAt = path.join(run, SAVED);
  return true;
}, test.limit.slow);

// A RELAY OF SOMEBODY ELSE'S, A FACE THIS NODE ASKED FOR.
test.run('a real relay comes up', 0.2, async function () {
  const R = S.R = await scratchFaceRelay({ members: [] });
  S.relays.push(R);
  return R.up || false;
}, test.limit.slow);
test.run('the node joins it by its mail and sets a face', 0.2, async function () {
  if (!S.me || !S.R || !S.R.up) return false;
  return (await join(S.N, S.R) && await setFace(S.N, S.R, 'harbour')) || false;
}, test.limit.long);
test.run('the face logs in by the mailed token', 0.2, async function () {
  if (!S.me || !S.R || !S.R.up) return false;
  S.L = await logIn(S.R, 'harbour');
  return !!S.L.sid || false;
}, test.limit.quick);

// box v29: no star, no face: "The home node answers a face only from a starred relay". Not even the plainest read: there
// is no half face left to answer.
test.run('the relay has no star', 0.8, async function () {
  if (!S.me || !S.R) return false;
  return !(await starOf(S.R.relayKey)) || false;
}, test.limit.quick);
test.run('with no star, node.card from the face is refused', 0.8, faceRefused({ call: 'node.card', args: {} }), test.limit.quick);
test.run('with no star, fs.stat from the face is refused', 0.8, faceRefused({ call: 'fs.stat', args: { path: 'spirit/fs/data.js' } }), test.limit.quick);
test.run('with no star, contact.search from the face is refused', 0.8, faceRefused({ call: 'contact.search', args: { q: '' } }), test.limit.quick);
test.run('with no star, job.create from the face is refused', 0.8, faceRefused(JOB), test.limit.quick);
test.run('with no star, fs.save from the face is refused', 0.8, faceRefused(SAVE), test.limit.quick);
test.run('with no star, owner.command from the face is refused', 0.8, faceRefused(OWNER), test.limit.quick);
test.run('the job did not run', 0.8, async function () {
  if (!S.mark) return false;
  await sleep(WAIT_MS);
  return !fs.existsSync(S.mark) || false;
}, test.limit.slow);
test.run('the file was not written', 0.8, function () {
  if (!S.savedAt) return false;
  return !fs.existsSync(S.savedAt) || false;
}, test.limit.quick);

// The star on, pressed at home: everything is back.
test.run('contact.own at home puts the star on the relay\'s row', 0.2, async function () {
  if (!S.me || !S.R) return false;
  const on = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: true });
  return (on.status === 200 && (await starOf(S.R.relayKey))) || false;
}, test.limit.quick);
test.run('owner.command from the face reaches the door', 0.2, async function () {
  if (!loggedIn()) return false;
  const o1 = await face(OWNER);
  return (o1.status !== 0 && !/not-from-the-face|no-face-here/.test(o1.text)) || false;
}, test.limit.quick);
test.run('fs.save from the face writes the file', 0.2, async function () {
  if (!loggedIn()) return false;
  const s1 = await face(SAVE);
  return (s1.status >= 200 && s1.status < 300 && fs.existsSync(S.savedAt)) || false;
}, test.limit.quick);
test.run('job.create of an included process runs it', 0.2, async function () {
  if (!loggedIn()) return false;
  const j1 = await face(JOB);
  await until(function () { return fs.existsSync(S.mark); }, 5000);
  return (j1.status === 201 && fs.existsSync(S.mark)) || false;
}, test.limit.quick);
test.run('job.create of /bin/sh is still refused, starred or not', 0.8, async function () {
  if (!loggedIn()) return false;
  const shMark = path.join(S.marks, 'sh');
  const sh = await face({ call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'echo x > ' + shMark] } });
  await sleep(WAIT_MS);
  return (sh.status >= 400 && sh.status < 500 && !fs.existsSync(shMark)) || false;
}, test.limit.slow);
test.run('contact.own from the face is refused even here, and the star stays', 0.8, async function () {
  if (!loggedIn()) return false;
  const self = await face({ call: 'contact.own', args: { key: S.R.relayKey, own: false } });
  return (self.status >= 400 && self.status < 500 && (await starOf(S.R.relayKey))) || false;
}, test.limit.quick);

// box v29: "A star taken off a relay that has a face takes that face away (Q21)".
test.run('the node holds a face on the relay', 0.2, async function () {
  if (!S.me || !S.R) return false;
  fs.rmSync(S.savedAt, { force: true }); fs.rmSync(S.mark, { force: true });
  S.before = await faceName(S.R.base);
  return !!S.before || false;
}, test.limit.quick);
test.run('contact.own at home takes the star away', 0.2, async function () {
  if (!S.me || !S.R) return false;
  const off = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: false });
  return (off.status === 200 && !(await starOf(S.R.relayKey))) || false;
}, test.limit.quick);
test.run('the node holds no face on that relay any more', 0.8, async function () {
  if (!S.before) return false;
  return (await until(function () { return faceName(S.R.base).then(function (n) { return n === ''; }); }, 8000)) || false;
}, test.limit.quick);
test.run('with the star off, node.card through it is refused', 0.8, faceRefused({ call: 'node.card', args: {} }), test.limit.quick);
test.run('with the star off, job.create through it is refused', 0.8, faceRefused(JOB), test.limit.quick);
test.run('with the star off, fs.save through it is refused', 0.8, faceRefused(SAVE), test.limit.quick);
test.run('with the star off, owner.command through it is refused', 0.8, faceRefused(OWNER), test.limit.quick);
test.run('nothing ran and nothing was written', 0.8, async function () {
  if (!S.mark) return false;
  await sleep(WAIT_MS);
  return (!fs.existsSync(S.mark) && !fs.existsSync(S.savedAt)) || false;
}, test.limit.slow);
test.run('the star put back opens nothing, because the face is gone, not hidden', 0.8, async function () {
  if (!loggedIn()) return false;
  await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: true });
  const back = await face({ call: 'node.card', args: {} });
  return starRefused(back) || false;
}, test.limit.quick);

// GOAL/G41.33, ON THE REAL STREAM. "anything andy gets on his loopback screen, he can get on his face, if he "stars" any
// relay"; "NO RESTRICTIONS AT ALL, except changing stars"; "Pressing the star sends no catch-up". Without the star the face
// gets nothing (box v29, above). What a page reads from /face/stream, with its cookie, unsealed as a page that cannot seal.
// The real stream: without the star it carries nothing; with it, a job, a bundle and the join steps.
const hears = function (word) { return S.got.some(function (l) { return l.indexOf(word) !== -1; }); };
const heardEvent = function (kind, id) { return S.got.some(function (l) { const v = parsed(l); return !!v && v.event === kind && (kind === 'job-deleted' ? v.data === id : !!v.data && v.data.id === id); }); };
const streamUp = function () { return !!(S.LS && S.LS.sid && S.got); };
// One failed job, to delete: a process that ends with an exit code of its own stays until it is deleted.
const runOne = async function () {
  const c = await home(S.N.base, 'job.create', { command: process.execPath, args: ['spirit/app/zzStream/zzStream.js'] });
  const id = c.body && c.body.id;
  if (!id) return {};
  await until(function () { return home(S.N.base, 'job.get', { key: id }).then(function (a) { const j = a.body && a.body.job; return !!j && j.status === 'failed'; }); }, 8000);
  const d = await home(S.N.base, 'job.delete', { id: id });
  return d.status < 300 ? { id: id } : {};
};
const bundle = function (label) { return home(S.N.base, 'auth.bundle', { op: 'add', label: label, text: 'zz' }); };
const sface = function (req) { return page(S.S, 'stream', '/face/call', req, S.LS.sid); };

test.run('a relay for the stream is joined and a face is set on it', 0.2, async function () {
  if (!S.me) return false;
  const St = S.S = await scratchFaceRelay({ members: [] });
  S.relays.push(St);
  S.ok4 = !!St.up && await join(S.N, St) && await setFace(S.N, St, 'stream');
  return S.ok4 || false;
}, test.limit.long);
test.run('the face logs in', 0.2, async function () {
  if (!S.S || S.ok4 !== true) return false;
  S.LS = await logIn(S.S, 'stream');
  return !!S.LS.sid || false;
}, test.limit.quick);
test.run('with no star, the stream carries nothing of the node, not even its file tree', 0.8, async function () {
  if (!S.LS || !S.LS.sid) return false;
  S.got = [];
  let heldStream = '';
  S.q = http.request({ host: '127.0.0.1', port: S.S.port, path: '/face/stream', method: 'GET', headers: { Host: 'stream.relay.example', Cookie: 'spirit_face=' + S.LS.sid } }, function (r) {
    r.setEncoding('utf8');
    r.on('data', function (d) { heldStream += d; const parts = heldStream.split('\n'); heldStream = parts.pop(); parts.filter(Boolean).forEach(function (l) { S.got.push(l); }); });
  });
  S.q.on('error', function () { /* the stream ends with the relay */ });
  S.q.end();
  await sleep(3000);
  // Box v29: no star, the node answers the face nothing, so no file tree, no presence, no job.
  return (!hears('spirit.fs') && !hears('presence')) || false;
}, test.limit.slow);
test.run('with no star, a job runs and is deleted at home', 0.2, async function () {
  if (!streamUp()) return false;
  const script2 = path.join(S.run, 'spirit/app/zzStream/zzStream.js');
  fs.mkdirSync(path.dirname(script2), { recursive: true });
  fs.writeFileSync(script2, 'setTimeout(function () { process.exit(4); }, 300);\n');
  fs.writeFileSync(path.join(S.run, 'spirit/app/zzStream/zzStream.json'), JSON.stringify({ identity: { label: 'zz', intrinsic: false }, node: { run: true } }));
  S.j0 = await runOne();
  return !!S.j0.id || false;
}, test.limit.quick);
test.run('with no star, a bundle is added at home', 0.2, async function () {
  if (!streamUp()) return false;
  const b0 = await bundle('zzBefore');
  return b0.status < 300 || false;
}, test.limit.quick);
test.run('with no star, the job never reaches the face', 0.8, async function () {
  if (!streamUp() || !S.j0) return false;
  await sleep(WAIT_MS);
  return (!!S.j0.id && !hears(S.j0.id)) || false;
}, test.limit.slow);
test.run('with no star, the bundle never reaches the face', 0.8, function () {
  if (!streamUp()) return false;
  return !hears('zzBefore') || false;
}, test.limit.quick);
test.run('the star is put on at home while the stream is still open', 0.2, async function () {
  if (!streamUp()) return false;
  const sOn = await home(S.N.base, 'contact.own', { key: S.S.relayKey, own: true });
  return sOn.status === 200 || false;
}, test.limit.quick);
test.run('the star sends no catch-up, so what went before it does not come', 0.8, async function () {
  if (!streamUp() || !S.j0) return false;
  await sleep(WAIT_MS);
  return (!!S.j0.id && !hears(S.j0.id) && !hears('zzBefore')) || false;
}, test.limit.slow);
test.run('when starred, a job runs and is deleted at home', 0.2, async function () {
  if (!streamUp()) return false;
  S.j1b = await runOne();
  return !!S.j1b.id || false;
}, test.limit.quick);
test.run('when starred, the running job reaches the face', 0.2, async function () {
  if (!streamUp() || !S.j1b) return false;
  await until(function () { return heardEvent('job-deleted', S.j1b.id); }, 5000);
  return (!!S.j1b.id && heardEvent('job-updated', S.j1b.id)) || false;
}, test.limit.quick);
test.run('when starred, the deleted job reaches the face', 0.2, function () {
  if (!streamUp() || !S.j1b) return false;
  return (!!S.j1b.id && heardEvent('job-deleted', S.j1b.id)) || false;
}, test.limit.quick);
test.run('when starred, the bundle reaches the face', 0.2, async function () {
  if (!streamUp()) return false;
  const b1 = await bundle('zzAfter');
  await until(function () { return hears('zzAfter'); }, 5000);
  return (b1.status < 300 && hears('zzAfter')) || false;
}, test.limit.quick);
// The join steps are published only when their facts change (joinStepsJob.js): this node's first contact, here a key
// it blocks, makes "contact" true.
test.run('when starred, a first contact appears at home', 0.2, async function () {
  if (!streamUp()) return false;
  const someone = auth.generateIdentity('zz').publicKey;
  const blocked = await home(S.N.base, 'contact.block', { publicKey: someone });
  return blocked.status < 300 || false;
}, test.limit.quick);
test.run('when starred, the join steps reach the face as the join news of the spirit job', 0.2, async function () {
  if (!streamUp()) return false;
  await until(function () { return hears('"join":'); }, 5000);
  return hears('"join":') || false;
}, test.limit.quick);

// A starred face has no restrictions, except changing stars.
test.run('the first relay\'s star is taken off again', 0.2, async function () {
  if (!streamUp() || !S.R) return false;
  const rOff = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: false });
  return rOff.status === 200 || false;
}, test.limit.quick);
test.run('starring another relay from it is refused, and no star lands', 0.8, async function () {
  if (!streamUp() || !S.R) return false;
  const anotherStar2 = await sface({ call: 'contact.own', args: { key: S.R.relayKey, own: true } });
  return (starRefused(anotherStar2) && !(await starOf(S.R.relayKey))) || false;
}, test.limit.quick);
test.run('taking its own star off from it is refused, and the star stays', 0.8, async function () {
  if (!streamUp()) return false;
  const ownOff = await sface({ call: 'contact.own', args: { key: S.S.relayKey, own: false } });
  return (starRefused(ownOff) && (await starOf(S.S.relayKey))) || false;
}, test.limit.quick);
// Last, since it takes the page's address away: the face you call through, renamed through it, on a star.
test.run('when starred, relay.face on the relay it is called through is not refused by the face\'s rule', 0.2, async function () {
  if (!streamUp()) return false;
  const renamed = await sface({ call: 'relay.face', args: { url: S.S.base, name: 'renamed' } });
  return (!/not-from-the-face/.test(renamed.text) && renamed.status < 400) || false;
}, test.limit.quick);
test.run('the face has its new name on the relay', 0.2, async function () {
  if (!streamUp()) return false;
  const moved = await until(function () { return page(S.S, 'renamed', '/face/api', { call: 'state', args: {} }).then(function (a) { return a.status === 200; }); }, 8000);
  return !!moved || false;
}, test.limit.quick);
// The star off with the stream open: the face goes, so the next event stays home.
test.run('the star is taken off at home while the stream is open', 0.2, async function () {
  if (!streamUp()) return false;
  const sOff = await home(S.N.base, 'contact.own', { key: S.S.relayKey, own: false });
  return sOff.status === 200 || false;
}, test.limit.quick);
// A job's id is its route, the same for every run (goal/G43.20): only what the stream says from here on is judged.
test.run('with the star off, the next job stays home', 0.8, async function () {
  if (!streamUp()) return false;
  const sinceOff = S.got.length;
  const j2b = await runOne();
  await sleep(WAIT_MS);
  return (!!j2b.id && !S.got.slice(sinceOff).some(function (l) { return l.indexOf(j2b.id) !== -1; })) || false;
}, test.limit.slow);
test.run('on the real stream, the node holds no face on that relay any more', 0.8, async function () {
  if (!streamUp()) return false;
  const gone = await until(function () { return faceName(S.S.base).then(function (n) { return n === ''; }); }, 8000);
  try { S.q.destroy(); } catch (e) { /* gone */ }
  return gone || false;
}, test.limit.quick);

// A RELAY THAT SAYS THIS NODE OWNS IT: a relay's claim changes nothing: it says this node owns it, and no star is pressed.
// The face is set first, as a member, then the owner mark goes in: relay.face on a relay that already owns this node
// answers no text today, so the node cannot read it (a fault of its own, reported, not this rule's).
test.run('a relay whose owner mark is this node\'s key is joined and a face is set on it', 0.2, async function () {
  if (!S.me) return false;
  letGo(S.R); letGo(S.S);
  const O = S.O = await scratchFaceRelay({ members: [] });
  S.relays.push(O);
  let ok2 = !!O.up && await join(S.N, O) && await setFace(S.N, O, 'mine');
  if (ok2 && !(await O.becomeOwned(S.me))) ok2 = false;
  S.ok2 = ok2;
  return ok2 || false;
}, test.limit.long);
test.run('the relay has sent this node its owner\'s report', 0.2, async function () {
  if (!S.O || S.ok2 !== true) return false;
  let report = null;
  await until(function () { return home(S.N.base, 'relay.get', { key: S.O.base }).then(function (a) { report = a.body && a.body.report; return !!(report && Object.keys(report).length); }); }, 20000);
  S.report = !!(report && Object.keys(report).length);
  return S.report || false;
}, test.limit.slow);
test.run('its report sets no star', 0.8, async function () {
  if (!S.O || S.ok2 !== true) return false;
  return !(await starOf(S.O.relayKey)) || false;
}, test.limit.quick);
test.run('the face logs in there', 0.2, async function () {
  if (!S.O || S.ok2 !== true) return false;
  S.L2 = await logIn(S.O, 'mine');
  return !!S.L2.sid || false;
}, test.limit.quick);
test.run('owner.command from that face is refused, because the relay\'s word opens nothing', 0.8, async function () {
  if (!S.L2 || !S.L2.sid) return false;
  const a = await page(S.O, 'mine', '/face/call', OWNER, S.L2.sid);
  return starRefused(a) || false;
}, test.limit.quick);

// A RELAY WHERE THIS NODE SET NO FACE gets nothing, whatever it does.
test.run('a third relay is joined and no face is asked for', 0.2, async function () {
  if (!S.me) return false;
  letGo(S.O);
  const D = S.D = await scratchFaceRelay({ members: [] });
  S.relays.push(D);
  S.ok3 = !!D.up && await join(S.N, D);
  return S.ok3 || false;
}, test.limit.slow);
test.run('the relay has made a face this node never asked for, and logged in to it', 0.2, async function () {
  if (!S.D || S.ok3 !== true) return false;
  // The dishonest relay: it gives the member a face on its own, so it can send this node face events.
  S.D.setFace(S.me, 'forged', MAIL);
  await sleep(300);
  S.L3 = await logIn(S.D, 'forged');
  return !!S.L3.sid || false;
}, test.limit.slow);
function forgedRefused(q) {
  return async function () {
    if (!S.L3 || !S.L3.sid) return false;
    const a = await page(S.D, 'forged', '/face/call', q, S.L3.sid);
    return (a.status === 403 && !!a.body && a.body.code === 'no-face-here') || false;
  };
}
test.run('node.card through it is refused with no-face-here', 0.8, forgedRefused({ call: 'node.card', args: {} }), test.limit.quick);
test.run('job.create through it is refused with no-face-here', 0.8, forgedRefused(JOB), test.limit.quick);
test.run('a star does not open it, because with no face of mine nothing opens', 0.8, async function () {
  if (!S.L3 || !S.L3.sid) return false;
  const on3 = await home(S.N.base, 'contact.own', { key: S.D.relayKey, own: true });
  const a3 = await page(S.D, 'forged', '/face/call', JOB, S.L3.sid);
  return (on3.status === 200 && a3.status === 403 && !!a3.body && a3.body.code === 'no-face-here') || false;
}, test.limit.quick);
test.run('no job ran through any of this', 0.8, async function () {
  if (!S.mark) return false;
  await sleep(WAIT_MS);
  return !fs.existsSync(S.mark) || false;
}, test.limit.slow);

// ── THE STARAPPS PART, once faceHome-starApps.js ────────────────────────────────────────────────────────────────────────
// A STAR SHOWS EVERY APP (goal/G41.33, Q9; spec: ./faceHome.md; Andy, of "Should a star show every app on the face, Text Editor and Media Viewer
// too, or does each app's face mark stay yours to set?": "yes. for now."). What the owner sees is the desktop, so a real
// Chrome reads it: a real scratch node, a real relay, a real face and its login, at home and on the face. What a face is
// handed, by its relay's star, is spirit/faceHome.js's, so it is judged beside it (goal/G43.28; Andy: "you WILL FUCKING PLACE
// TESTS WHERE THEY FUCKING BELONG"; moved from shell/test/navigationWrapper-faceStarApps.js, its relay row section beside
// the contact row, spirit/element/search/contact/test/rowElement.js, its relayOnFace part). A face at
// <name>.localhost is a secure context, as a face over https is. A step that could not run is red, never skipped.

const DOMAIN = 'localhost';
const NAME = 'apps';
const DRAWN_MS = 6000;
function appsPage(relay, p, body) {
  return new Promise(function (resolve) {
    const b = JSON.stringify(body);
    const host = NAME + '.' + DOMAIN + ':' + relay.port;
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: 'POST', headers: { Host: host, Origin: 'http://' + host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { resolve({ status: r.statusCode, text: text, cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function () { resolve({ status: 0, text: '' }); });
    q.end(b);
  });
}
// A real join, a real face, a real login; answers the session, or none.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return {};
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return {};
  await until(function () { return appsPage(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await appsPage(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return {};
  const done = await appsPage(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : {};
}
// The names on a desktop, as it reads: icon and name line by line, the name lines only.
async function desktop(chrome, url) {
  await chrome.send('Page.navigate', { url: url });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.event)'); }, 20000);
  await sleep(DRAWN_MS);
  const text = String(await chrome.evaluate('document.body.innerText'));
  return text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); });
}
// The first tile is the home's own, and is named apart on each ("Spirit" at home, "Your home node" on a face).
const OWN = ['Spirit', 'Your home node'];
const missing = function (want, have) { return want.filter(function (n) { return OWN.indexOf(n) === -1 && have.indexOf(n) === -1; }); };
const namesNow = async function () { return String(await A.chrome.evaluate('document.body.innerText')).split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); }); };

// The starApps part's world, in A; its Chrome, relay and node are stopped by test.after.
const A = {};
const browsing = function () { return !!(A.chrome && A.FACE && A.F && A.F.sid); };
test.after(function () {
  const chrome = A.chrome;
  try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (A.R) A.R.stop(); } catch (e) { /* gone */ }
  try { if (A.N && A.N.child) A.N.child.kill(); } catch (e) { /* gone */ }
  try { if (A.N && A.N.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(A.N); } catch (e) { /* scratch */ }
});

// faceHome-starApps: a star shows every app on the face (goal/G41.33, Q9).
test.run('a real node has a real face, logged in', 0.2, async function () {
  letGo(S.D);
  A.N = await scratchNode();
  A.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!A.N.up || !A.R.up) return false;
  // TEXT EDITOR AND MEDIA VIEWER SWITCHED ON AT HOME, as an owner would: since goal/G43.17 they are apps of their own, not
  // intrinsic, so a fresh node shows them only once they are active.
  const on = async function (key) {
    const r = await fetch(A.N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: key, active: true } }) }).then(function (x) { return x.status; }, function () { return 0; });
    return r === 200;
  };
  if (!(await on('text')) || !(await on('media'))) return false;
  A.F = await faceOf(A.N, A.R);
  return !!A.F.sid || false;
}, test.limit.long);
test.run('the browser holds the login', 0.2, async function () {
  if (!A.F || !A.F.sid) return false;
  const where = findChrome();
  if (!where) return false;
  const chrome = await chromePage(where);
  if (chrome.error) return false;
  A.chrome = chrome;
  A.FACE = 'http://' + NAME + '.' + DOMAIN + ':' + A.R.port + '/';
  const set = await chrome.send('Network.setCookie', { name: 'spirit_face', value: A.F.sid, url: A.FACE, path: '/' });
  return !!(set.result && set.result.success) || false;
}, test.limit.quick);
test.run('at home the desktop shows Text Editor and Media Viewer', 0.2, async function () {
  if (!browsing()) return false;
  A.atHome = await desktop(A.chrome, A.N.base + '/');
  return (A.atHome.indexOf('Text Editor') !== -1 && A.atHome.indexOf('Media Viewer') !== -1) || false;
}, test.limit.slow);

// NO STAR, NOTHING (goal/G43.18, box v29: "A face is whole, or there is none"; Andy, Q18, of rewriting these tests so a
// starless face shows nothing: "yes"): the relay refuses a face with no star its link home, so its page draws no app
// of the home desktop at all.
function noApp(names) { return !!names && A.atHome && A.atHome.length > 0 && !A.atHome.some(function (n) { return OWN.indexOf(n) === -1 && names.indexOf(n) !== -1; }); }
test.run('with no star, the face draws none of the apps of the home desktop', 0.8, async function () {
  if (!browsing()) return false;
  A.plain = await desktop(A.chrome, A.FACE);
  return noApp(A.plain) || false;
}, test.limit.slow);

// The star: every app the home desktop shows.
test.run('the star is put on at home to check every app', 0.2, async function () {
  if (!browsing()) return false;
  const on = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: true });
  return on.status === 200 || false;
}, test.limit.quick);
test.run('every app on the home desktop is on the starred face', 0.2, async function () {
  if (!browsing() || !A.atHome) return false;
  A.starred = await desktop(A.chrome, A.FACE);
  const gap = missing(A.atHome, A.starred);
  return (A.starred.length > 0 && !gap.length) || false;
}, test.limit.slow);

// An app it shows opens.
test.run('the tile of an app it shows is there to press', 0.2, async function () {
  if (!browsing()) return false;
  A.pageErrors = A.chrome.heard.length;
  A.opened = await A.chrome.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")); var hit = all.filter(function (e) { return e.children.length === 0 && e.textContent.trim() === "Text Editor"; })[0]; if (!hit) return false; hit.click(); return true; }())');
  return A.opened === true || false;
}, test.limit.quick);
test.run('pressing that tile throws nothing in the page', 0.2, async function () {
  if (!browsing()) return false;
  await sleep(DRAWN_MS / 2);
  const threw = A.chrome.heard.slice(A.pageErrors || 0).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
  return (A.opened === true && !threw.length) || false;
}, test.limit.slow);

// The star off: nothing again.
test.run('the star is taken off at home', 0.2, async function () {
  if (!browsing()) return false;
  const off = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: false });
  return off.status === 200 || false;
}, test.limit.quick);
test.run('with the star off again, the face draws none of the apps of the home desktop', 0.8, async function () {
  if (!browsing()) return false;
  return noApp(await desktop(A.chrome, A.FACE)) || false;
}, test.limit.slow);
