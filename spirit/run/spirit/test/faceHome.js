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
const os = require('os');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const seal = require(path.join(RUN, 'spirit', 'seal.js'));
const { createFaceHome } = require(path.join(RUN, 'spirit', 'faceHome.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
const settle = async function () { for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); }); };

// What the tests made, for the tests after them.
const W = {};
// A thing of W, made the first time a test needs it, so a throw lands on that test.
function lazy(k, make) { if (!W[k]) W[k] = make(); return W[k]; }
const MISSING = 'nothing to judge: the test before it failed';

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
const said = function (a) { return 'door got ' + short(a.reached) + ', answered ' + a.status + ' ' + short(a.body) + (a.thrown ? ', threw ' + a.thrown.message : ''); };

const CARD = { call: 'node.card', args: {} };
const SHELL = { call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'id'] } };

// A request sent to a stand-in world, its answer kept under key; then that the answer never reached the door.
function sentAndHeld(key, worldKey, makeWorld, url, makeReq, label) {
  return async function () {
    const w = lazy(worldKey, makeWorld);
    const a = W[key] = await send(w, url, makeReq());
    return !a.reached.length || (label + ': ' + said(a));
  };
}
// The answer kept under key was a refusal with a code.
function wasRefused(key, label) {
  return function () { const a = W[key]; if (!a) return MISSING; return refused(a) || (label + ': ' + said(a)); };
}
// A request sent to a stand-in world: refused, and it never reached the door.
function sentAndRefused(worldKey, makeWorld, url, makeReq, label) {
  return async function () {
    const w = lazy(worldKey, makeWorld);
    const a = await send(w, url, makeReq());
    return (!a.reached.length && refused(a)) || (label + ': ' + said(a));
  };
}

// ── ITS OWN CHECKS ──────────────────────────────────────────────────────────────────────────────────────────────────────

// A relay where this node set no face gets nothing. The review: "the node never checks that it set a face on that relay,
// that a face is open, or who asked."; its fix: "accept face* events only from a relay where this node set a face".
const noFaceWorld = function () { return world(onlyMine); };
test.run('from a relay with no face of mine, an allowed verb never reaches the door', 0.8, sentAndHeld('o1', 'w', noFaceWorld, OTHER, function () { return CARD; }, 'from a relay with no face of mine, an allowed verb'), test.limit.quick);
test.run('from a relay with no face of mine, an allowed verb is answered a refusal with a code', 0.8, wasRefused('o1', 'an allowed verb from a relay with no face of mine was not refused with a code'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell never reaches the door', 0.8, sentAndHeld('o2', 'w', noFaceWorld, OTHER, function () { return SHELL; }, 'from a relay with no face of mine, job.create with a shell'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell is answered a refusal with a code', 0.8, wasRefused('o2', 'job.create with a shell from a relay with no face of mine was not refused with a code'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell, sealed never reaches the door', 0.8, sentAndHeld('o3', 'w', noFaceWorld, OTHER, function () { return sealed(SHELL); }, 'from a relay with no face of mine, the same, sealed'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell, sealed is answered a refusal with a code', 0.8, wasRefused('o3', 'the same, sealed from a relay with no face of mine was not refused with a code'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell, in pieces never reaches the door', 0.8, sentAndHeld('o4', 'w', noFaceWorld, OTHER, function () { return pieced(SHELL); }, 'from a relay with no face of mine, the same, in pieces'), test.limit.quick);
test.run('from a relay with no face of mine, job.create with a shell, in pieces is answered a refusal with a code', 0.8, wasRefused('o4', 'the same, in pieces from a relay with no face of mine was not refused with a code'), test.limit.quick);
test.run('a file asked by it is not served, and refused', 0.8, async function () {
  const w = lazy('w', noFaceWorld);
  const file = await send(w, OTHER, { get: 'face.html' });
  return (!w.files.length && refused(file)) || ('a file was served to a relay with no face of mine: files ' + short(w.files) + ', ' + said(file));
}, test.limit.quick);
test.run('the keys asked by it are refused', 0.8, async function () {
  const keys = await send(lazy('w', noFaceWorld), OTHER, { keys: 1 });
  return refused(keys) || ('the keys were answered to a relay with no face of mine: ' + said(keys));
}, test.limit.quick);
test.run('face-open from it starts no stream of this node\'s events', 0.8, function () {
  const w = lazy('w', noFaceWorld);
  let opened = null;
  try { w.home.open(OTHER, ''); opened = !!w.uploads['/api/relay/face/stream']; } catch (e) { opened = 'threw ' + e.message; }
  try { w.home.close(OTHER); } catch (e) { /* its own check is this one */ }
  return opened === false || ('face-open from a relay with no face of mine: stream started ' + opened);
}, test.limit.quick);

// With no faceSet given at all, it refuses: closed, not open.
test.run('a face home told of no face takes no call', 0.8, async function () {
  const none = await send(world(null), MINE, CARD);
  return (!none.reached.length && refused(none)) || ('with no faceSet, a call: ' + said(none));
}, test.limit.quick);

// Box v29: "The home node answers a face only from a starred relay, one check; a face it answers is a full face." The relay
// where this node set a face, and starred, works as before.
const starredWorld = function () { return world(onlyMine, onlyMine); };
test.run('node.card reaches the door', 0.2, async function () {
  const card = await send(lazy('m', starredWorld), MINE, CARD);
  return (card.reached.indexOf('node.card') !== -1 && card.status === 200) || ('node.card from my face\'s relay: ' + said(card));
}, test.limit.quick);
test.run('sealed too', 0.2, async function () {
  const cardSealed = await send(lazy('m', starredWorld), MINE, sealed(CARD));
  return (cardSealed.reached.indexOf('node.card') !== -1 && cardSealed.status === 200) || ('sealed node.card from my face\'s relay: ' + said(cardSealed));
}, test.limit.quick);
test.run('a file it asks is served (the face loads its parts so)', 0.2, async function () {
  const m = lazy('m', starredWorld);
  const f = await send(m, MINE, { get: 'face.html' });
  return (m.files.indexOf('face.html') !== -1 && f.status === 200) || ('a file from my face\'s relay: files ' + short(m.files) + ', ' + said(f));
}, test.limit.quick);
test.run('the keys are answered', 0.2, async function () {
  const k = await send(lazy('m', starredWorld), MINE, { keys: 1 });
  return (k.status === 200 && !!k.body && k.body.publicKey === ME.publicKey) || ('keys from my face\'s relay: ' + said(k));
}, test.limit.quick);
test.run('face-open starts the stream', 0.2, function () {
  const m = lazy('m', starredWorld);
  let streaming = false;
  try { m.home.open(MINE, ''); streaming = !!m.uploads['/api/relay/face/stream']; } catch (e) { streaming = false; }
  try { m.home.close(MINE); } catch (e) { /* the stream is the stand-in's */ }
  return streaming || 'face-open from my face\'s relay started no stream';
}, test.limit.quick);

// Every verb the families declare, from their own declarations.
const allFamilies = function () {
  const dirs = function (d) { return fs.readdirSync(path.join(RUN, d), { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }); };
  return dirs('spirit').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); })
    .concat(dirs('spirit/app').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', 'app', n, 'api.js')) && !fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); }));
};
const verbsOf = function (file) { return Object.keys(require(path.join(RUN, file)).verbs); };

// GOAL/G43.18, BOX V29, "A face is whole, or there is none" (Andy: "we remove ALL the star shit, like this,", "on the home
// node, NO face is offered (faceForm hides itself) for a relay without star."): the half face of G41.30 and G41.33 is gone.
// A relay with my face and no star gets nothing at all.
const plainWorld = function () { return world(onlyMine, never); };
test.run('no star: node.card is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return CARD; }, 'no star: node.card'), test.limit.quick);
test.run('no star: node.card, sealed is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return sealed(CARD); }, 'no star: node.card, sealed'), test.limit.quick);
test.run('no star: fs.stat is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { call: 'fs.stat', args: { path: 'x' } }; }, 'no star: fs.stat'), test.limit.quick);
test.run('no star: owner.command is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { call: 'owner.command', args: { key: 'x' } }; }, 'no star: owner.command'), test.limit.quick);
test.run('no star: job.create with a shell is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return SHELL; }, 'no star: job.create with a shell'), test.limit.quick);
test.run('no star: job.create with a shell, in pieces is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return pieced(SHELL); }, 'no star: the same, in pieces'), test.limit.quick);
test.run('no star: a file is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { get: 'face.html' }; }, 'no star: a file'), test.limit.quick);
test.run('no star: the keys is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { keys: 1 }; }, 'no star: the keys'), test.limit.quick);
test.run('no star: a save in parts is refused and never reaches the door', 0.8, sentAndRefused('plain', plainWorld, MINE, function () { return { upload: { id: 'abcdefgh', n: 0, of: 1, size: 1, path: 'x.txt', bytes: 'eA==' } }; }, 'no star: a save in parts'), test.limit.quick);
test.run('no star: no file served and none written', 0.8, function () {
  const plain = W.plain;
  if (!plain) return MISSING;
  return (!plain.files.length && !plain.saved.length) || ('no star: files ' + short(plain.files) + ', saved ' + short(plain.saved));
}, test.limit.quick);

// Starring takes the node's own word, and a face there.
test.run('only true is a star: a truthy answer opens nothing', 0.8, sentAndRefused('loose', function () { return world(onlyMine, function () { return 'yes'; }); }, MINE, function () { return CARD; }, 'faceOwned answering "yes"'), test.limit.quick);
test.run('a starred relay where this node set no face gets nothing', 0.8, sentAndRefused('noFace', function () { return world(never, function () { return true; }); }, MINE, function () { return CARD; }, 'starred, no face'), test.limit.quick);

// THE STAR IS SET AT HOME (Andy: "so this button will put the star on relays and puppets. AND take it away."; every
// contact's panel has it "at home"). From a face, even on a relay this node owns, it would let whoever is in on one
// face hand the machine to another relay. contact.own never comes through a face.
const OWN_CALL = { call: 'contact.own', args: { key: 'K', own: true } };
test.run('contact.own on a relay this node owns, unsealed: refused with a code, and it never reaches the door', 0.8, sentAndRefused('ownMine', starredWorld, MINE, function () { return OWN_CALL; }, 'contact.own on a relay this node owns, unsealed'), test.limit.quick);
test.run('contact.own on a relay this node owns, sealed: refused with a code, and it never reaches the door', 0.8, sentAndRefused('ownMine', starredWorld, MINE, function () { return sealed(OWN_CALL); }, 'contact.own on a relay this node owns, sealed'), test.limit.quick);
test.run('contact.own on a relay it does not own, unsealed: refused with a code, and it never reaches the door', 0.8, sentAndRefused('ownNot', plainWorld, MINE, function () { return OWN_CALL; }, 'contact.own on a relay it does not own, unsealed'), test.limit.quick);
test.run('contact.own on a relay it does not own, sealed: refused with a code, and it never reaches the door', 0.8, sentAndRefused('ownNot', plainWorld, MINE, function () { return sealed(OWN_CALL); }, 'contact.own on a relay it does not own, sealed'), test.limit.quick);

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
    const sx = W.sx; if (!sx) return MISSING;
    const c = jobEvents[i];
    sx.emit(c[1], c[2]);
    const on = sx.got(STARRED, c[1], c[2]);
    return on === 1 || ('starred: ' + c[0] + ' arrived ' + on + ' times, as ' + c[1] + ' ' + short(c[2]));
  };
}
// The i-th event, emitted above: it never reached the face with no star.
function staysHome(i) {
  return function () {
    const sx = W.sx; if (!sx) return MISSING;
    const c = jobEvents[i];
    return sx.got(PLAIN, c[1], c[2]) === 0 || ('no star: ' + c[0] + ' reached a face with no star');
  };
}

// A starred face hears what the loopback hears, each once, and a face with no star hears nothing (box v29).
test.run('both faces have their stream open', 0.2, async function () {
  const sx = W.sx = streams(starAt);
  sx.home.open(STARRED, '');
  sx.home.open(PLAIN, '');
  await settle();
  return (!!sx.ups[STARRED] && !!sx.ups[PLAIN]) || 'a stream did not open: nothing judged';
}, test.limit.quick);
test.run('the home side subscribes to the node\'s events', 0.2, function () { if (!W.sx) return MISSING; return W.sx.subs.length > 0 || 'no subscriber: nothing judged'; }, test.limit.quick);
test.run('starred: a bundle arrives whole, once', 0.2, arrivesOnce(0), test.limit.quick);
test.run('starred: a branch arrives whole, once', 0.2, arrivesOnce(1), test.limit.quick);
test.run('starred: a grant arrives whole, once', 0.2, arrivesOnce(2), test.limit.quick);
test.run('starred: a job deleted arrives whole, once', 0.2, arrivesOnce(3), test.limit.quick);
test.run('starred: a running job of a process arrives whole, once', 0.2, arrivesOnce(4), test.limit.quick);
test.run('starred: a running job of no module arrives whole, once', 0.2, arrivesOnce(5), test.limit.quick);
test.run('starred: a job of an id nobody has listed arrives whole, once', 0.2, arrivesOnce(6), test.limit.quick);
test.run('starred: a server\'s job as a whole arrives whole, once', 0.2, arrivesOnce(7), test.limit.quick);
test.run('starred: the join steps arrives whole, once', 0.2, arrivesOnce(8), test.limit.quick);
test.run('starred: a relay event of the monitor, a post arrives whole, once', 0.2, arrivesOnce(9), test.limit.quick);
test.run('starred: a relay event of the monitor, a reply arrives whole, once', 0.2, arrivesOnce(10), test.limit.quick);
test.run('starred: a relay event of the monitor, a refusal arrives whole, once', 0.2, arrivesOnce(11), test.limit.quick);
test.run('starred: a relay\'s status arrives whole, once', 0.2, arrivesOnce(12), test.limit.quick);
test.run('no star: a bundle stays home', 0.8, staysHome(0), test.limit.quick);
test.run('no star: a branch stays home', 0.8, staysHome(1), test.limit.quick);
test.run('no star: a grant stays home', 0.8, staysHome(2), test.limit.quick);
test.run('no star: a job deleted stays home', 0.8, staysHome(3), test.limit.quick);
test.run('no star: a running job of a process stays home', 0.8, staysHome(4), test.limit.quick);
test.run('no star: a running job of no module stays home', 0.8, staysHome(5), test.limit.quick);
test.run('no star: a job of an id nobody has listed stays home', 0.8, staysHome(6), test.limit.quick);
test.run('no star: a server\'s job as a whole stays home', 0.8, staysHome(7), test.limit.quick);
test.run('no star: the join steps stays home', 0.8, staysHome(8), test.limit.quick);
test.run('no star: a relay event of the monitor, a post stays home', 0.8, staysHome(9), test.limit.quick);
test.run('no star: a relay event of the monitor, a reply stays home', 0.8, staysHome(10), test.limit.quick);
test.run('no star: a relay event of the monitor, a refusal stays home', 0.8, staysHome(11), test.limit.quick);
test.run('no star: a relay\'s status stays home', 0.8, staysHome(12), test.limit.quick);

// Box v29: a face with no star gets nothing, not even the file tree. Each event is emitted by its no-star check, and the
// starred check after it reads the same lines.
const today = [['the file tree', 'job-updated', { id: 'spirit.fs', kind: 'permanent', status: 'running', data: { command: { op: 'zz' } } }],
  ['a row of the one table', 'job-updated', { id: 'spirit.contact', kind: 'permanent', status: 'running', data: { row: 1 } }],
  ['a contact renamed', 'contact.rename', { key: 'K', name: 'zz' }]];
function todayStaysHome(i) {
  return function () {
    const sx = W.sx; if (!sx) return MISSING;
    const c = today[i];
    sx.emit(c[1], c[2]);
    return sx.got(PLAIN, c[1], c[2]) === 0 || ('no star: ' + c[0] + ' arrived ' + sx.got(PLAIN, c[1], c[2]) + ' times');
  };
}
function todayArrives(i) {
  return function () {
    const sx = W.sx; if (!sx) return MISSING;
    const c = today[i];
    return sx.got(STARRED, c[1], c[2]) === 1 || ('starred: ' + c[0] + ' arrived ' + sx.got(STARRED, c[1], c[2]) + ' times');
  };
}
test.run('no star: the file tree stays home', 0.8, todayStaysHome(0), test.limit.quick);
test.run('starred: the file tree arrives, once', 0.2, todayArrives(0), test.limit.quick);
test.run('no star: a row of the one table stays home', 0.8, todayStaysHome(1), test.limit.quick);
test.run('starred: a row of the one table arrives, once', 0.2, todayArrives(1), test.limit.quick);
test.run('no star: a contact renamed stays home', 0.8, todayStaysHome(2), test.limit.quick);
test.run('starred: a contact renamed arrives, once', 0.2, todayArrives(2), test.limit.quick);
// An owner's event reaches a face by the node's dispatcher alone (ownerEvent went with the half face, box v29): one line.
const minted = { kind: 'invite-minted', relay: STARRED, invite: 'zz' };
test.run('starred: an owner\'s relay event arrives once', 0.2, function () {
  const sx = W.sx; if (!sx) return MISSING;
  sx.emit('relay-event', minted);
  return sx.got(STARRED, 'relay-event', minted) === 1 || ('starred: an owner\'s relay event arrived ' + sx.got(STARRED, 'relay-event', minted) + ' times');
}, test.limit.quick);
test.run('no star: an owner\'s relay event stays home', 0.8, function () {
  const sx = W.sx; if (!sx) return MISSING;
  return sx.got(PLAIN, 'relay-event', minted) === 0 || ('no star: an owner\'s relay event arrived ' + sx.got(PLAIN, 'relay-event', minted) + ' times');
}, test.limit.quick);

// goal/G41.33: only true is a star, the star counts at each event, and it sends no catch-up.
test.run('a truthy answer is no star: nothing arrives', 0.8, async function () {
  const loose2 = streams(function () { return 'yes'; });
  loose2.home.open(STARRED, '');
  await settle();
  loose2.emit('job-deleted', 'job_1');
  return loose2.got(STARRED, 'job-deleted', 'job_1') === 0 || 'faceOwned answering "yes" opened the stream';
}, test.limit.quick);
test.run('before the star: nothing', 0.8, async function () {
  W.pressed = false;
  const sw = W.sw = streams(function () { return W.pressed; });
  sw.home.open(STARRED, '');
  await settle();
  sw.emit('job-deleted', 'job_before');
  return sw.got(STARRED, 'job-deleted', 'job_before') === 0 || 'before the star, a job deleted arrived';
}, test.limit.quick);
test.run('the star pressed with the face open: the next event arrives, no reopening', 0.2, async function () {
  const sw = W.sw; if (!sw) return MISSING;
  W.pressed = true;
  await settle();
  W.atPress = sw.lines(STARRED).length;
  sw.emit('job-deleted', 'job_on');
  return sw.got(STARRED, 'job-deleted', 'job_on') === 1 || 'the star was pressed and the next event did not arrive';
}, test.limit.quick);
test.run('and no catch-up: what went before it never comes', 0.8, function () {
  const sw = W.sw; if (!sw || W.atPress === undefined) return MISSING;
  return (sw.got(STARRED, 'job-deleted', 'job_before') === 0 && sw.lines(STARRED).length === W.atPress + 1) || ('pressing the star sent a catch-up: ' + short(sw.lines(STARRED)));
}, test.limit.quick);
test.run('the star taken off: the next event stays home, at once', 0.8, function () {
  const sw = W.sw; if (!sw) return MISSING;
  W.pressed = false;
  sw.emit('job-deleted', 'job_off');
  return sw.got(STARRED, 'job-deleted', 'job_off') === 0 || 'the star came off and a job deleted still reached the face';
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
  return async function () { const sn = await snapshotStreams(); return onWire(sn, STARRED, id) || ('starred, on opening: job ' + id + ' is not on the stream, a loopback page has it'); };
}
function notOnOpening(id) {
  return async function () { const sn = await snapshotStreams(); return !onWire(sn, PLAIN, id) || ('no star, on opening: job ' + id + ' reached the face'); };
}
test.run('starred, on opening: the job spirit.auth is there', 0.2, onOpening('spirit.auth'), test.limit.quick);
test.run('no star, on opening: the job spirit.auth is not', 0.8, notOnOpening('spirit.auth'), test.limit.quick);
test.run('starred, on opening: the job spirit.app.zz is there', 0.2, onOpening('spirit.app.zz'), test.limit.quick);
test.run('no star, on opening: the job spirit.app.zz is not', 0.8, notOnOpening('spirit.app.zz'), test.limit.quick);
test.run('starred, on opening: the job spirit.app.zzOther is there', 0.2, onOpening('spirit.app.zzOther'), test.limit.quick);
test.run('no star, on opening: the job spirit.app.zzOther is not', 0.8, notOnOpening('spirit.app.zzOther'), test.limit.quick);
test.run('starred, on opening: the job spirit.zzNeverSeen is there', 0.2, onOpening('spirit.zzNeverSeen'), test.limit.quick);
test.run('no star, on opening: the job spirit.zzNeverSeen is not', 0.8, notOnOpening('spirit.zzNeverSeen'), test.limit.quick);
test.run('starred, on opening: the job spirit is there', 0.2, onOpening('spirit'), test.limit.quick);
test.run('no star, on opening: the job spirit is not', 0.8, notOnOpening('spirit'), test.limit.quick);

// goal/G41.33: the queue does not change, and it loses none of the new ones.
test.run('one write at a time: the rest wait for the sink', 0.2, async function () {
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
  return whileBusy === 1 || ('the sink was busy and ' + whileBusy + ' writes went');
}, test.limit.quick);
test.run('after the drain every waiting event has gone out', 0.2, function () {
  const q = W.q; if (!q) return MISSING;
  return (q.got(STARRED, 'job-deleted', 'job_while_busy') === 1 && q.got(STARRED, 'job-updated', jobEvents[0][2]) === 1 && q.got(STARRED, 'relay-event', jobEvents[9][2]) === 1) || ('after the drain the waiting events were lost: ' + short(q.lines(STARRED)));
}, test.limit.quick);
test.run('the queue\'s levels are as they were', 0.2, function () {
  const P = require(path.join(RUN, 'spirit', 'faceHome.js')).FACE_PRIORITY;
  return JSON.stringify(P) === JSON.stringify(PRIORITIES_TODAY) || ('the queue\'s levels changed: ' + short(P));
}, test.limit.quick);

// goal/G41.33: a starred face has no restrictions at all, except changing stars.
test.run('every verb of every family reaches the door, unsealed and sealed', 0.2, async function () {
  const free = lazy('free', starredWorld);
  const shut = [];
  for (const fam of allFamilies()) {
    const inSpirit = fs.existsSync(path.join(RUN, 'spirit', fam, 'api.js'));
    for (const v of verbsOf(inSpirit ? 'spirit/' + fam + '/api.js' : require(path.join(RUN, 'spirit', 'spirit.js')).familyPath(fam))) {
      if (fam + '.' + v === 'contact.own') continue;
      const c = { call: fam + '.' + v, args: {} };
      for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
        const a = await send(free, MINE, form[1]);
        if (a.reached.indexOf(c.call) === -1) shut.push(c.call + ' ' + form[0] + ': ' + said(a));
      }
    }
  }
  return !shut.length || (shut.length + ' still refused; first: ' + shut.slice(0, 3).join(' | '));
}, test.limit.slow);
const THROUGH = { call: 'relay.face', args: { url: MINE, name: 'zz' } };
const FACE_POST = { call: 'peer.post', args: { to: 'RELAYKEY', text: JSON.stringify({ body: { face: 'zz' } }) } };
test.run('starred, unsealed, relay.face on the relay it is called through, reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, THROUGH);
  return on.reached.indexOf('relay.face') !== -1 || ('starred, unsealed: relay.face on the relay it is called through: ' + said(on));
}, test.limit.quick);
test.run('no star, unsealed, relay.face on the relay it is called through, stays refused', 0.8, sentAndRefused('off1', plainWorld, MINE, function () { return THROUGH; }, 'no star, unsealed: relay.face on the relay it is called through'), test.limit.quick);
test.run('starred, sealed, relay.face on the relay it is called through, reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, sealed(THROUGH));
  return on.reached.indexOf('relay.face') !== -1 || ('starred, sealed: relay.face on the relay it is called through: ' + said(on));
}, test.limit.quick);
test.run('no star, sealed, relay.face on the relay it is called through, stays refused', 0.8, sentAndRefused('off2', plainWorld, MINE, function () { return sealed(THROUGH); }, 'no star, sealed: relay.face on the relay it is called through'), test.limit.quick);
test.run('starred, unsealed, a peer.post to that relay carrying a face name, reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, FACE_POST);
  return on.reached.indexOf('peer.post') !== -1 || ('starred, unsealed: a peer.post to that relay carrying a face name: ' + said(on));
}, test.limit.quick);
test.run('no star, unsealed, a peer.post to that relay carrying a face name, stays refused', 0.8, sentAndRefused('off3', plainWorld, MINE, function () { return FACE_POST; }, 'no star, unsealed: a peer.post to that relay carrying a face name'), test.limit.quick);
test.run('starred, sealed, a peer.post to that relay carrying a face name, reaches the door', 0.2, async function () {
  const on = await send(lazy('free', starredWorld), MINE, sealed(FACE_POST));
  return on.reached.indexOf('peer.post') !== -1 || ('starred, sealed: a peer.post to that relay carrying a face name: ' + said(on));
}, test.limit.quick);
test.run('no star, sealed, a peer.post to that relay carrying a face name, stays refused', 0.8, sentAndRefused('off4', plainWorld, MINE, function () { return sealed(FACE_POST); }, 'no star, sealed: a peer.post to that relay carrying a face name'), test.limit.quick);
test.run('changing stars stays home: own true, unsealed, refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return { call: 'contact.own', args: { key: 'K', own: true } }; }, 'contact.own true from a starred face, unsealed'), test.limit.quick);
test.run('changing stars stays home: own true, sealed, refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return sealed({ call: 'contact.own', args: { key: 'K', own: true } }); }, 'contact.own true from a starred face, sealed'), test.limit.quick);
test.run('changing stars stays home: own false, unsealed, refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return { call: 'contact.own', args: { key: 'K', own: false } }; }, 'contact.own false from a starred face, unsealed'), test.limit.quick);
test.run('changing stars stays home: own false, sealed, refused', 0.8, sentAndRefused('free', starredWorld, MINE, function () { return sealed({ call: 'contact.own', args: { key: 'K', own: false } }); }, 'contact.own false from a starred face, sealed'), test.limit.quick);

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
    const t = setTimeout(function () { q.destroy(); resolve({ status: 0, text: 'no answer in 15 s' }); }, 15000);
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: 'POST', headers: headers }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { clearTimeout(t); resolve({ status: r.statusCode, text: text, body: parsed(text), cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function (e) { clearTimeout(t); resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b);
  });
}
const MAIL = 'bert@example.org';

// A real join: the node asks, the relay mails, the node confirms with the mail's code.
async function join(N, R) {
  const added = await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  if (added.status !== 200) return 'relay.add answered ' + added.status + ' ' + short(added.text);
  const asked = await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  if (asked.status >= 300) return 'relay.join answered ' + asked.status + ' ' + short(asked.text);
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return 'the relay mailed no join code';
  const done = await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  if (done.status >= 300) return 'the confirm answered ' + done.status + ' ' + short(done.text);
  return '';
}
// relay.face at home; the first ask may still be waiting for the relay's card.
async function setFace(N, R, name) {
  let f = null;
  for (let i = 0; i < 10; i++) {
    f = await home(N.base, 'relay.face', { url: R.base, name: name });
    if (f.status === 200) return '';
    await sleep(2000);
  }
  return 'relay.face answered ' + f.status + ' ' + short(f.text);
}
// The face's login: the member's email, then the token the mail holds.
async function logIn(R, name) {
  let state = null;
  await until(function () { return page(R, name, '/face/api', { call: 'state', args: {} }).then(function (s) { state = s; return s.status === 200; }); }, 15000);
  if (!state || state.status !== 200) return { why: 'the face did not open: ' + (state ? state.status + ' ' + short(state.text) : 'no answer') };
  const from = R.mailed.length;
  await page(R, name, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const mail = R.mailed[from];
  const token = mail && String(mail.text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await page(R, name, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the token logged nobody in: ' + short(done.text) };
}
// Refused: an answer that is no answer, whatever its code (box v29 names none).
const starRefused = function (a) { return a.status >= 400 && a.status < 500; };

// The star part's world, in S; its relays, node and marks are stopped and removed by test.after.
const S = { relays: [] };
const NOBODY = 'MCowBQYDK2VwAyEA' + 'zzStarNobodyzzStarNobodyzzStarNobodyzzStarNob'.slice(0, 43) + '=';
const OWNER = { call: 'owner.command', args: { to: NOBODY, command: 'zzNothing' } };
const SAVED = 'spirit/app/zzStar/saved.txt';
const JOB = { call: 'job.create', args: { command: process.execPath, args: ['spirit/app/zzStar/zzStar.js', 'fromTheFace'] } };
const SAVE = { call: 'fs.save', args: { path: SAVED, content: 'from the face' } };
const NO_NODE = 'no scratch node: the world failed';
const face = function (req) { return page(S.R, 'harbour', '/face/call', req, S.L.sid); };
const starOf = async function (key) { const a = await home(S.N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === key; })); };
const faceName = async function (base) { const g = await home(S.N.base, 'relay.get', { key: base }); const r = g.body && g.body.relay; return r && r.face && typeof r.face === 'object' ? String(r.face.name || '') : String((r && r.face) || ''); };
const loggedIn = function () { return !!(S.L && S.L.sid); };
// The face on the first relay asked q, with no star or after it came off: refused.
function faceRefused(q, label) {
  return async function () {
    if (!loggedIn()) return 'no face logged in: the world failed';
    const a = await face(q);
    return starRefused(a) || (q.call + ' ' + label + ': ' + a.status + ' ' + short(a.text));
  };
}

test.after(function () {
  try { if (S.q) S.q.destroy(); } catch (e) { /* gone */ }
  S.relays.forEach(function (r) { try { r.stop(); } catch (e) { /* gone */ } });
  try { if (S.N && S.N.child) S.N.child.kill(); } catch (e) { /* gone */ }
  try { if (S.N && S.N.root) fs.rmSync(S.N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (S.marks) fs.rmSync(S.marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// faceHome-star: the star on a real node, a real relay and a real face (goal/G41.30).
test.run('the node says its key', 0.2, async function () {
  S.marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-star-marks-'));
  const N = S.N = await scratchNode();
  if (!N.up) return 'the scratch node did not come up: nothing judged';
  const run = S.run = path.join(N.root, 'spirit', 'run');
  const card = await home(N.base, 'node.card');
  S.me = card.body && card.body.publicKey;
  if (!S.me) return 'node.card: ' + short(card.text);
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
  return R.up || 'the scratch relay did not come up: nothing judged';
}, test.limit.slow);
test.run('the node joins it by its mail and sets a face', 0.2, async function () {
  if (!S.me || !S.R || !S.R.up) return NO_NODE;
  const why1 = await join(S.N, S.R) || await setFace(S.N, S.R, 'harbour');
  return !why1 || ('the join or the face failed, nothing judged: ' + why1);
}, test.limit.long);
test.run('the face logs in by the mailed token', 0.2, async function () {
  if (!S.me || !S.R || !S.R.up) return NO_NODE;
  S.L = await logIn(S.R, 'harbour');
  return !!S.L.sid || ('the login failed, nothing judged: ' + S.L.why);
}, test.limit.quick);

// box v29: no star, no face: "The home node answers a face only from a starred relay". Not even the plainest read: there
// is no half face left to answer.
test.run('the relay has no star', 0.8, async function () {
  if (!S.me || !S.R) return NO_NODE;
  return !(await starOf(S.R.relayKey)) || 'the relay has a star nobody pressed';
}, test.limit.quick);
test.run('with no star, node.card from the face is refused', 0.8, faceRefused({ call: 'node.card', args: {} }, 'from the face on a relay with no star'), test.limit.quick);
test.run('with no star, fs.stat from the face is refused', 0.8, faceRefused({ call: 'fs.stat', args: { path: 'spirit/fs/data.js' } }, 'from the face on a relay with no star'), test.limit.quick);
test.run('with no star, contact.search from the face is refused', 0.8, faceRefused({ call: 'contact.search', args: { q: '' } }, 'from the face on a relay with no star'), test.limit.quick);
test.run('with no star, job.create from the face is refused', 0.8, faceRefused(JOB, 'from the face on a relay with no star'), test.limit.quick);
test.run('with no star, fs.save from the face is refused', 0.8, faceRefused(SAVE, 'from the face on a relay with no star'), test.limit.quick);
test.run('with no star, owner.command from the face is refused', 0.8, faceRefused(OWNER, 'from the face on a relay with no star'), test.limit.quick);
test.run('the job did not run', 0.8, async function () {
  if (!S.mark) return NO_NODE;
  await sleep(WAIT_MS);
  return !fs.existsSync(S.mark) || 'job.create from the face RAN, with no star';
}, test.limit.slow);
test.run('the file was not written', 0.8, function () {
  if (!S.savedAt) return NO_NODE;
  return !fs.existsSync(S.savedAt) || 'fs.save from the face WROTE a file, with no star';
}, test.limit.quick);

// The star on, pressed at home: everything is back.
test.run('contact.own at home puts the star on the relay\'s row', 0.2, async function () {
  if (!S.me || !S.R) return NO_NODE;
  const on = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: true });
  return (on.status === 200 && (await starOf(S.R.relayKey))) || ('contact.own at home: ' + on.status + ' ' + short(on.text));
}, test.limit.quick);
test.run('owner.command from the face reaches the door', 0.2, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  const o1 = await face(OWNER);
  test.comment('owner.command, starred, answered ' + o1.status + ' ' + short(o1.text));
  return (o1.status !== 0 && !/not-from-the-face|no-face-here/.test(o1.text)) || ('owner.command on a starred relay: ' + o1.status + ' ' + short(o1.text));
}, test.limit.quick);
test.run('fs.save from the face writes the file', 0.2, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  const s1 = await face(SAVE);
  return (s1.status >= 200 && s1.status < 300 && fs.existsSync(S.savedAt)) || ('fs.save on a starred relay: ' + s1.status + ' ' + short(s1.text) + ', file ' + fs.existsSync(S.savedAt));
}, test.limit.quick);
test.run('job.create of an included process runs it', 0.2, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  const j1 = await face(JOB);
  await until(function () { return fs.existsSync(S.mark); }, 5000);
  return (j1.status === 201 && fs.existsSync(S.mark)) || ('job.create on a starred relay: ' + j1.status + ' ' + short(j1.text) + ', ran ' + fs.existsSync(S.mark));
}, test.limit.quick);
test.run('and /bin/sh is still refused, starred or not', 0.8, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  const shMark = path.join(S.marks, 'sh');
  const sh = await face({ call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'echo x > ' + shMark] } });
  await sleep(WAIT_MS);
  return (sh.status >= 400 && sh.status < 500 && !fs.existsSync(shMark)) || ('/bin/sh from a starred face: ' + sh.status + ' ' + short(sh.text) + ', ran ' + fs.existsSync(shMark));
}, test.limit.slow);
test.run('contact.own from the face is refused even here: the star stays', 0.8, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  const self = await face({ call: 'contact.own', args: { key: S.R.relayKey, own: false } });
  return (self.status >= 400 && self.status < 500 && (await starOf(S.R.relayKey))) || ('contact.own from a starred face: ' + self.status + ' ' + short(self.text) + ', star ' + (await starOf(S.R.relayKey)));
}, test.limit.quick);

// box v29: "A star taken off a relay that has a face takes that face away (Q21)".
test.run('the world: the node holds a face on the relay', 0.2, async function () {
  if (!S.me || !S.R) return NO_NODE;
  fs.rmSync(S.savedAt, { force: true }); fs.rmSync(S.mark, { force: true });
  S.before = await faceName(S.R.base);
  return !!S.before || 'the node holds no face on the relay before the star comes off: nothing judged';
}, test.limit.quick);
test.run('contact.own at home takes the star away', 0.2, async function () {
  if (!S.me || !S.R) return NO_NODE;
  const off = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: false });
  return (off.status === 200 && !(await starOf(S.R.relayKey))) || ('contact.own false at home: ' + off.status + ' ' + short(off.text));
}, test.limit.quick);
test.run('and the node holds no face on that relay any more', 0.8, async function () {
  if (!S.before) return MISSING;
  return (await until(function () { return faceName(S.R.base).then(function (n) { return n === ''; }); }, 8000)) || ('the star came off and the node still holds ' + short(await faceName(S.R.base)));
}, test.limit.quick);
test.run('the star off, node.card through it is refused', 0.8, faceRefused({ call: 'node.card', args: {} }, 'after the star came off'), test.limit.quick);
test.run('the star off, job.create through it is refused', 0.8, faceRefused(JOB, 'after the star came off'), test.limit.quick);
test.run('the star off, fs.save through it is refused', 0.8, faceRefused(SAVE, 'after the star came off'), test.limit.quick);
test.run('the star off, owner.command through it is refused', 0.8, faceRefused(OWNER, 'after the star came off'), test.limit.quick);
test.run('nothing ran, nothing was written', 0.8, async function () {
  if (!S.mark) return NO_NODE;
  await sleep(WAIT_MS);
  return (!fs.existsSync(S.mark) && !fs.existsSync(S.savedAt)) || ('after the star came off: ran ' + fs.existsSync(S.mark) + ', saved ' + fs.existsSync(S.savedAt));
}, test.limit.slow);
test.run('the star put back opens nothing: the face is gone, not hidden', 0.8, async function () {
  if (!loggedIn()) return 'no face logged in: the world failed';
  await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: true });
  const back = await face({ call: 'node.card', args: {} });
  return starRefused(back) || ('the star back on, node.card through the old face: ' + back.status + ' ' + short(back.text));
}, test.limit.quick);

// GOAL/G41.33, ON THE REAL STREAM. "anything andy gets on his loopback screen, he can get on his face, if he "stars" any
// relay"; "NO RESTRICTIONS AT ALL, except changing stars"; "Pressing the star sends no catch-up". Without the star the face
// gets nothing (box v29, above). What a page reads from /face/stream, with its cookie, unsealed as a page that cannot seal.
// The real stream: without the star it carries nothing; with it, a job, a bundle and the join steps.
const NO_STREAM = 'no stream face logged in: the world failed';
const hears = function (word) { return S.got.some(function (l) { return l.indexOf(word) !== -1; }); };
const heardEvent = function (kind, id) { return S.got.some(function (l) { const v = parsed(l); return !!v && v.event === kind && (kind === 'job-deleted' ? v.data === id : !!v.data && v.data.id === id); }); };
const streamUp = function () { return !!(S.LS && S.LS.sid && S.got); };
// One failed job, to delete: a process that ends with an exit code of its own stays until it is deleted.
const runOne = async function () {
  const c = await home(S.N.base, 'job.create', { command: process.execPath, args: ['spirit/app/zzStream/zzStream.js'] });
  const id = c.body && c.body.id;
  if (!id) return { why: 'job.create at home: ' + c.status + ' ' + short(c.text) };
  await until(function () { return home(S.N.base, 'job.get', { key: id }).then(function (a) { const j = a.body && a.body.job; return !!j && j.status === 'failed'; }); }, 8000);
  const d = await home(S.N.base, 'job.delete', { id: id });
  return d.status < 300 ? { id: id } : { why: 'job.delete at home: ' + d.status + ' ' + short(d.text) };
};
const bundle = function (label) { return home(S.N.base, 'auth.bundle', { op: 'add', label: label, text: 'zz' }); };
const sface = function (req) { return page(S.S, 'stream', '/face/call', req, S.LS.sid); };

test.run('a relay for the stream: joined, a face set', 0.2, async function () {
  if (!S.me) return NO_NODE;
  const St = S.S = await scratchFaceRelay({ members: [] });
  S.relays.push(St);
  const why4 = !St.up ? 'the relay did not come up' : (await join(S.N, St) || await setFace(S.N, St, 'stream'));
  S.why4 = why4;
  return !why4 || ('nothing judged: ' + why4);
}, test.limit.long);
test.run('the face logs in', 0.2, async function () {
  if (!S.S || S.why4 !== '') return 'no stream relay: the world failed';
  S.LS = await logIn(S.S, 'stream');
  return !!S.LS.sid || ('the login failed, nothing judged: ' + S.LS.why);
}, test.limit.quick);
test.run('no star: the stream carries nothing of the node, not even its file tree', 0.8, async function () {
  if (!S.LS || !S.LS.sid) return NO_STREAM;
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
  return (!hears('spirit.fs') && !hears('presence')) || ('no star: the stream said ' + short(S.got.slice(0, 3)));
}, test.limit.slow);
test.run('no star: a job runs and is deleted at home', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const script2 = path.join(S.run, 'spirit/app/zzStream/zzStream.js');
  fs.mkdirSync(path.dirname(script2), { recursive: true });
  fs.writeFileSync(script2, 'setTimeout(function () { process.exit(4); }, 300);\n');
  fs.writeFileSync(path.join(S.run, 'spirit/app/zzStream/zzStream.json'), JSON.stringify({ identity: { label: 'zz', intrinsic: false }, node: { run: true } }));
  S.j0 = await runOne();
  return !!S.j0.id || ('nothing judged: ' + S.j0.why);
}, test.limit.quick);
test.run('no star: a bundle is added at home', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const b0 = await bundle('zzBefore');
  return b0.status < 300 || ('auth.bundle at home: ' + b0.status + ' ' + short(b0.text));
}, test.limit.quick);
test.run('no star: the job never reaches the face', 0.8, async function () {
  if (!streamUp() || !S.j0) return NO_STREAM;
  await sleep(WAIT_MS);
  return (!!S.j0.id && !hears(S.j0.id)) || ('no star: job ' + S.j0.id + ' reached the face');
}, test.limit.slow);
test.run('no star: the bundle never reaches the face', 0.8, function () {
  if (!streamUp()) return NO_STREAM;
  return !hears('zzBefore') || 'no star: the bundle reached the face';
}, test.limit.quick);
test.run('the star on, at home, the stream still open', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const sOn = await home(S.N.base, 'contact.own', { key: S.S.relayKey, own: true });
  return sOn.status === 200 || ('contact.own at home: ' + sOn.status + ' ' + short(sOn.text));
}, test.limit.quick);
test.run('no catch-up: what went before the star does not come', 0.8, async function () {
  if (!streamUp() || !S.j0) return NO_STREAM;
  await sleep(WAIT_MS);
  return (!!S.j0.id && !hears(S.j0.id) && !hears('zzBefore')) || 'pressing the star sent what went before it';
}, test.limit.slow);
test.run('starred: a job runs and is deleted at home', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  S.j1b = await runOne();
  return !!S.j1b.id || ('nothing judged: ' + S.j1b.why);
}, test.limit.quick);
test.run('starred: the running job reaches the face', 0.2, async function () {
  if (!streamUp() || !S.j1b) return NO_STREAM;
  await until(function () { return heardEvent('job-deleted', S.j1b.id); }, 5000);
  return (!!S.j1b.id && heardEvent('job-updated', S.j1b.id)) || ('starred: job ' + S.j1b.id + ' never reached the face');
}, test.limit.quick);
test.run('starred: the job deleted reaches the face', 0.2, function () {
  if (!streamUp() || !S.j1b) return NO_STREAM;
  return (!!S.j1b.id && heardEvent('job-deleted', S.j1b.id)) || ('starred: job-deleted ' + S.j1b.id + ' never reached the face');
}, test.limit.quick);
test.run('starred: the bundle reaches the face', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const b1 = await bundle('zzAfter');
  await until(function () { return hears('zzAfter'); }, 5000);
  return (b1.status < 300 && hears('zzAfter')) || ('starred: the bundle never reached the face: ' + b1.status + ' ' + short(b1.text));
}, test.limit.quick);
// The join steps are published only when their facts change (joinStepsJob.js): this node's first contact, here a key
// it blocks, makes "contact" true.
test.run('starred: a first contact appears at home', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const someone = auth.generateIdentity('zz').publicKey;
  const blocked = await home(S.N.base, 'contact.block', { publicKey: someone });
  return blocked.status < 300 || ('nothing judged: contact.block answered ' + blocked.status + ' ' + short(blocked.text));
}, test.limit.quick);
test.run('starred: the join steps reach the face, the join news of the spirit job', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  await until(function () { return hears('"join":'); }, 5000);
  return hears('"join":') || 'starred: the join news never reached the face';
}, test.limit.quick);

// A starred face has no restrictions, except changing stars.
test.run('the world: the first relay\'s star off again', 0.2, async function () {
  if (!streamUp() || !S.R) return NO_STREAM;
  const rOff = await home(S.N.base, 'contact.own', { key: S.R.relayKey, own: false });
  return rOff.status === 200 || ('contact.own false at home: ' + rOff.status);
}, test.limit.quick);
test.run('starring another relay from it is refused, and no star lands', 0.8, async function () {
  if (!streamUp() || !S.R) return NO_STREAM;
  const anotherStar2 = await sface({ call: 'contact.own', args: { key: S.R.relayKey, own: true } });
  return (starRefused(anotherStar2) && !(await starOf(S.R.relayKey))) || ('contact.own of another relay from a starred face: ' + anotherStar2.status + ' ' + short(anotherStar2.text) + ', star ' + (await starOf(S.R.relayKey)));
}, test.limit.quick);
test.run('taking its own star off from it is refused, and the star stays', 0.8, async function () {
  if (!streamUp()) return NO_STREAM;
  const ownOff = await sface({ call: 'contact.own', args: { key: S.S.relayKey, own: false } });
  return (starRefused(ownOff) && (await starOf(S.S.relayKey))) || ('contact.own false from a starred face: ' + ownOff.status + ' ' + short(ownOff.text) + ', star ' + (await starOf(S.S.relayKey)));
}, test.limit.quick);
// Last, since it takes the page's address away: the face you call through, renamed through it, on a star.
test.run('starred: relay.face on the relay it is called through is not refused by the face\'s rule', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const renamed = await sface({ call: 'relay.face', args: { url: S.S.base, name: 'renamed' } });
  return (!/not-from-the-face/.test(renamed.text) && renamed.status < 400) || ('relay.face through a starred face: ' + renamed.status + ' ' + short(renamed.text));
}, test.limit.quick);
test.run('and the face has its new name on the relay', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const moved = await until(function () { return page(S.S, 'renamed', '/face/api', { call: 'state', args: {} }).then(function (a) { return a.status === 200; }); }, 8000);
  return !!moved || 'after relay.face through a starred face, renamed.relay.example does not answer';
}, test.limit.quick);
// The star off with the stream open: the face goes, so the next event stays home.
test.run('the star off, at home', 0.2, async function () {
  if (!streamUp()) return NO_STREAM;
  const sOff = await home(S.N.base, 'contact.own', { key: S.S.relayKey, own: false });
  return sOff.status === 200 || ('contact.own false at home: ' + sOff.status + ' ' + short(sOff.text));
}, test.limit.quick);
// A job's id is its route, the same for every run (goal/G43.20): only what the stream says from here on is judged.
test.run('the star off: the next job stays home', 0.8, async function () {
  if (!streamUp()) return NO_STREAM;
  const sinceOff = S.got.length;
  const j2b = await runOne();
  await sleep(WAIT_MS);
  return (!!j2b.id && !S.got.slice(sinceOff).some(function (l) { return l.indexOf(j2b.id) !== -1; })) || ('the star came off and job ' + j2b.id + ' still reached the face');
}, test.limit.slow);
test.run('and on the real stream, the node holds no face on that relay any more', 0.8, async function () {
  if (!streamUp()) return NO_STREAM;
  const gone = await until(function () { return faceName(S.S.base).then(function (n) { return n === ''; }); }, 8000);
  try { S.q.destroy(); } catch (e) { /* gone */ }
  return gone || ('the star came off and the node still holds ' + short(await faceName(S.S.base)));
}, test.limit.quick);

// A RELAY THAT SAYS THIS NODE OWNS IT: a relay's claim changes nothing: it says this node owns it, and no star is pressed.
// The face is set first, as a member, then the owner mark goes in: relay.face on a relay that already owns this node
// answers no text today, so the node cannot read it (a fault of its own, reported, not this rule's).
test.run('a relay whose owner mark is this node\'s key: joined, a face set', 0.2, async function () {
  if (!S.me) return NO_NODE;
  const O = S.O = await scratchFaceRelay({ members: [] });
  S.relays.push(O);
  let why2 = !O.up ? 'the relay did not come up' : (await join(S.N, O) || await setFace(S.N, O, 'mine'));
  if (!why2 && !(await O.becomeOwned(S.me))) why2 = 'the relay did not come back with this node as its owner';
  S.why2 = why2;
  return !why2 || ('nothing judged: ' + why2);
}, test.limit.long);
test.run('the relay has sent this node its owner\'s report', 0.2, async function () {
  if (!S.O || S.why2 !== '') return 'no owned relay: the world failed';
  let report = null;
  await until(function () { return home(S.N.base, 'relay.get', { key: S.O.base }).then(function (a) { report = a.body && a.body.report; return !!(report && Object.keys(report).length); }); }, 20000);
  S.report = !!(report && Object.keys(report).length);
  return S.report || 'no owner\'s report came: the claim was never made, so nothing is judged';
}, test.limit.slow);
test.run('its report sets no star', 0.8, async function () {
  if (!S.O || S.why2 !== '') return 'no owned relay: the world failed';
  return !(await starOf(S.O.relayKey)) || 'the relay\'s own report put a star on its row';
}, test.limit.quick);
test.run('the face logs in there', 0.2, async function () {
  if (!S.O || S.why2 !== '') return 'no owned relay: the world failed';
  S.L2 = await logIn(S.O, 'mine');
  return !!S.L2.sid || ('the login failed, nothing judged: ' + S.L2.why);
}, test.limit.quick);
test.run('owner.command from that face is refused: the relay\'s word opens nothing', 0.8, async function () {
  if (!S.L2 || !S.L2.sid) return 'no face logged in on the owned relay: the world failed';
  const a = await page(S.O, 'mine', '/face/call', OWNER, S.L2.sid);
  return starRefused(a) || ('owner.command on a relay that only claims this node: ' + a.status + ' ' + short(a.text));
}, test.limit.quick);

// A RELAY WHERE THIS NODE SET NO FACE gets nothing, whatever it does.
test.run('a third relay: joined, and no face asked for', 0.2, async function () {
  if (!S.me) return NO_NODE;
  const D = S.D = await scratchFaceRelay({ members: [] });
  S.relays.push(D);
  const why3 = !D.up ? 'the relay did not come up' : await join(S.N, D);
  S.why3 = why3;
  return !why3 || ('nothing judged: ' + why3);
}, test.limit.slow);
test.run('the relay has made a face this node never asked for, and logged in to it', 0.2, async function () {
  if (!S.D || S.why3 !== '') return 'no third relay: the world failed';
  // The dishonest relay: it gives the member a face on its own, so it can send this node face events.
  S.D.setFace(S.me, 'forged', MAIL);
  await sleep(300);
  S.L3 = await logIn(S.D, 'forged');
  return !!S.L3.sid || ('the forged face could not log in, nothing judged: ' + S.L3.why);
}, test.limit.slow);
function forgedRefused(q) {
  return async function () {
    if (!S.L3 || !S.L3.sid) return 'no forged face logged in: the world failed';
    const a = await page(S.D, 'forged', '/face/call', q, S.L3.sid);
    return (a.status === 403 && !!a.body && a.body.code === 'no-face-here') || (q.call + ' on a relay where this node set no face: ' + a.status + ' ' + short(a.text));
  };
}
test.run('node.card through it is refused, no-face-here', 0.8, forgedRefused({ call: 'node.card', args: {} }), test.limit.quick);
test.run('job.create through it is refused, no-face-here', 0.8, forgedRefused(JOB), test.limit.quick);
test.run('and a star does not open it: no face of mine, nothing', 0.8, async function () {
  if (!S.L3 || !S.L3.sid) return 'no forged face logged in: the world failed';
  const on3 = await home(S.N.base, 'contact.own', { key: S.D.relayKey, own: true });
  const a3 = await page(S.D, 'forged', '/face/call', JOB, S.L3.sid);
  return (on3.status === 200 && a3.status === 403 && !!a3.body && a3.body.code === 'no-face-here') || ('starred, no face set: ' + on3.status + ', ' + a3.status + ' ' + short(a3.text));
}, test.limit.quick);
test.run('no job ran through any of this', 0.8, async function () {
  if (!S.mark) return NO_NODE;
  await sleep(WAIT_MS);
  return !fs.existsSync(S.mark) || 'a job ran through a relay that had no right to it';
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
    q.on('error', function (e) { resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b);
  });
}
// A real join, a real face, a real login; answers the session, or why not.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return { why: 'the relay mailed no join code' };
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return { why: 'relay.face: ' + short(f && f.text) };
  await until(function () { return appsPage(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await appsPage(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await appsPage(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short(done.text) };
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
const NO_CHROME = 'no browser on a logged-in face: the world failed';
const browsing = function () { return !!(A.chrome && A.FACE && A.F && A.F.sid); };
test.after(function () {
  const chrome = A.chrome;
  try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (A.R) A.R.stop(); } catch (e) { /* gone */ }
  try { if (A.N && A.N.child) A.N.child.kill(); } catch (e) { /* gone */ }
  try { if (A.N && A.N.root) fs.rmSync(A.N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// faceHome-starApps: a star shows every app on the face (goal/G41.33, Q9).
test.run('a real node has a real face, logged in', 0.2, async function () {
  A.N = await scratchNode();
  A.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!A.N.up || !A.R.up) return 'the scratch node or relay did not come up: nothing judged';
  A.F = await faceOf(A.N, A.R);
  return !!A.F.sid || ('nothing judged: ' + A.F.why);
}, test.limit.long);
test.run('the browser holds the login', 0.2, async function () {
  if (!A.F || !A.F.sid) return 'no face logged in: the world failed';
  const where = findChrome();
  if (!where) return 'no Chrome here: nothing judged';
  const chrome = await chromePage(where);
  if (chrome.error) return 'Chrome: ' + chrome.error;
  A.chrome = chrome;
  A.FACE = 'http://' + NAME + '.' + DOMAIN + ':' + A.R.port + '/';
  const set = await chrome.send('Network.setCookie', { name: 'spirit_face', value: A.F.sid, url: A.FACE, path: '/' });
  return !!(set.result && set.result.success) || ('the browser would not take the cookie: ' + short(set));
}, test.limit.quick);
test.run('at home the desktop shows Text Editor and Media Viewer', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  A.atHome = await desktop(A.chrome, A.N.base + '/');
  test.comment('at home: ' + A.atHome.join(', '));
  return (A.atHome.indexOf('Text Editor') !== -1 && A.atHome.indexOf('Media Viewer') !== -1) || ('at home they are not there, nothing judged: ' + short(A.atHome));
}, test.limit.slow);

// No star: each app's face mark decides, as today.
test.run('the face\'s desktop is drawn', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  A.plain = await desktop(A.chrome, A.FACE);
  test.comment('no star: ' + A.plain.join(', '));
  return A.plain.indexOf('Contacts') !== -1 || ('the face drew no desktop, nothing judged: ' + short(A.plain));
}, test.limit.slow);
test.run('Text Editor and Media Viewer are not on it', 0.2, function () {
  if (!A.plain) return MISSING;
  return (A.plain.indexOf('Text Editor') === -1 && A.plain.indexOf('Media Viewer') === -1) || ('with no star the face shows them: ' + short(A.plain));
}, test.limit.quick);

// WHO PAINTS, LISTENS (goal/G41.32; Andy: "every row's data, wherever it's visible OR invisible must update instantly, and
// when visible, paint immediately."; "does a star change at home stream to the face????"): the page stays open, no reload.
// The star pressed at home, the face open: its desktop follows, with no reload.
test.run('the star on, at home', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  await A.chrome.evaluate('window.__sameLoad = true; 1');
  const live = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: true });
  return live.status === 200 || ('contact.own: ' + live.status + ' ' + short(live.text));
}, test.limit.quick);
test.run('Text Editor and Media Viewer come at once', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') !== -1 && n.indexOf('Media Viewer') !== -1; }); }, 8000);
  A.onLive = await namesNow();
  return (A.onLive.indexOf('Text Editor') !== -1 && A.onLive.indexOf('Media Viewer') !== -1) || ('the open face shows: ' + short(A.onLive));
}, test.limit.long);
test.run('with its desktop open, the star off, at home', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  const liveOff = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: false });
  return liveOff.status === 200 || ('contact.own false: ' + liveOff.status + ' ' + short(liveOff.text));
}, test.limit.quick);
test.run('and go at once', 0.2, async function () {
  if (!browsing() || !A.onLive) return NO_CHROME;
  await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') === -1 && n.indexOf('Media Viewer') === -1; }); }, 8000);
  const offLive = await namesNow();
  const cameLive = A.onLive.indexOf('Text Editor') !== -1 && A.onLive.indexOf('Media Viewer') !== -1;
  return (cameLive && offLive.indexOf('Contacts') !== -1 && offLive.indexOf('Text Editor') === -1 && offLive.indexOf('Media Viewer') === -1) || (cameLive ? 'the open face shows: ' + short(offLive) : 'they never came: nothing judged');
}, test.limit.quick);
test.run('all on the one load of the page', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  return (await A.chrome.evaluate('window.__sameLoad === true')) === true || 'the page reloaded itself';
}, test.limit.quick);

// The star: every app the home desktop shows.
test.run('for every app: the star on, at home', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  const on = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: true });
  return on.status === 200 || ('contact.own: ' + on.status + ' ' + short(on.text));
}, test.limit.quick);
test.run('every app on the home desktop is on the starred face', 0.2, async function () {
  if (!browsing() || !A.atHome) return NO_CHROME;
  A.starred = await desktop(A.chrome, A.FACE);
  test.comment('starred: ' + A.starred.join(', '));
  const gap = missing(A.atHome, A.starred);
  return (A.starred.length > 0 && !gap.length) || ('on the home desktop and not on the starred face: ' + gap.join(', '));
}, test.limit.slow);
test.run('and Join and the login app stay the boot\'s own', 0.2, function () {
  if (!A.starred) return MISSING;
  return A.starred.indexOf('Join') === -1 || ('a boot part became an app icon: ' + short(A.starred));
}, test.limit.quick);

// An app it shows opens.
test.run('its tile is there to press', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  A.pageErrors = A.chrome.heard.length;
  A.opened = await A.chrome.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")); var hit = all.filter(function (e) { return e.children.length === 0 && e.textContent.trim() === "Text Editor"; })[0]; if (!hit) return false; hit.click(); return true; }())');
  return A.opened === true || 'no Text Editor tile to press on the starred face';
}, test.limit.quick);
test.run('pressing it throws nothing in the page', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  await sleep(DRAWN_MS / 2);
  const threw = A.chrome.heard.slice(A.pageErrors || 0).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
  return (A.opened === true && !threw.length) || (A.opened === true ? 'pressing Text Editor threw: ' + threw.slice(0, 2).join(' | ') : 'nothing was pressed, so nothing is judged');
}, test.limit.slow);

// The star off: back to the face marks.
test.run('back to the face marks: the star off, at home', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  const off = await home(A.N.base, 'contact.own', { key: A.R.relayKey, own: false });
  return off.status === 200 || ('contact.own false: ' + off.status + ' ' + short(off.text));
}, test.limit.quick);
test.run('Text Editor and Media Viewer are gone again', 0.2, async function () {
  if (!browsing()) return NO_CHROME;
  const again = await desktop(A.chrome, A.FACE);
  return (again.indexOf('Contacts') !== -1 && again.indexOf('Text Editor') === -1 && again.indexOf('Media Viewer') === -1) || ('with the star off the face shows: ' + short(again));
}, test.limit.slow);
