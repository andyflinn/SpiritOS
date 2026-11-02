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
  const FS_GROUP = ['FS.loadFile', 'FS.saveFile', 'FS.saveJsonValue'];
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
