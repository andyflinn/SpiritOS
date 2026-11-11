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

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const seal = require(path.join(RUN, 'spirit', 'seal.js'));
const { createFaceHome } = require(path.join(RUN, 'spirit', 'faceHome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
const settle = async function () { for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); }); };

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

test.startTest('faceHome.js: a relay runs nothing on this node it was not given (goal/G41.30, RC1)');

// Its own checks, then each part in order.
async function ownPart() {
  const CARD = { call: 'node.card', args: {} };
  const SHELL = { call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'id'] } };

  test.subHeading('a relay where this node set no face gets nothing');
  // The review: "the node never checks that it set a face on that relay, that a face is open, or who asked."; its fix:
  // "accept face* events only from a relay where this node set a face".
  const w = world(onlyMine);
  for (const c of [['an allowed verb', CARD], ['job.create with a shell', SHELL], ['the same, sealed', sealed(SHELL)], ['the same, in pieces', pieced(SHELL)]]) {
    const a = await send(w, OTHER, c[1]);
    const held16 = !a.reached.length;
    const why16 = 'from a relay with no face of mine, ' + c[0] + ': ' + said(a);
    if (c[0] === 'an allowed verb') ok(held16, 'from a relay with no face of mine, an allowed verb never reaches the door', why16);
    else if (c[0] === 'job.create with a shell') ok(held16, 'from a relay with no face of mine, job.create with a shell never reaches the door', why16);
    else if (c[0] === 'the same, sealed') ok(held16, 'from a relay with no face of mine, job.create with a shell, sealed never reaches the door', why16);
    else if (c[0] === 'the same, in pieces') ok(held16, 'from a relay with no face of mine, job.create with a shell, in pieces never reaches the door', why16);
    const held15 = refused(a);
    const why15 = c[0] + ' from a relay with no face of mine was not refused with a code: ' + said(a);
    if (c[0] === 'an allowed verb') ok(held15, 'from a relay with no face of mine, an allowed verb is answered a refusal with a code', why15);
    else if (c[0] === 'job.create with a shell') ok(held15, 'from a relay with no face of mine, job.create with a shell is answered a refusal with a code', why15);
    else if (c[0] === 'the same, sealed') ok(held15, 'from a relay with no face of mine, job.create with a shell, sealed is answered a refusal with a code', why15);
    else if (c[0] === 'the same, in pieces') ok(held15, 'from a relay with no face of mine, job.create with a shell, in pieces is answered a refusal with a code', why15);
  }
  const file = await send(w, OTHER, { get: 'face.html' });
  ok(!w.files.length && refused(file), 'a file asked by it is not served, and refused', 'a file was served to a relay with no face of mine: files ' + short(w.files) + ', ' + said(file));
  const keys = await send(w, OTHER, { keys: 1 });
  ok(refused(keys), 'the keys asked by it are refused', 'the keys were answered to a relay with no face of mine: ' + said(keys));
  let opened = null;
  try { w.home.open(OTHER, ''); opened = !!w.uploads['/api/relay/face/stream']; } catch (e) { opened = 'threw ' + e.message; }
  ok(opened === false, 'face-open from it starts no stream of this node\'s events', 'face-open from a relay with no face of mine: stream started ' + opened);
  try { w.home.close(OTHER); } catch (e) { /* its own check is above */ }

  test.subHeading('with no faceSet given at all, it refuses: closed, not open');
  const bare = world(null);
  const none = await send(bare, MINE, CARD);
  ok(!none.reached.length && refused(none), 'a face home told of no face takes no call', 'with no faceSet, a call: ' + said(none));

  // Box v29: "The home node answers a face only from a starred relay, one check; a face it answers is a full face."
  test.subHeading('the relay where this node set a face, and starred, works as before');
  const m = world(onlyMine, onlyMine);
  const card = await send(m, MINE, CARD);
  ok(card.reached.indexOf('node.card') !== -1 && card.status === 200, 'node.card reaches the door', 'node.card from my face\'s relay: ' + said(card));
  const cardSealed = await send(m, MINE, sealed(CARD));
  ok(cardSealed.reached.indexOf('node.card') !== -1 && cardSealed.status === 200, 'sealed too', 'sealed node.card from my face\'s relay: ' + said(cardSealed));
  const f = await send(m, MINE, { get: 'face.html' });
  ok(m.files.indexOf('face.html') !== -1 && f.status === 200, 'a file it asks is served (the face loads its parts so)', 'a file from my face\'s relay: files ' + short(m.files) + ', ' + said(f));
  const k = await send(m, MINE, { keys: 1 });
  ok(k.status === 200 && k.body && k.body.publicKey === ME.publicKey, 'the keys are answered', 'keys from my face\'s relay: ' + said(k));
  let streaming = false;
  try { m.home.open(MINE, ''); streaming = !!m.uploads['/api/relay/face/stream']; } catch (e) { streaming = false; }
  ok(streaming, 'face-open starts the stream', 'face-open from my face\'s relay started no stream');
  try { m.home.close(MINE); } catch (e) { /* the stream is the stand-in's */ }

  // Every verb the families declare, from their own declarations.
  const allFamilies = function () {
    const dirs = function (d) { return fs.readdirSync(path.join(RUN, d), { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }); };
    return dirs('spirit').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); })
      .concat(dirs('spirit/app').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', 'app', n, 'api.js')) && !fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); }));
  };
  const verbsOf = function (file) { return Object.keys(require(path.join(RUN, file)).verbs); };

  // GOAL/G43.18, BOX V29, "A face is whole, or there is none" (Andy: "we remove ALL the star shit, like this,", "on the home
  // node, NO face is offered (faceForm hides itself) for a relay without star."): the half face of G41.30 and G41.33 is gone.
  test.subHeading('box v29: a relay with my face and no star gets nothing at all');
  const plain = world(onlyMine, function () { return false; });
  const asks = [['node.card', CARD], ['node.card, sealed', sealed(CARD)], ['fs.stat', { call: 'fs.stat', args: { path: 'x' } }],
    ['owner.command', { call: 'owner.command', args: { key: 'x' } }], ['job.create with a shell', SHELL], ['the same, in pieces', pieced(SHELL)],
    ['a file', { get: 'face.html' }], ['the keys', { keys: 1 }], ['a save in parts', { upload: { id: 'abcdefgh', n: 0, of: 1, size: 1, path: 'x.txt', bytes: 'eA==' } }]];
  for (const c of asks) {
    const a = await send(plain, MINE, c[1]);
    const held14 = !a.reached.length && refused(a);
    const why14 = 'no star: ' + c[0] + ': ' + said(a);
    if (c[0] === 'node.card') ok(held14, 'no star: node.card is refused and never reaches the door', why14);
    else if (c[0] === 'node.card, sealed') ok(held14, 'no star: node.card, sealed is refused and never reaches the door', why14);
    else if (c[0] === 'fs.stat') ok(held14, 'no star: fs.stat is refused and never reaches the door', why14);
    else if (c[0] === 'owner.command') ok(held14, 'no star: owner.command is refused and never reaches the door', why14);
    else if (c[0] === 'job.create with a shell') ok(held14, 'no star: job.create with a shell is refused and never reaches the door', why14);
    else if (c[0] === 'the same, in pieces') ok(held14, 'no star: job.create with a shell, in pieces is refused and never reaches the door', why14);
    else if (c[0] === 'a file') ok(held14, 'no star: a file is refused and never reaches the door', why14);
    else if (c[0] === 'the keys') ok(held14, 'no star: the keys is refused and never reaches the door', why14);
    else if (c[0] === 'a save in parts') ok(held14, 'no star: a save in parts is refused and never reaches the door', why14);
  }
  ok(!plain.files.length && !plain.saved.length, 'no star: no file served and none written', 'no star: files ' + short(plain.files) + ', saved ' + short(plain.saved));

  test.subHeading('starring takes the node\'s own word, and a face there');
  const loose = world(onlyMine, function () { return 'yes'; });
  const a2 = await send(loose, MINE, CARD);
  ok(!a2.reached.length && refused(a2), 'only true is a star: a truthy answer opens nothing', 'faceOwned answering "yes": ' + said(a2));
  const noFace = world(function () { return false; }, function () { return true; });
  const a3 = await send(noFace, MINE, CARD);
  ok(!a3.reached.length && refused(a3), 'a starred relay where this node set no face gets nothing', 'starred, no face: ' + said(a3));

  // THE STAR IS SET AT HOME (Andy: "so this button will put the star on relays and puppets. AND take it away."; every
  // contact's panel has it "at home"). From a face, even on a relay this node owns, it would let whoever is in on one
  // face hand the machine to another relay.
  test.subHeading('contact.own never comes through a face');
  const OWN_CALL = { call: 'contact.own', args: { key: 'K', own: true } };
  for (const c of [['a relay this node owns', world(onlyMine, onlyMine)], ['a relay it does not own', world(onlyMine, function () { return false; })]]) {
    for (const form of [['unsealed', OWN_CALL], ['sealed', sealed(OWN_CALL)]]) {
      const a = await send(c[1], MINE, form[1]);
      const held13 = !a.reached.length && refused(a);
      const why13 = 'contact.own on ' + c[0] + ', ' + form[0] + ': ' + said(a);
      if (c[0] + ', ' + form[0] === 'a relay this node owns, unsealed') ok(held13, 'contact.own on a relay this node owns, unsealed: refused with a code, and it never reaches the door', why13);
      else if (c[0] + ', ' + form[0] === 'a relay this node owns, sealed') ok(held13, 'contact.own on a relay this node owns, sealed: refused with a code, and it never reaches the door', why13);
      else if (c[0] + ', ' + form[0] === 'a relay it does not own, unsealed') ok(held13, 'contact.own on a relay it does not own, unsealed: refused with a code, and it never reaches the door', why13);
      else if (c[0] + ', ' + form[0] === 'a relay it does not own, sealed') ok(held13, 'contact.own on a relay it does not own, sealed: refused with a code, and it never reaches the door', why13);
    }
  }

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

  test.subHeading('a starred face hears what the loopback hears, each once, and a face with no star hears nothing (box v29)');
  const sx = streams(starAt);
  sx.home.open(STARRED, '');
  sx.home.open(PLAIN, '');
  await settle();
  ok(!!sx.ups[STARRED] && !!sx.ups[PLAIN], 'both faces have their stream open', 'a stream did not open: nothing judged');
  ok(sx.subs.length > 0, 'the home side subscribes to the node\'s events', 'no subscriber: nothing judged');
  jobEvents.forEach(function (c) {
    sx.emit(c[1], c[2]);
    const on = sx.got(STARRED, c[1], c[2]);
    const held12 = on === 1;
    const why12 = 'starred: ' + c[0] + ' arrived ' + on + ' times, as ' + c[1] + ' ' + short(c[2]);
    if (c[0] === 'a bundle') ok(held12, 'starred: a bundle arrives whole, once', why12);
    else if (c[0] === 'a branch') ok(held12, 'starred: a branch arrives whole, once', why12);
    else if (c[0] === 'a grant') ok(held12, 'starred: a grant arrives whole, once', why12);
    else if (c[0] === 'a job deleted') ok(held12, 'starred: a job deleted arrives whole, once', why12);
    else if (c[0] === 'a running job of a process') ok(held12, 'starred: a running job of a process arrives whole, once', why12);
    else if (c[0] === 'a running job of no module') ok(held12, 'starred: a running job of no module arrives whole, once', why12);
    else if (c[0] === 'a job of an id nobody has listed') ok(held12, 'starred: a job of an id nobody has listed arrives whole, once', why12);
    else if (c[0] === 'a server\'s job as a whole') ok(held12, 'starred: a server\'s job as a whole arrives whole, once', why12);
    else if (c[0] === 'the join steps') ok(held12, 'starred: the join steps arrives whole, once', why12);
    else if (c[0] === 'a relay event of the monitor, a post') ok(held12, 'starred: a relay event of the monitor, a post arrives whole, once', why12);
    else if (c[0] === 'a relay event of the monitor, a reply') ok(held12, 'starred: a relay event of the monitor, a reply arrives whole, once', why12);
    else if (c[0] === 'a relay event of the monitor, a refusal') ok(held12, 'starred: a relay event of the monitor, a refusal arrives whole, once', why12);
    else if (c[0] === 'a relay\'s status') ok(held12, 'starred: a relay\'s status arrives whole, once', why12);
  });
  jobEvents.forEach(function (c) {
    const held11 = sx.got(PLAIN, c[1], c[2]) === 0;
    const why11 = 'no star: ' + c[0] + ' reached a face with no star';
    if (c[0] === 'a bundle') ok(held11, 'no star: a bundle stays home', why11);
    else if (c[0] === 'a branch') ok(held11, 'no star: a branch stays home', why11);
    else if (c[0] === 'a grant') ok(held11, 'no star: a grant stays home', why11);
    else if (c[0] === 'a job deleted') ok(held11, 'no star: a job deleted stays home', why11);
    else if (c[0] === 'a running job of a process') ok(held11, 'no star: a running job of a process stays home', why11);
    else if (c[0] === 'a running job of no module') ok(held11, 'no star: a running job of no module stays home', why11);
    else if (c[0] === 'a job of an id nobody has listed') ok(held11, 'no star: a job of an id nobody has listed stays home', why11);
    else if (c[0] === 'a server\'s job as a whole') ok(held11, 'no star: a server\'s job as a whole stays home', why11);
    else if (c[0] === 'the join steps') ok(held11, 'no star: the join steps stays home', why11);
    else if (c[0] === 'a relay event of the monitor, a post') ok(held11, 'no star: a relay event of the monitor, a post stays home', why11);
    else if (c[0] === 'a relay event of the monitor, a reply') ok(held11, 'no star: a relay event of the monitor, a reply stays home', why11);
    else if (c[0] === 'a relay event of the monitor, a refusal') ok(held11, 'no star: a relay event of the monitor, a refusal stays home', why11);
    else if (c[0] === 'a relay\'s status') ok(held11, 'no star: a relay\'s status stays home', why11);
  });

  test.subHeading('box v29: a face with no star gets nothing, not even the file tree');
  const today = [['the file tree', 'job-updated', { id: 'spirit.fs', kind: 'permanent', status: 'running', data: { command: { op: 'zz' } } }],
    ['a row of the one table', 'job-updated', { id: 'spirit.contact', kind: 'permanent', status: 'running', data: { row: 1 } }],
    ['a contact renamed', 'contact.rename', { key: 'K', name: 'zz' }]];
  today.forEach(function (c) {
    sx.emit(c[1], c[2]);
    const held10 = sx.got(PLAIN, c[1], c[2]) === 0;
    const why10 = 'no star: ' + c[0] + ' arrived ' + sx.got(PLAIN, c[1], c[2]) + ' times';
    if (c[0] === 'the file tree') ok(held10, 'no star: the file tree stays home', why10);
    else if (c[0] === 'a row of the one table') ok(held10, 'no star: a row of the one table stays home', why10);
    else if (c[0] === 'a contact renamed') ok(held10, 'no star: a contact renamed stays home', why10);
    const held9 = sx.got(STARRED, c[1], c[2]) === 1;
    const why9 = 'starred: ' + c[0] + ' arrived ' + sx.got(STARRED, c[1], c[2]) + ' times';
    if (c[0] === 'the file tree') ok(held9, 'starred: the file tree arrives, once', why9);
    else if (c[0] === 'a row of the one table') ok(held9, 'starred: a row of the one table arrives, once', why9);
    else if (c[0] === 'a contact renamed') ok(held9, 'starred: a contact renamed arrives, once', why9);
  });
  // An owner's event reaches a face by the node's dispatcher alone (ownerEvent went with the half face, box v29): one line.
  const minted = { kind: 'invite-minted', relay: STARRED, invite: 'zz' };
  sx.emit('relay-event', minted);
  ok(sx.got(STARRED, 'relay-event', minted) === 1, 'starred: an owner\'s relay event arrives once', 'starred: an owner\'s relay event arrived ' + sx.got(STARRED, 'relay-event', minted) + ' times');
  ok(sx.got(PLAIN, 'relay-event', minted) === 0, 'no star: an owner\'s relay event stays home', 'no star: an owner\'s relay event arrived ' + sx.got(PLAIN, 'relay-event', minted) + ' times');

  test.subHeading('goal/G41.33: only true is a star, the star counts at each event, and it sends no catch-up');
  const loose2 = streams(function () { return 'yes'; });
  loose2.home.open(STARRED, '');
  await settle();
  loose2.emit('job-deleted', 'job_1');
  ok(loose2.got(STARRED, 'job-deleted', 'job_1') === 0, 'a truthy answer is no star: nothing arrives', 'faceOwned answering "yes" opened the stream');
  let pressed = false;
  const sw = streams(function () { return pressed; });
  sw.home.open(STARRED, '');
  await settle();
  sw.emit('job-deleted', 'job_before');
  ok(sw.got(STARRED, 'job-deleted', 'job_before') === 0, 'before the star: nothing', 'before the star, a job deleted arrived');
  pressed = true;
  await settle();
  const atPress = sw.lines(STARRED).length;
  sw.emit('job-deleted', 'job_on');
  ok(sw.got(STARRED, 'job-deleted', 'job_on') === 1, 'the star pressed with the face open: the next event arrives, no reopening', 'the star was pressed and the next event did not arrive');
  ok(sw.got(STARRED, 'job-deleted', 'job_before') === 0 && sw.lines(STARRED).length === atPress + 1, 'and no catch-up: what went before it never comes', 'pressing the star sent a catch-up: ' + short(sw.lines(STARRED)));
  pressed = false;
  sw.emit('job-deleted', 'job_off');
  ok(sw.got(STARRED, 'job-deleted', 'job_off') === 0, 'the star taken off: the next event stays home, at once', 'the star came off and a job deleted still reached the face');

  test.subHeading('goal/G41.33: a starred face that opens gets what a loopback page gets on connect');
  // event.js handleSubscribe: "snapshot", { jobs: o.jobs.listJobs() }. The envelope is the builder's; the jobs are the box's.
  const sn = streams(starAt);
  sn.jobs = [jobEvents[0][2], jobEvents[4][2], jobEvents[5][2], jobEvents[6][2], jobEvents[8][2]];
  sn.home.open(STARRED, '');
  sn.home.open(PLAIN, '');
  await settle();
  const onWire = function (url, id) { return JSON.stringify(sn.lines(url)).indexOf('"id":"' + id + '"') !== -1; };
  sn.jobs.forEach(function (j) {
    const held8 = onWire(STARRED, j.id);
    const why8 = 'starred, on opening: job ' + j.type + ' is not on the stream, a loopback page has it';
    if (j.id === 'spirit.auth') ok(held8, 'starred, on opening: the job spirit.auth is there', why8);
    else if (j.id === 'spirit.app.zz') ok(held8, 'starred, on opening: the job spirit.app.zz is there', why8);
    else if (j.id === 'spirit.app.zzOther') ok(held8, 'starred, on opening: the job spirit.app.zzOther is there', why8);
    else if (j.id === 'spirit.zzNeverSeen') ok(held8, 'starred, on opening: the job spirit.zzNeverSeen is there', why8);
    else if (j.id === 'spirit') ok(held8, 'starred, on opening: the job spirit is there', why8);
    const held7 = !onWire(PLAIN, j.id);
    const why7 = 'no star, on opening: job ' + j.type + ' reached the face';
    if (j.id === 'spirit.auth') ok(held7, 'no star, on opening: the job spirit.auth is not', why7);
    else if (j.id === 'spirit.app.zz') ok(held7, 'no star, on opening: the job spirit.app.zz is not', why7);
    else if (j.id === 'spirit.app.zzOther') ok(held7, 'no star, on opening: the job spirit.app.zzOther is not', why7);
    else if (j.id === 'spirit.zzNeverSeen') ok(held7, 'no star, on opening: the job spirit.zzNeverSeen is not', why7);
    else if (j.id === 'spirit') ok(held7, 'no star, on opening: the job spirit is not', why7);
  });

  test.subHeading('goal/G41.33: the queue does not change, and it loses none of the new ones');
  const q = streams(starAt);
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
  ok(whileBusy === 1, 'one write at a time: the rest wait for the sink', 'the sink was busy and ' + whileBusy + ' writes went');
  ok(q.got(STARRED, 'job-deleted', 'job_while_busy') === 1 && q.got(STARRED, 'job-updated', jobEvents[0][2]) === 1 && q.got(STARRED, 'relay-event', jobEvents[9][2]) === 1, 'after the drain every waiting event has gone out', 'after the drain the waiting events were lost: ' + short(q.lines(STARRED)));
  const P = require(path.join(RUN, 'spirit', 'faceHome.js')).FACE_PRIORITY;
  ok(JSON.stringify(P) === JSON.stringify(PRIORITIES_TODAY), 'the queue\'s levels are as they were', 'the queue\'s levels changed: ' + short(P));

  test.subHeading('goal/G41.33: a starred face has no restrictions at all, except changing stars');
  const free = world(onlyMine, onlyMine);
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
  ok(!shut.length, 'every verb of every family reaches the door, unsealed and sealed', shut.length + ' still refused; first: ' + shut.slice(0, 3).join(' | '));
  const THROUGH = { call: 'relay.face', args: { url: MINE, name: 'zz' } };
  const FACE_POST = { call: 'peer.post', args: { to: 'RELAYKEY', text: JSON.stringify({ body: { face: 'zz' } }) } };
  for (const c of [['relay.face on the relay it is called through', THROUGH], ['a peer.post to that relay carrying a face name', FACE_POST]]) {
    for (const form of [['unsealed', c[1]], ['sealed', sealed(c[1])]]) {
      const on = await send(free, MINE, form[1]);
      const held6 = on.reached.indexOf(c[1].call) !== -1;
      const why6 = 'starred, ' + form[0] + ': ' + c[0] + ': ' + said(on);
      if (form[0] + ', ' + c[0] === 'unsealed, relay.face on the relay it is called through') ok(held6, 'starred, unsealed, relay.face on the relay it is called through, reaches the door', why6);
      else if (form[0] + ', ' + c[0] === 'sealed, relay.face on the relay it is called through') ok(held6, 'starred, sealed, relay.face on the relay it is called through, reaches the door', why6);
      else if (form[0] + ', ' + c[0] === 'unsealed, a peer.post to that relay carrying a face name') ok(held6, 'starred, unsealed, a peer.post to that relay carrying a face name, reaches the door', why6);
      else if (form[0] + ', ' + c[0] === 'sealed, a peer.post to that relay carrying a face name') ok(held6, 'starred, sealed, a peer.post to that relay carrying a face name, reaches the door', why6);
      const off = await send(world(onlyMine, function () { return false; }), MINE, form[1]);
      const held5 = !off.reached.length && refused(off);
      const why5 = 'no star, ' + form[0] + ': ' + c[0] + ': ' + said(off);
      if (form[0] + ', ' + c[0] === 'unsealed, relay.face on the relay it is called through') ok(held5, 'no star, unsealed, relay.face on the relay it is called through, stays refused', why5);
      else if (form[0] + ', ' + c[0] === 'sealed, relay.face on the relay it is called through') ok(held5, 'no star, sealed, relay.face on the relay it is called through, stays refused', why5);
      else if (form[0] + ', ' + c[0] === 'unsealed, a peer.post to that relay carrying a face name') ok(held5, 'no star, unsealed, a peer.post to that relay carrying a face name, stays refused', why5);
      else if (form[0] + ', ' + c[0] === 'sealed, a peer.post to that relay carrying a face name') ok(held5, 'no star, sealed, a peer.post to that relay carrying a face name, stays refused', why5);
    }
  }
  for (const own of [true, false]) {
    const c = { call: 'contact.own', args: { key: 'K', own: own } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
      const a = await send(free, MINE, form[1]);
      const held4 = !a.reached.length && refused(a);
      const why4 = 'contact.own ' + own + ' from a starred face, ' + form[0] + ': ' + said(a);
      if (own + ', ' + form[0] === 'true, unsealed') ok(held4, 'changing stars stays home: own true, unsealed, refused', why4);
      else if (own + ', ' + form[0] === 'true, sealed') ok(held4, 'changing stars stays home: own true, sealed, refused', why4);
      else if (own + ', ' + form[0] === 'false, unsealed') ok(held4, 'changing stars stays home: own false, unsealed, refused', why4);
      else if (own + ', ' + form[0] === 'false, sealed') ok(held4, 'changing stars stays home: own false, sealed, refused', why4);
    }
  }
}

// THE STAR PART, once faceHome-star.js.
async function starPart() {
  // Once spirit/run/spirit/test/faceHome-star.js.
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

  const os = require('os');
  const http = require('http');
  const { scratchNode, scratchFaceRelay, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  const WAIT_MS = 1500;
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
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
  const refused = function (a) { return a.status >= 400 && a.status < 500; };

  test.subHeading('faceHome-star: the star on a real node, a real relay and a real face (goal/G41.30)');

  await (async function () {
    const marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-star-marks-'));
    const relays = [];
    const N = await scratchNode();
    try {
      if (!N.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
      const run = path.join(N.root, 'spirit', 'run');
      const card = await home(N.base, 'node.card');
      const me = card.body && card.body.publicKey;
      ok(!!me, 'the node says its key', 'node.card: ' + short(card.text));
      if (!me) return;

      // An app this node runs (its json says node run true, goal/G43.20): it leaves a mark only when started with the word a
      // face call gives it. Not intrinsic, so a file of its folder may be saved.
      const mark = path.join(marks, 'ran');
      const script = path.join(run, 'spirit/app/zzStar/zzStar.js');
      fs.mkdirSync(path.dirname(script), { recursive: true });
      fs.writeFileSync(script, 'if (process.argv[2] === "fromTheFace") require("fs").writeFileSync(' + JSON.stringify(mark) + ', "ran");\n');
      fs.writeFileSync(path.join(run, 'spirit/app/zzStar/zzStar.json'), JSON.stringify({ identity: { label: 'zz', intrinsic: false }, node: { run: true } }));
      const SAVED = 'spirit/app/zzStar/saved.txt';
      const savedAt = path.join(run, SAVED);
      const JOB = { call: 'job.create', args: { command: process.execPath, args: ['spirit/app/zzStar/zzStar.js', 'fromTheFace'] } };
      const SAVE = { call: 'fs.save', args: { path: SAVED, content: 'from the face' } };
      const nobody = 'MCowBQYDK2VwAyEA' + 'zzStarNobodyzzStarNobodyzzStarNobodyzzStarNob'.slice(0, 43) + '=';
      const OWNER = { call: 'owner.command', args: { to: nobody, command: 'zzNothing' } };

      // ── A RELAY OF SOMEBODY ELSE'S, A FACE THIS NODE ASKED FOR ──
      const R = await scratchFaceRelay({ members: [] });
      relays.push(R);
      ok(R.up, 'a real relay comes up', 'the scratch relay did not come up: nothing judged');
      if (!R.up) return;
      const why1 = await join(N, R) || await setFace(N, R, 'harbour');
      ok(!why1, 'the node joins it by its mail and sets a face', 'the join or the face failed, nothing judged: ' + why1);
      if (why1) return;
      const L = await logIn(R, 'harbour');
      ok(!!L.sid, 'the face logs in by the mailed token', 'the login failed, nothing judged: ' + L.why);
      if (!L.sid) return;
      const face = function (req) { return page(R, 'harbour', '/face/call', req, L.sid); };
      const starOf = async function (key) { const a = await home(N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === key; })); };

      test.subHeading('box v29: no star, no face: "The home node answers a face only from a starred relay"');
      ok(!(await starOf(R.relayKey)), 'the relay has no star', 'the relay has a star nobody pressed');
      // Not even the plainest read: there is no half face left to answer.
      for (const q of [{ call: 'node.card', args: {} }, { call: 'fs.stat', args: { path: 'spirit/fs/data.js' } }, { call: 'contact.search', args: { q: '' } }, JOB, SAVE, OWNER]) {
        const a = await face(q);
        const held3 = refused(a);
        const why3 = q.call + ' from the face on a relay with no star: ' + a.status + ' ' + short(a.text);
        if (q.call === 'node.card') ok(held3, 'with no star, node.card from the face is refused', why3);
        else if (q.call === 'fs.stat') ok(held3, 'with no star, fs.stat from the face is refused', why3);
        else if (q.call === 'contact.search') ok(held3, 'with no star, contact.search from the face is refused', why3);
        else if (q.call === 'job.create') ok(held3, 'with no star, job.create from the face is refused', why3);
        else if (q.call === 'fs.save') ok(held3, 'with no star, fs.save from the face is refused', why3);
        else if (q.call === 'owner.command') ok(held3, 'with no star, owner.command from the face is refused', why3);
      }
      await sleep(WAIT_MS);
      ok(!fs.existsSync(mark), 'the job did not run', 'job.create from the face RAN, with no star');
      ok(!fs.existsSync(savedAt), 'the file was not written', 'fs.save from the face WROTE a file, with no star');

      test.subHeading('the star on, pressed at home: everything is back');
      const on = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
      ok(on.status === 200 && (await starOf(R.relayKey)), 'contact.own at home puts the star on the relay\'s row', 'contact.own at home: ' + on.status + ' ' + short(on.text));
      const o1 = await face(OWNER);
      test.comment('owner.command, starred, answered ' + o1.status + ' ' + short(o1.text));
      ok(o1.status !== 0 && !/not-from-the-face|no-face-here/.test(o1.text), 'owner.command from the face reaches the door', 'owner.command on a starred relay: ' + o1.status + ' ' + short(o1.text));
      const s1 = await face(SAVE);
      ok(s1.status >= 200 && s1.status < 300 && fs.existsSync(savedAt), 'fs.save from the face writes the file', 'fs.save on a starred relay: ' + s1.status + ' ' + short(s1.text) + ', file ' + fs.existsSync(savedAt));
      const j1 = await face(JOB);
      await until(function () { return fs.existsSync(mark); }, 5000);
      ok(j1.status === 201 && fs.existsSync(mark), 'job.create of an included process runs it', 'job.create on a starred relay: ' + j1.status + ' ' + short(j1.text) + ', ran ' + fs.existsSync(mark));
      const shMark = path.join(marks, 'sh');
      const sh = await face({ call: 'job.create', args: { command: '/bin/sh', args: ['-c', 'echo x > ' + shMark] } });
      await sleep(WAIT_MS);
      ok(sh.status >= 400 && sh.status < 500 && !fs.existsSync(shMark), 'and /bin/sh is still refused, starred or not', '/bin/sh from a starred face: ' + sh.status + ' ' + short(sh.text) + ', ran ' + fs.existsSync(shMark));
      const self = await face({ call: 'contact.own', args: { key: R.relayKey, own: false } });
      ok(self.status >= 400 && self.status < 500 && (await starOf(R.relayKey)), 'contact.own from the face is refused even here: the star stays', 'contact.own from a starred face: ' + self.status + ' ' + short(self.text) + ', star ' + (await starOf(R.relayKey)));

      test.subHeading('box v29: "A star taken off a relay that has a face takes that face away (Q21)"');
      fs.rmSync(savedAt, { force: true }); fs.rmSync(mark, { force: true });
      const faceName = async function (base) { const g = await home(N.base, 'relay.get', { key: base }); const r = g.body && g.body.relay; return r && r.face && typeof r.face === 'object' ? String(r.face.name || '') : String((r && r.face) || ''); };
      const before = await faceName(R.base);
      ok(!!before, 'the world: the node holds a face on the relay', 'the node holds no face on the relay before the star comes off: nothing judged');
      const off = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
      ok(off.status === 200 && !(await starOf(R.relayKey)), 'contact.own at home takes the star away', 'contact.own false at home: ' + off.status + ' ' + short(off.text));
      ok(!!before && await until(function () { return faceName(R.base).then(function (n) { return n === ''; }); }, 8000), 'and the node holds no face on that relay any more', 'the star came off and the node still holds ' + short(await faceName(R.base)));
      for (const q of [{ call: 'node.card', args: {} }, JOB, SAVE, OWNER]) {
        const a = await face(q);
        const held2 = refused(a);
        const why2 = q.call + ' after the star came off: ' + a.status + ' ' + short(a.text);
        if (q.call === 'node.card') ok(held2, 'the star off, node.card through it is refused', why2);
        else if (q.call === 'job.create') ok(held2, 'the star off, job.create through it is refused', why2);
        else if (q.call === 'fs.save') ok(held2, 'the star off, fs.save through it is refused', why2);
        else if (q.call === 'owner.command') ok(held2, 'the star off, owner.command through it is refused', why2);
      }
      await sleep(WAIT_MS);
      ok(!fs.existsSync(mark) && !fs.existsSync(savedAt), 'nothing ran, nothing was written', 'after the star came off: ran ' + fs.existsSync(mark) + ', saved ' + fs.existsSync(savedAt));
      await home(N.base, 'contact.own', { key: R.relayKey, own: true });
      const back = await face({ call: 'node.card', args: {} });
      ok(refused(back), 'the star put back opens nothing: the face is gone, not hidden', 'the star back on, node.card through the old face: ' + back.status + ' ' + short(back.text));

      // ── GOAL/G41.33, ON THE REAL STREAM ──
      // "anything andy gets on his loopback screen, he can get on his face, if he "stars" any relay"; "NO RESTRICTIONS AT
      // ALL, except changing stars"; "Pressing the star sends no catch-up". Without the star the face gets nothing (box v29,
      // above). What a page reads from /face/stream, with its cookie, unsealed as a page that cannot seal.
      test.subHeading('the real stream: without the star it carries nothing; with it, a job, a bundle and the join steps');
      const S = await scratchFaceRelay({ members: [] });
      relays.push(S);
      const why4 = !S.up ? 'the relay did not come up' : (await join(N, S) || await setFace(N, S, 'stream'));
      ok(!why4, 'a relay for the stream: joined, a face set', 'nothing judged: ' + why4);
      const LS = why4 ? {} : await logIn(S, 'stream');
      if (!why4) ok(!!LS.sid, 'the face logs in', 'the login failed, nothing judged: ' + LS.why);
      if (LS.sid) {
        const got = [];
        let heldStream = '';
        const q = http.request({ host: '127.0.0.1', port: S.port, path: '/face/stream', method: 'GET', headers: { Host: 'stream.relay.example', Cookie: 'spirit_face=' + LS.sid } }, function (r) {
          r.setEncoding('utf8');
          r.on('data', function (d) { heldStream += d; const parts = heldStream.split('\n'); heldStream = parts.pop(); parts.filter(Boolean).forEach(function (l) { got.push(l); }); });
        });
        q.on('error', function () { /* the stream ends with the relay */ });
        q.end();
        const hears = function (word) { return got.some(function (l) { return l.indexOf(word) !== -1; }); };
        const heardEvent = function (kind, id) { return got.some(function (l) { const v = parsed(l); return !!v && v.event === kind && (kind === 'job-deleted' ? v.data === id : !!v.data && v.data.id === id); }); };
        await sleep(3000);
        // Box v29: no star, the node answers the face nothing, so no file tree, no presence, no job.
        ok(!hears('spirit.fs') && !hears('presence'), 'no star: the stream carries nothing of the node, not even its file tree', 'no star: the stream said ' + short(got.slice(0, 3)));

        // One failed job, to delete: a process that ends with an exit code of its own stays until it is deleted.
        const script2 = path.join(run, 'spirit/app/zzStream/zzStream.js');
        fs.mkdirSync(path.dirname(script2), { recursive: true });
        fs.writeFileSync(script2, 'setTimeout(function () { process.exit(4); }, 300);\n');
        fs.writeFileSync(path.join(run, 'spirit/app/zzStream/zzStream.json'), JSON.stringify({ identity: { label: 'zz', intrinsic: false }, node: { run: true } }));
        const runOne = async function () {
          const c = await home(N.base, 'job.create', { command: process.execPath, args: ['spirit/app/zzStream/zzStream.js'] });
          const id = c.body && c.body.id;
          if (!id) return { why: 'job.create at home: ' + c.status + ' ' + short(c.text) };
          await until(function () { return home(N.base, 'job.get', { key: id }).then(function (a) { const j = a.body && a.body.job; return !!j && j.status === 'failed'; }); }, 8000);
          const d = await home(N.base, 'job.delete', { id: id });
          return d.status < 300 ? { id: id } : { why: 'job.delete at home: ' + d.status + ' ' + short(d.text) };
        };
        const bundle = function (label) { return home(N.base, 'auth.bundle', { op: 'add', label: label, text: 'zz' }); };

        const j0 = await runOne();
        ok(!!j0.id, 'no star: a job runs and is deleted at home', 'nothing judged: ' + j0.why);
        const b0 = await bundle('zzBefore');
        ok(b0.status < 300, 'no star: a bundle is added at home', 'auth.bundle at home: ' + b0.status + ' ' + short(b0.text));
        await sleep(WAIT_MS);
        ok(!!j0.id && !hears(j0.id), 'no star: the job never reaches the face', 'no star: job ' + j0.id + ' reached the face');
        ok(!hears('zzBefore'), 'no star: the bundle never reaches the face', 'no star: the bundle reached the face');

        const sOn = await home(N.base, 'contact.own', { key: S.relayKey, own: true });
        ok(sOn.status === 200, 'the star on, at home, the stream still open', 'contact.own at home: ' + sOn.status + ' ' + short(sOn.text));
        await sleep(WAIT_MS);
        ok(!!j0.id && !hears(j0.id) && !hears('zzBefore'), 'no catch-up: what went before the star does not come', 'pressing the star sent what went before it');

        const j1b = await runOne();
        ok(!!j1b.id, 'starred: a job runs and is deleted at home', 'nothing judged: ' + j1b.why);
        await until(function () { return heardEvent('job-deleted', j1b.id); }, 5000);
        ok(!!j1b.id && heardEvent('job-updated', j1b.id), 'starred: the running job reaches the face', 'starred: job ' + j1b.id + ' never reached the face');
        ok(!!j1b.id && heardEvent('job-deleted', j1b.id), 'starred: the job deleted reaches the face', 'starred: job-deleted ' + j1b.id + ' never reached the face');
        const b1 = await bundle('zzAfter');
        await until(function () { return hears('zzAfter'); }, 5000);
        ok(b1.status < 300 && hears('zzAfter'), 'starred: the bundle reaches the face', 'starred: the bundle never reached the face: ' + b1.status + ' ' + short(b1.text));

        // The join steps are published only when their facts change (joinStepsJob.js): this node's first contact, here a key
        // it blocks, makes "contact" true.
        const someone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zz').publicKey;
        const blocked = await home(N.base, 'contact.block', { publicKey: someone });
        ok(blocked.status < 300, 'starred: a first contact appears at home', 'nothing judged: contact.block answered ' + blocked.status + ' ' + short(blocked.text));
        await until(function () { return hears('"join":'); }, 5000);
        ok(hears('"join":'), 'starred: the join steps reach the face, the join news of the spirit job', 'starred: the join news never reached the face');

        test.subHeading('a starred face has no restrictions, except changing stars');
        const sface = function (req) { return page(S, 'stream', '/face/call', req, LS.sid); };
        const rOff = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
        ok(rOff.status === 200, 'the world: the first relay\'s star off again', 'contact.own false at home: ' + rOff.status);
        const anotherStar2 = await sface({ call: 'contact.own', args: { key: R.relayKey, own: true } });
        ok(refused(anotherStar2) && !(await starOf(R.relayKey)), 'starring another relay from it is refused, and no star lands', 'contact.own of another relay from a starred face: ' + anotherStar2.status + ' ' + short(anotherStar2.text) + ', star ' + (await starOf(R.relayKey)));
        const ownOff = await sface({ call: 'contact.own', args: { key: S.relayKey, own: false } });
        ok(refused(ownOff) && (await starOf(S.relayKey)), 'taking its own star off from it is refused, and the star stays', 'contact.own false from a starred face: ' + ownOff.status + ' ' + short(ownOff.text) + ', star ' + (await starOf(S.relayKey)));

        // Last, since it takes the page's address away: the face you call through, renamed through it, on a star.
        const renamed = await sface({ call: 'relay.face', args: { url: S.base, name: 'renamed' } });
        ok(!/not-from-the-face/.test(renamed.text) && renamed.status < 400, 'starred: relay.face on the relay it is called through is not refused by the face\'s rule', 'relay.face through a starred face: ' + renamed.status + ' ' + short(renamed.text));
        const moved = await until(function () { return page(S, 'renamed', '/face/api', { call: 'state', args: {} }).then(function (a) { return a.status === 200; }); }, 8000);
        ok(!!moved, 'and the face has its new name on the relay', 'after relay.face through a starred face, renamed.relay.example does not answer');
        // The star off with the stream open: the face goes, so the next event stays home.
        const sOff = await home(N.base, 'contact.own', { key: S.relayKey, own: false });
        ok(sOff.status === 200, 'the star off, at home', 'contact.own false at home: ' + sOff.status + ' ' + short(sOff.text));
        // A job's id is its route, the same for every run (goal/G43.20): only what the stream says from here on is judged.
        const sinceOff = got.length;
        const j2b = await runOne();
        await sleep(WAIT_MS);
        ok(!!j2b.id && !got.slice(sinceOff).some(function (l) { return l.indexOf(j2b.id) !== -1; }), 'the star off: the next job stays home', 'the star came off and job ' + j2b.id + ' still reached the face');
        ok(await until(function () { return faceName(S.base).then(function (n) { return n === ''; }); }, 8000), 'and on the real stream, the node holds no face on that relay any more', 'the star came off and the node still holds ' + short(await faceName(S.base)));

        try { q.destroy(); } catch (e) { /* gone */ }
      }

      // ── A RELAY THAT SAYS THIS NODE OWNS IT ──
      test.subHeading('a relay\'s claim changes nothing: it says this node owns it, and no star is pressed');
      // The face is set first, as a member, then the owner mark goes in: relay.face on a relay that already owns this node
      // answers no text today, so the node cannot read it (a fault of its own, reported, not this rule's).
      const O = await scratchFaceRelay({ members: [] });
      relays.push(O);
      let why2 = !O.up ? 'the relay did not come up' : (await join(N, O) || await setFace(N, O, 'mine'));
      if (!why2 && !(await O.becomeOwned(me))) why2 = 'the relay did not come back with this node as its owner';
      ok(!why2, 'a relay whose owner mark is this node\'s key: joined, a face set', 'nothing judged: ' + why2);
      if (!why2) {
        let report = null;
        await until(function () { return home(N.base, 'relay.get', { key: O.base }).then(function (a) { report = a.body && a.body.report; return !!(report && Object.keys(report).length); }); }, 20000);
        ok(!!(report && Object.keys(report).length), 'the relay has sent this node its owner\'s report', 'no owner\'s report came: the claim was never made, so nothing is judged');
        ok(!(await starOf(O.relayKey)), 'its report sets no star', 'the relay\'s own report put a star on its row');
        const L2 = await logIn(O, 'mine');
        ok(!!L2.sid, 'the face logs in there', 'the login failed, nothing judged: ' + L2.why);
        if (L2.sid) {
          const a = await page(O, 'mine', '/face/call', OWNER, L2.sid);
          ok(refused(a), 'owner.command from that face is refused: the relay\'s word opens nothing', 'owner.command on a relay that only claims this node: ' + a.status + ' ' + short(a.text));
        }
      }

      // ── A RELAY WHERE THIS NODE SET NO FACE ──
      test.subHeading('a relay where this node set no face gets nothing, whatever it does');
      const D = await scratchFaceRelay({ members: [] });
      relays.push(D);
      const why3 = !D.up ? 'the relay did not come up' : await join(N, D);
      ok(!why3, 'a third relay: joined, and no face asked for', 'nothing judged: ' + why3);
      if (!why3) {
        // The dishonest relay: it gives the member a face on its own, so it can send this node face events.
        D.setFace(me, 'forged', MAIL);
        await sleep(300);
        const L3 = await logIn(D, 'forged');
        ok(!!L3.sid, 'the relay has made a face this node never asked for, and logged in to it', 'the forged face could not log in, nothing judged: ' + L3.why);
        if (L3.sid) {
          for (const q of [{ call: 'node.card', args: {} }, JOB]) {
            const a = await page(D, 'forged', '/face/call', q, L3.sid);
            const held1 = a.status === 403 && a.body && a.body.code === 'no-face-here';
            const why1 = q.call + ' on a relay where this node set no face: ' + a.status + ' ' + short(a.text);
            if (q.call === 'node.card') ok(held1, 'node.card through it is refused, no-face-here', why1);
            else if (q.call === 'job.create') ok(held1, 'job.create through it is refused, no-face-here', why1);
          }
          const on3 = await home(N.base, 'contact.own', { key: D.relayKey, own: true });
          const a3 = await page(D, 'forged', '/face/call', JOB, L3.sid);
          ok(on3.status === 200 && a3.status === 403 && a3.body && a3.body.code === 'no-face-here', 'and a star does not open it: no face of mine, nothing', 'starred, no face set: ' + on3.status + ', ' + a3.status + ' ' + short(a3.text));
        }
      }
      await sleep(WAIT_MS);
      ok(!fs.existsSync(mark), 'no job ran through any of this', 'a job ran through a relay that had no right to it');
    } finally {
      relays.forEach(function (r) { try { r.stop(); } catch (e) { /* gone */ } });
      try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
      try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
      try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

// THE STARAPPS PART, once faceHome-starApps.js.
async function starAppsPart() {
  // Once spirit/run/spirit/test/faceHome-starApps.js.
  // A STAR SHOWS EVERY APP (goal/G41.33, Q9; spec: ./faceHome.md; Andy, of "Should a star show every app on the face, Text Editor and Media Viewer
  // too, or does each app's face mark stay yours to set?": "yes. for now."). What the owner sees is the desktop, so a real
  // Chrome reads it: a real scratch node, a real relay, a real face and its login, at home and on the face. What a face is
  // handed, by its relay's star, is spirit/faceHome.js's, so it is judged beside it (goal/G43.28; Andy: "you WILL FUCKING PLACE
  // TESTS WHERE THEY FUCKING BELONG"; moved from shell/test/navigationWrapper-faceStarApps.js, its relay row section beside
  // the contact row, spirit/element/search/contact/test/rowElement.js, its relayOnFace part). A face at
  // <name>.localhost is a secure context, as a face over https is. A step that could not run is red, never skipped.

  const http = require('http');
  const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  const DOMAIN = 'localhost';
  const NAME = 'apps';
  const MAIL = 'bert@example.org';
  const DRAWN_MS = 6000;
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

  async function home(base, verb, args) {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  }
  function page(relay, p, body) {
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
    await until(function () { return page(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
    const from = R.mailed.length;
    await page(R, '/face/api', { call: 'login', args: { text: MAIL } });
    await until(function () { return R.mailed.length > from; }, 5000);
    const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
    if (!token) return { why: 'the relay mailed no login token' };
    const done = await page(R, '/face/api', { call: 'login', args: { text: token } });
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

  test.subHeading('faceHome-starApps: a star shows every app on the face (goal/G41.33, Q9)');

  await (async function () {
    const N = await scratchNode();
    const R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
    let chrome = null;
    try {
      if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
      const F = await faceOf(N, R);
      ok(!!F.sid, 'a real node has a real face, logged in', 'nothing judged: ' + F.why);
      if (!F.sid) return;
      const where = findChrome();
      if (!where) { test.fail('no Chrome here: nothing judged'); return; }
      chrome = await chromePage(where);
      if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
      const FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';
      const set = await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
      ok(!!(set.result && set.result.success), 'the browser holds the login', 'the browser would not take the cookie: ' + short(set));

      const atHome = await desktop(chrome, N.base + '/');
      test.comment('at home: ' + atHome.join(', '));
      ok(atHome.indexOf('Text Editor') !== -1 && atHome.indexOf('Media Viewer') !== -1, 'at home the desktop shows Text Editor and Media Viewer', 'at home they are not there, nothing judged: ' + short(atHome));

      test.subHeading('no star: each app\'s face mark decides, as today');
      const plain = await desktop(chrome, FACE);
      test.comment('no star: ' + plain.join(', '));
      ok(plain.indexOf('Contacts') !== -1, 'the face\'s desktop is drawn', 'the face drew no desktop, nothing judged: ' + short(plain));
      ok(plain.indexOf('Text Editor') === -1 && plain.indexOf('Media Viewer') === -1, 'Text Editor and Media Viewer are not on it', 'with no star the face shows them: ' + short(plain));

      // WHO PAINTS, LISTENS (goal/G41.32; Andy: "every row's data, wherever it's visible OR invisible must update instantly, and
      // when visible, paint immediately."; "does a star change at home stream to the face????"): the page stays open, no reload.
      test.subHeading('the star pressed at home, the face open: its desktop follows, with no reload');
      const namesNow = async function () { return String(await chrome.evaluate('document.body.innerText')).split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); }); };
      await chrome.evaluate('window.__sameLoad = true; 1');
      const live = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
      ok(live.status === 200, 'the star on, at home', 'contact.own: ' + live.status + ' ' + short(live.text));
      await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') !== -1 && n.indexOf('Media Viewer') !== -1; }); }, 8000);
      const onLive = await namesNow();
      ok(onLive.indexOf('Text Editor') !== -1 && onLive.indexOf('Media Viewer') !== -1, 'Text Editor and Media Viewer come at once', 'the open face shows: ' + short(onLive));
      const liveOff = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
      ok(liveOff.status === 200, 'with its desktop open, the star off, at home', 'contact.own false: ' + liveOff.status + ' ' + short(liveOff.text));
      await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') === -1 && n.indexOf('Media Viewer') === -1; }); }, 8000);
      const offLive = await namesNow();
      const cameLive = onLive.indexOf('Text Editor') !== -1 && onLive.indexOf('Media Viewer') !== -1;
      ok(cameLive && offLive.indexOf('Contacts') !== -1 && offLive.indexOf('Text Editor') === -1 && offLive.indexOf('Media Viewer') === -1, 'and go at once', cameLive ? 'the open face shows: ' + short(offLive) : 'they never came: nothing judged');
      ok((await chrome.evaluate('window.__sameLoad === true')) === true, 'all on the one load of the page', 'the page reloaded itself');

      test.subHeading('the star: every app the home desktop shows');
      const on = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
      ok(on.status === 200, 'for every app: the star on, at home', 'contact.own: ' + on.status + ' ' + short(on.text));
      const starred = await desktop(chrome, FACE);
      test.comment('starred: ' + starred.join(', '));
      const gap = missing(atHome, starred);
      ok(starred.length > 0 && !gap.length, 'every app on the home desktop is on the starred face', 'on the home desktop and not on the starred face: ' + gap.join(', '));
      ok(starred.indexOf('Join') === -1, 'and Join and the login app stay the boot\'s own', 'a boot part became an app icon: ' + short(starred));

      test.subHeading('an app it shows opens');
      const pageErrors = chrome.heard.length;
      const opened = await chrome.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")); var hit = all.filter(function (e) { return e.children.length === 0 && e.textContent.trim() === "Text Editor"; })[0]; if (!hit) return false; hit.click(); return true; }())');
      ok(opened === true, 'its tile is there to press', 'no Text Editor tile to press on the starred face');
      await sleep(DRAWN_MS / 2);
      const threw = chrome.heard.slice(pageErrors).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
      ok(opened === true && !threw.length, 'pressing it throws nothing in the page', opened === true ? 'pressing Text Editor threw: ' + threw.slice(0, 2).join(' | ') : 'nothing was pressed, so nothing is judged');

      test.subHeading('the star off: back to the face marks');
      const off = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
      ok(off.status === 200, 'back to the face marks: the star off, at home', 'contact.own false: ' + off.status + ' ' + short(off.text));
      const again = await desktop(chrome, FACE);
      ok(again.indexOf('Contacts') !== -1 && again.indexOf('Text Editor') === -1 && again.indexOf('Media Viewer') === -1, 'Text Editor and Media Viewer are gone again', 'with the star off the face shows: ' + short(again));
    } finally {
      try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
      try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
      try { R.stop(); } catch (e) { /* gone */ }
      try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
      try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

(async function () {
  try { await ownPart(); } catch (e) { test.fail('the test threw ' + (e && e.stack || e)); }
  for (const p of [['star', starPart], ['starApps', starAppsPart]]) {
    try { await p[1](); } catch (e) { test.fail('the ' + p[0] + ' part threw ' + (e && e.stack || e)); }
  }
  test.reportSuccessFailureCount();
  process.exit(0);
}());
