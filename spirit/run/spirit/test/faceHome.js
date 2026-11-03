'use strict';

// spirit/run/spirit/test/faceHome.js
// The tests of spirit/faceHome.js, and of no other module (spec: ./faceHome.md). This file holds goal/G41.30, the review's
// RC1: "any relay a node is connected to can run every owner verb on that node by sending a face event", and Andy's Q3,
// "Shall we fix RC1, RC2, RH1, RH3 and RH4 in this item, taking jobs, fs, fileServer and net.fetch off the face until
// faces can prove they are the owner?" "yes.". createFaceHome runs on stand-ins that keep what reached them: the door
// (o.call), the file route, the save and the annotate. An answer is read from the stand-in upload, sealed or not.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
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

// THE OPTION THE FIX NEEDS: faceSet(url), true when this node set a face on that relay (none exists today; see the spec).
function world(faceSet, faceOwned) {
  const w = { calls: [], files: [], saved: [], annotated: [], uploads: {} };
  const o = {
    call: function (v, a) { w.calls.push(v); return Promise.resolve({ status: 200, body: { ok: true } }); },
    serveFile: function (rel, res) { w.files.push(rel); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('file'); },
    saveFrom: function (work, rel) { w.saved.push(rel); return { ok: true }; },
    annotateFace: function (rel) { w.annotated.push(rel); return { ok: true }; },
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

(async function () {
  const CARD = { call: 'node.card', args: {} };
  const SHELL = { call: 'jobs.create', args: { command: '/bin/sh', args: ['-c', 'id'] } };

  test.subHeading('a relay where this node set no face gets nothing');
  // The review: "the node never checks that it set a face on that relay, that a face is open, or who asked."; its fix:
  // "accept face* events only from a relay where this node set a face".
  const w = world(onlyMine);
  for (const c of [['an allowed verb', CARD], ['jobs.create with a shell', SHELL], ['the same, sealed', sealed(SHELL)], ['the same, in pieces', pieced(SHELL)]]) {
    const a = await send(w, OTHER, c[1]);
    ok(!a.reached.length, 'from a relay with no face of mine, ' + c[0] + ' never reaches the door', 'from a relay with no face of mine, ' + c[0] + ': ' + said(a));
    ok(refused(a), 'and is answered a refusal with a code', c[0] + ' from a relay with no face of mine was not refused with a code: ' + said(a));
  }
  const file = await send(w, OTHER, { get: 'index.html' });
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

  test.subHeading('the relay where this node set a face works as before');
  const m = world(onlyMine);
  const card = await send(m, MINE, CARD);
  ok(card.reached.indexOf('node.card') !== -1 && card.status === 200, 'node.card reaches the door', 'node.card from my face\'s relay: ' + said(card));
  const cardSealed = await send(m, MINE, sealed(CARD));
  ok(cardSealed.reached.indexOf('node.card') !== -1 && cardSealed.status === 200, 'sealed too', 'sealed node.card from my face\'s relay: ' + said(cardSealed));
  const f = await send(m, MINE, { get: 'index.html' });
  ok(m.files.indexOf('index.html') !== -1 && f.status === 200, 'a file it asks is served (the face loads its parts so)', 'a file from my face\'s relay: files ' + short(m.files) + ', ' + said(f));
  const k = await send(m, MINE, { keys: 1 });
  ok(k.status === 200 && k.body && k.body.publicKey === ME.publicKey, 'the keys are answered', 'keys from my face\'s relay: ' + said(k));
  let streaming = false;
  try { m.home.open(MINE, ''); streaming = !!m.uploads['/api/relay/face/stream']; } catch (e) { streaming = false; }
  ok(streaming, 'face-open starts the stream', 'face-open from my face\'s relay started no stream');
  try { m.home.close(MINE); } catch (e) { /* the stream is the stand-in's */ }

  test.subHeading('even there, jobs, fs, fileServer and net.fetch are off the face');
  // Andy, Q3: "taking jobs, fs, fileServer and net.fetch off the face until faces can prove they are the owner" "yes."
  // Every verb the families declare, and each family's FS group, from their own declarations.
  const allFamilies = function () {
    const dirs = function (d) { return fs.readdirSync(path.join(RUN, d), { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }); };
    return dirs('spirit').filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); })
      .concat(dirs('process/js').filter(function (n) { return fs.existsSync(path.join(RUN, require(path.join(RUN, 'spirit.js')).familyPath(n))); }));
  };
  const verbsOf = function (file) { return Object.keys(require(path.join(RUN, file)).verbs); };
  // The whole FS group, as spirit/introSpector.js declares it, but FS.path: it only names a file in the family's own folder, reading
  // and writing nothing, and the face's lists find their files by it (Andy, of cw's "the red please: every family's FS.path answers
  // from a face with no star, and no other FS verb does": "wsl? red this this?").
  const FS_ALL = (fs.readFileSync(path.join(RUN, 'spirit', 'introSpector.js'), 'utf8').match(/prefix \+ 'FS\.[A-Za-z]+'/g) || []).map(function (x) { return x.replace(/^prefix \+ '|'$/g, ''); });
  ok(FS_ALL.length > 3 && FS_ALL.indexOf('FS.path') !== -1 && FS_ALL.indexOf('FS.deleteFile') !== -1, 'it reads the FS group from its own declaration: ' + FS_ALL.join(', '), 'the FS group read as ' + short(FS_ALL));
  const FS_GROUP = FS_ALL.filter(function (v) { return v !== 'FS.path'; });
  const off = [].concat(
    verbsOf('spirit/jobs/api.js').concat(FS_GROUP).map(function (v) { return 'jobs.' + v; }),
    // fs.annotations stays (Andy, Q4: "fs.annotations stays for the icons" "yes."): the face desktop draws its apps by it.
    verbsOf('spirit/fs/api.js').filter(function (v) { return v !== 'annotations'; }).concat(FS_GROUP).map(function (v) { return 'fs.' + v; }),
    verbsOf(require(path.join(RUN, 'spirit.js')).familyPath('fileServer')).concat(FS_GROUP).map(function (v) { return 'fileServer.' + v; }),
    ['net.fetch'],
    // EVERY FAMILY'S FS GROUP (Andy, Q4: "every FS group off the face" "yes."), the node's own families and each app server's.
    allFamilies().reduce(function (out, fam) { return out.concat(FS_GROUP.map(function (v) { return fam + '.' + v; })); }, []));
  ok(off.length > 15, 'it asks ' + off.length + ' verbs', 'only ' + off.length + ' verbs to ask: it judges nothing');
  const through = [];
  for (const v of off) {
    const c = { call: v, args: { path: 'x', key: 'x', id: 'x' } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)], ['in pieces', pieced(c)]]) {
      const a = await send(m, MINE, form[1]);
      if (a.reached.length || !refused(a)) through.push(v + ' ' + form[0] + ': ' + said(a));
    }
  }
  ok(!through.length, 'all ' + off.length + ' are refused with a code and never reach the door, unsealed, sealed and in pieces', through.length + ' of ' + (off.length * 3) + ' got through; first: ' + through.slice(0, 3).join(' | '));
  const icons = await send(m, MINE, { call: 'fs.annotations', args: { path: 'shell/info/info.js' } });
  ok(icons.reached.indexOf('fs.annotations') !== -1, 'fs.annotations still reaches the door, for the face desktop\'s app icons (boot.js:427)', 'fs.annotations from the face: ' + said(icons));
  const ann = await send(m, MINE, { call: 'fs.annotate', args: { path: 'x', payload: { app: true } } });
  ok(!m.annotated.length && refused(ann), 'fs.annotate writes no sidecar by its side way', 'fs.annotate from the face: annotated ' + short(m.annotated) + ', ' + said(ann));
  const up = await send(m, MINE, { upload: { id: 'abcdefgh', n: 0, of: 1, size: 1, path: 'x.txt', bytes: 'eA==' } });
  ok(!m.saved.length && refused(up), 'a save in parts ({upload}) writes no file', 'a save in parts from the face: saved ' + short(m.saved) + ', ' + said(up));

  // RH2 OF THE REVIEW (Andy: "we fix the red from goal/G41.30 AND all the review items here in this item."; the review:
  // "anyone who reads the owner's mail once logs in on his face", "plus a step-up the node itself asks for before
  // anything that runs code or changes grants."). No step-up exists yet, so what changes grants or the node's keys does
  // not come through a face login at all.
  test.subHeading('a face login alone changes no grant and no key of the node');
  const STEP = ['auth.grant', 'auth.revoke', 'auth.bundle', 'auth.branch', 'node.rotateCipher'];
  const stepped = [];
  for (const v of STEP) {
    const c = { call: v, args: { key: 'x', path: 'x', op: 'add' } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
      const a = await send(m, MINE, form[1]);
      if (a.reached.length || !refused(a)) stepped.push(v + ' ' + form[0] + ': ' + said(a));
    }
  }
  ok(!stepped.length, 'all ' + STEP.length + ' are refused with a code and never reach the door', stepped.length + ' of ' + (STEP.length * 2) + ' got through; first: ' + stepped.slice(0, 3).join(' | '));

  // YOUR FACE ON A RELAY YOU OWN GETS EVERYTHING BACK (Andy: "THIS: The option I recommend: your face on a relay you own
  // gets everything back, jobs, files, grants, puppets, under your login as it is now. On a relay you do not own, the
  // limits stay until G42." "is a compromise i can live with, AND justify to members of relay's I own."). faceOwned(url)
  // says this node owns that relay, from something the node did itself, never the relay's own word.
  test.subHeading('on a relay this node owns, the limits are gone');
  const BACK = ['jobs.create', 'fs.save', 'fileServer.push', 'net.fetch', 'desk.FS.saveFile', 'auth.grant', 'auth.bundle', 'node.rotateCipher'];
  const own = world(onlyMine, onlyMine);
  const held = [];
  for (const v of BACK) {
    const c = { call: v, args: { path: 'x', key: 'x' } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
      const a = await send(own, MINE, form[1]);
      if (a.reached.indexOf(v) === -1) held.push(v + ' ' + form[0] + ': ' + said(a));
    }
  }
  ok(!held.length, 'all ' + BACK.length + ' reach the door, unsealed and sealed', held.length + ' of ' + (BACK.length * 2) + ' still refused; first: ' + held.slice(0, 3).join(' | '));
  const upOwn = await send(own, MINE, { upload: { id: 'abcdefgh', n: 0, of: 1, size: 1, path: 'x.txt', bytes: 'eA==' } });
  ok(!refused(upOwn) || own.saved.length > 0, 'a save in parts goes on there too', 'a save in parts on an owned relay: ' + said(upOwn));

  // PUPPETS TOO (Andy, pasting the review: "owner.command still passes. A face on a relay that isn't starred can send any
  // signed verb to your puppets, and they run it, file writes included. You listed puppets among the things only a starred
  // relay gets back."): the owner family, off the face unless the relay is starred.
  test.subHeading('every family\'s FS.path answers from a face with no star');
  const noStar = world(onlyMine, function () { return false; });
  const pathShut = [];
  for (const fam of allFamilies()) {
    const a = await send(noStar, MINE, { call: fam + '.FS.path', args: { path: 'x' } });
    if (a.reached.indexOf(fam + '.FS.path') === -1) pathShut.push(fam + ': ' + said(a));
  }
  ok(allFamilies().length > 5 && !pathShut.length, 'all ' + allFamilies().length + ' families\' FS.path reach the door, the face\'s lists find their files by it', pathShut.length + ' refused; first: ' + pathShut.slice(0, 2).join(' | '));

  test.subHeading('the owner family goes with the star');
  const ownerVerbs = verbsOf('spirit/owner/api.js');
  ok(ownerVerbs.indexOf('command') !== -1, 'owner.command is a verb to ask', 'the owner family declares: ' + short(ownerVerbs));
  const plainFace = world(onlyMine, function () { return false; });
  const passed = [];
  for (const v of ownerVerbs) {
    const c = { call: 'owner.' + v, args: { key: 'x' } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
      const a = await send(plainFace, MINE, form[1]);
      if (a.reached.length || !refused(a)) passed.push('owner.' + v + ' ' + form[0] + ': ' + said(a));
    }
  }
  ok(!passed.length, 'on a relay that is not starred, all ' + ownerVerbs.length + ' owner verbs are refused and never reach the door', passed.length + ' of ' + (ownerVerbs.length * 2) + ' got through; first: ' + passed.slice(0, 2).join(' | '));
  const starred = await send(own, MINE, { call: 'owner.command', args: { key: 'x' } });
  ok(starred.reached.indexOf('owner.command') !== -1, 'on a starred relay owner.command reaches the door', 'owner.command on a starred relay: ' + said(starred));

  test.subHeading('owning takes the node\'s own word, and a face there');
  const notOwned = world(onlyMine, function () { return false; });
  const a1 = await send(notOwned, MINE, { call: 'jobs.create', args: { command: 'x' } });
  ok(!a1.reached.length && refused(a1), 'a relay this node does not own keeps the limits', 'not owned: ' + said(a1));
  const loose = world(onlyMine, function () { return 'yes'; });
  const a2 = await send(loose, MINE, { call: 'jobs.create', args: { command: 'x' } });
  ok(!a2.reached.length && refused(a2), 'only true is true: a truthy answer owns nothing', 'faceOwned answering "yes": ' + said(a2));
  const noFace = world(function () { return false; }, function () { return true; });
  const a3 = await send(noFace, MINE, { call: 'jobs.create', args: { command: 'x' } });
  ok(!a3.reached.length && refused(a3), 'an owned relay where this node set no face gets nothing', 'owned, no face: ' + said(a3));

  // THE STAR IS SET AT HOME (Andy: "so this button will put the star on relays and puppets. AND take it away."; every
  // contact's panel has it "at home"). From a face, even on a relay this node owns, it would let whoever is in on one
  // face hand the machine to another relay.
  test.subHeading('contact.own never comes through a face');
  const OWN_CALL = { call: 'contact.own', args: { key: 'K', own: true } };
  for (const c of [['a relay this node owns', world(onlyMine, onlyMine)], ['a relay it does not own', world(onlyMine, function () { return false; })]]) {
    for (const form of [['unsealed', OWN_CALL], ['sealed', sealed(OWN_CALL)]]) {
      const a = await send(c[1], MINE, form[1]);
      ok(!a.reached.length && refused(a), 'on ' + c[0] + ', ' + form[0] + ': refused with a code, and it never reaches the door', 'contact.own on ' + c[0] + ', ' + form[0] + ': ' + said(a));
    }
  }

  // GOAL/G41.33. THE BOX: "anything andy gets on his loopback screen, he can get on his face, if he "stars" any relay he's
  // a member of or owns", and "this includes" bundles, branches and grants; a job deleted; running jobs; join steps; relay
  // events. "for a face(relay) without star, the restrictions today stay in place." "for a face(relay) with star, NO
  // RESTRICTIONS AT ALL, except changing stars." Relay events "overrules goal/G30.13". Here o.events is a stand-in, and a
  // relay event comes as server.js:1617 sends it: an owner's event to ownerEvent and to the node's dispatcher, the
  // monitor's to the dispatcher alone.
  const PRIORITIES_TODAY = { fs: 2, presence: 3, app: 4, stats: 5 };
  const STARRED = 'https://a-relay-i-starred.example';
  const PLAIN = 'https://a-relay-with-no-star.example';
  function streams(star) {
    const s = { subs: [], jobs: [], ups: {}, busy: false, drains: [] };
    const o = {
      call: function () { return Promise.resolve({ status: 200, body: { ok: true } }); },
      serveFile: function () {}, saveFrom: function () { return { ok: true }; }, annotateFace: function () { return { ok: true }; },
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
    s.ownerEvent = function (ev) { s.home.ownerEvent(ev); s.emit('relay-event', ev); };
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
    ['a bundle', 'job-updated', { id: 'job_b', kind: 'permanent', type: 'bundles', status: 'running', log: [], data: { table: 'bundle', row: { id: 1, label: 'zz' }, gone: false } }],
    ['a branch', 'job-updated', { id: 'job_b', kind: 'permanent', type: 'bundles', status: 'running', log: [], data: { table: 'branch', row: { id: 2, bundle: 1 }, gone: false } }],
    ['a grant', 'job-updated', { id: 'job_b', kind: 'permanent', type: 'bundles', status: 'running', log: [], data: { table: 'grant', row: { id: 3 }, gone: true } }],
    ['a job deleted', 'job-deleted', 'job_77'],
    ['a running job of a process', 'job-updated', { id: 'job_p', kind: 'process', type: 'zzProgram', status: 'running', module: 'process/js/zz', log: [{ timestamp: 1, message: 'job created' }], data: { command: 'node', progress: 0 } }],
    ['a running job of no module', 'job-updated', { id: 'job_q', kind: 'process', type: 'zzOther', status: 'running', log: [], data: {} }],
    ['a job of a type nobody has listed', 'job-updated', { id: 'job_z', kind: 'zzKind', type: 'zzNeverSeen', status: 'running', log: [], data: {} }],
    ['a server\'s job as a whole', 'job-updated', { id: 'job_s', kind: 'server', type: 'zzServer', status: 'running', module: 'process/js/zz', log: [{ timestamp: 1, message: 'job created' }], data: { pid: 1 } }],
    ['the join steps', 'job-updated', { id: 'job_j', kind: 'permanent', type: 'join-steps', status: 'running', log: [], data: { steps: ['zz'] } }],
    ['a relay event of the monitor, a post', 'relay-event', { kind: 'post', relay: STARRED, from: 'zz' }],
    ['a relay event of the monitor, a reply', 'relay-event', { kind: 'reply', relay: STARRED, from: 'zz' }],
    ['a relay event of the monitor, a refusal', 'relay-event', { kind: 'refused', relay: STARRED, from: 'zz' }],
    ['a relay\'s status', 'relay-event', { kind: 'relay-status', relay: STARRED, report: { members: 1 } }],
  ];

  test.subHeading('goal/G41.33: a starred face hears what the loopback hears, each once, and a face with no star does not');
  const sx = streams(starAt);
  sx.home.open(STARRED, '');
  sx.home.open(PLAIN, '');
  await settle();
  ok(!!sx.ups[STARRED] && !!sx.ups[PLAIN], 'both faces have their stream open', 'a stream did not open: nothing judged');
  ok(sx.subs.length > 0, 'the home side subscribes to the node\'s events', 'no subscriber: nothing judged');
  jobEvents.forEach(function (c) {
    sx.emit(c[1], c[2]);
    const on = sx.got(STARRED, c[1], c[2]);
    ok(on === 1, 'starred: ' + c[0] + ' arrives whole, once', 'starred: ' + c[0] + ' arrived ' + on + ' times, as ' + c[1] + ' ' + short(c[2]));
  });
  jobEvents.forEach(function (c) {
    // A server with no app object still reaches a face with no star, its status alone: that is today's, and stays.
    if (c[0] === 'a server\'s job as a whole') {
      const seen = sx.lines(PLAIN).filter(function (l) { return l.data && l.data.id === 'job_s'; });
      ok(seen.length === 1 && seen[0].data.log === undefined && seen[0].data.data === undefined, 'no star: a server still comes as its status alone, no log', 'no star: the server came as ' + short(seen));
      return;
    }
    ok(sx.got(PLAIN, c[1], c[2]) === 0, 'no star: ' + c[0] + ' stays home', 'no star: ' + c[0] + ' reached a face with no star');
  });

  test.subHeading('goal/G41.33: what a face with no star gets today, it still gets');
  const today = [['the file tree', 'job-updated', { id: 'job_f', kind: 'permanent', type: 'fs-watcher', status: 'running', data: { command: { op: 'zz' } } }],
    ['a row of the one table', 'job-updated', { id: 'job_h', kind: 'permanent', type: 'shadow', status: 'running', data: { row: 1 } }],
    ['a contact renamed', 'contact.rename', { key: 'K', name: 'zz' }]];
  today.forEach(function (c) {
    sx.emit(c[1], c[2]);
    ok(sx.got(PLAIN, c[1], c[2]) === 1, 'no star: ' + c[0] + ' arrives', 'no star: ' + c[0] + ' arrived ' + sx.got(PLAIN, c[1], c[2]) + ' times');
    ok(sx.got(STARRED, c[1], c[2]) === 1, 'starred: ' + c[0] + ' arrives, once', 'starred: ' + c[0] + ' arrived ' + sx.got(STARRED, c[1], c[2]) + ' times');
  });
  // An owner's event reaches a page by the dispatcher, and a face by ownerEvent as well: one event, one line.
  const minted = { kind: 'invite-minted', relay: STARRED, invite: 'zz' };
  sx.ownerEvent(minted);
  ok(sx.got(STARRED, 'relay-event', minted) === 1, 'starred: an owner\'s relay event arrives once, not once per way in', 'starred: an owner\'s relay event arrived ' + sx.got(STARRED, 'relay-event', minted) + ' times');
  ok(sx.got(PLAIN, 'relay-event', minted) === 1, 'no star: an owner\'s relay event still arrives, once', 'no star: an owner\'s relay event arrived ' + sx.got(PLAIN, 'relay-event', minted) + ' times');

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
  // events.js handleSubscribe: "snapshot", { jobs: o.jobs.listJobs() }. The envelope is the builder's; the jobs are the box's.
  const sn = streams(starAt);
  sn.jobs = [jobEvents[0][2], jobEvents[4][2], jobEvents[5][2], jobEvents[6][2], jobEvents[8][2]];
  sn.home.open(STARRED, '');
  sn.home.open(PLAIN, '');
  await settle();
  const onWire = function (url, id) { return JSON.stringify(sn.lines(url)).indexOf('"id":"' + id + '"') !== -1; };
  sn.jobs.forEach(function (j) {
    ok(onWire(STARRED, j.id), 'starred, on opening: job ' + j.type + ' is there', 'starred, on opening: job ' + j.type + ' is not on the stream, a loopback page has it');
    ok(!onWire(PLAIN, j.id), 'no star, on opening: job ' + j.type + ' is not', 'no star, on opening: job ' + j.type + ' reached the face');
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
    for (const v of verbsOf(inSpirit ? 'spirit/' + fam + '/api.js' : require(path.join(RUN, 'spirit.js')).familyPath(fam))) {
      if (fam + '.' + v === 'contact.own') continue;
      // fs.annotate from a face writes the face's own part of a sidecar, in faceHome, and never goes to the door (goal/G30.21).
      if (fam + '.' + v === 'fs.annotate') continue;
      const c = { call: fam + '.' + v, args: {} };
      for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
        const a = await send(free, MINE, form[1]);
        if (a.reached.indexOf(c.call) === -1) shut.push(c.call + ' ' + form[0] + ': ' + said(a));
      }
    }
  }
  ok(!shut.length, 'every verb of all ' + allFamilies().length + ' families reaches the door, unsealed and sealed', shut.length + ' still refused; first: ' + shut.slice(0, 3).join(' | '));
  const THROUGH = { call: 'relay.face', args: { url: MINE, name: 'zz' } };
  const FACE_POST = { call: 'peer.post', args: { to: 'RELAYKEY', text: JSON.stringify({ body: { face: 'zz' } }) } };
  for (const c of [['relay.face on the relay it is called through', THROUGH], ['a peer.post to that relay carrying a face name', FACE_POST]]) {
    for (const form of [['unsealed', c[1]], ['sealed', sealed(c[1])]]) {
      const on = await send(free, MINE, form[1]);
      ok(on.reached.indexOf(c[1].call) !== -1, 'starred, ' + form[0] + ': ' + c[0] + ' reaches the door', 'starred, ' + form[0] + ': ' + c[0] + ': ' + said(on));
      const off = await send(world(onlyMine, function () { return false; }), MINE, form[1]);
      ok(!off.reached.length && refused(off), 'no star, ' + form[0] + ': it stays refused', 'no star, ' + form[0] + ': ' + c[0] + ': ' + said(off));
    }
  }
  for (const own of [true, false]) {
    const c = { call: 'contact.own', args: { key: 'K', own: own } };
    for (const form of [['unsealed', c], ['sealed', sealed(c)]]) {
      const a = await send(free, MINE, form[1]);
      ok(!a.reached.length && refused(a), 'changing stars stays home: own ' + own + ', ' + form[0] + ', refused', 'contact.own ' + own + ' from a starred face, ' + form[0] + ': ' + said(a));
    }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
