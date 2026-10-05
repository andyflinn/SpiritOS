'use strict';

// goal/G5.3: fileServer, slots the node reserves for itself (PROFILE_PICTURE). Red on today's tree; wsl-claude wrote
// it from G5.3's box, without reading any build, and does not build it (claude-windows builds).
//   Andy (andy/NOFACE.md): "2. there will be slots in fileServer that are reserved by the node itself, like
//   PROFILE_PICTURE."; in goal/G5.2: "reserved labels can be updated with any file, the label stays."; to Q1: "it's a
//   fixed label: it may be neccessare that ading to the fileServer pool needs a new "verb" that allows to to replace
//   the labels content," / "it also means that the reserved label is protected, the use cannot name a file
//   PROFILE_PICTURE and add it to the pool..."; to Q2 (fill {slot, path}): "yes"; to Q3 (the old file): "deleted.";
//   to Q4 (grants on the old file): "move the grants to the new file."; his go-all on goal/G5.
//
// THE SHAPES (G5.3's box):
//   1  push refuses a file named like a slot (PROFILE_PICTURE), and nothing is added to the pool.
//   2  fill {slot, path}, owner only: the file takes the slot's label (status and info answer PROFILE_PICTURE); a
//      member's fill is refused not-owner; a slot that is not reserved is refused.
//   3  filling again: the new file holds the label, the old file is deleted (status no-such-file, its verb gone).
//   4  pushing the slot's own bytes under another name answers the hash and leaves the label PROFILE_PICTURE.
//   5  grants on the old file move to the new one, through the node's loopback auth verbs (no new auth verb): on a
//      real node, a peer granted fileServer.<old hash> is granted fileServer.<new hash> after fill, and no longer the
//      old one.
// LEFT OPEN in the box, not asserted: "public" (apiAuth has no grant for every caller).

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const plantRun = require('./plantRun.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by goal/G5.3: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'fileServer', 'fileServer.js');
const SLOT = 'PROFILE_PICTURE';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 15000);
  return (function again() {
    return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return sleep(200).then(again);
    });
  }());
}
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('goal/G5.3: fileServer slots the node reserves for itself');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fileslots-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'fileServer', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('fileServer', pipe);
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAfileSlotsOwnerAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const PEER = { key: 'MCowBQYDK2VwAyEAfileSlotsPeerAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'bert' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ fileServer: b }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
function write(name, text) { const d = fs.mkdtempSync(path.join(scratch, 'f-')); const p = path.join(d, name); fs.writeFileSync(p, text); return p; }
async function nameOf(id) {
  const st = (await call('status', { hash: id }, ANDY)).body || {};
  const label = typeof st.name === 'string' ? st.name : (Array.isArray(st.names) ? st.names[st.names.length - 1] : undefined);
  const info = await call(id, { command: 'info', data: '' }, PEER);
  let i = null; try { i = JSON.parse((info.body || {}).data); } catch (e) { i = null; }
  return { status: label, info: i && i.name };
}

async function main() {
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  const up = await waitFor(function () { return client.ask('api').then(function (r) { return r.body && r.body.fileServer && r.body.fileServer.ok !== false; }); }, 10000);
  if (!up) { test.fail(OWED + 'no fileServer answers; nothing below can fail for the right reason'); return; }

  test.subHeading('1. the slot\'s name is protected');
  const before = fs.readdirSync(state).length;
  const named = await call('push', { path: write(SLOT, 'a file named like the slot\n') }, ANDY);
  if (named.status !== 200 && fs.readdirSync(state).length === before) test.check('push refuses a file named ' + SLOT + ', and nothing joins the pool (' + short(named.body && named.body.code) + ')');
  else test.fail(OWED + 'push of a file named ' + SLOT + ' answered ' + named.status + ' ' + short(named.body));

  test.subHeading('2. fill puts a file into the slot');
  const one = await call('fill', { slot: SLOT, path: write('me.jpg', 'picture one\n') }, ANDY);
  const id1 = one.body && one.body.hash;
  const n1 = id1 ? await nameOf(id1) : {};
  if (one.status === 200 && id1 && n1.status === SLOT && n1.info === SLOT) test.check('fill answers the hash, and status and info name the file ' + SLOT);
  else test.fail(OWED + 'fill answered ' + one.status + ' ' + short(one.body) + '; names ' + short(n1));
  const asPeer = await call('fill', { slot: SLOT, path: write('them.jpg', 'not theirs to set\n') }, PEER);
  if (asPeer.status !== 200 && asPeer.body && asPeer.body.code === 'not-owner') test.check('a member\'s fill is refused not-owner');
  else test.fail(OWED + 'a member\'s fill answered ' + asPeer.status + ' ' + short(asPeer.body));
  const odd = await call('fill', { slot: 'NOT_A_SLOT', path: write('x.jpg', 'no such slot\n') }, ANDY);
  if (odd.status !== 200 && odd.body && odd.body.code && odd.body.code !== 'no-such-verb') test.check('a slot that is not reserved is refused (' + short(odd.body.code) + ')');
  else test.fail(OWED + 'fill of NOT_A_SLOT answered ' + odd.status + ' ' + short(odd.body));

  test.subHeading('3. filling again moves the label and deletes the old file');
  const two = await call('fill', { slot: SLOT, path: write('me2.jpg', 'picture two\n') }, ANDY);
  const id2 = two.body && two.body.hash;
  const n2 = id2 ? await nameOf(id2) : {};
  const oldGone = id1 ? (await call('status', { hash: id1 }, ANDY)) : {};
  const api = (await client.ask('api').catch(function () { return {}; })).body || {};
  const verbs = JSON.stringify(api.fileServer || {});
  if (two.status === 200 && id2 && id2 !== id1 && n2.status === SLOT && oldGone.body && oldGone.body.code === 'no-such-file' && id1 && verbs.indexOf(id1) === -1) {
    test.check('the new file holds ' + SLOT + '; the old one is deleted, and its verb is gone from the api');
  } else test.fail(OWED + 'second fill answered ' + two.status + ' ' + short(two.body) + '; new names ' + short(n2) + '; old status ' + short(oldGone.body) + '; old verb still listed ' + (!!id1 && verbs.indexOf(id1) !== -1));

  test.subHeading('4. the slot\'s bytes pushed under another name leave the label');
  const same = await call('push', { path: write('copy.jpg', 'picture two\n') }, ANDY);
  const n4 = id2 ? await nameOf(id2) : {};
  if (same.body && id2 && same.body.hash === id2 && n4.status === SLOT) test.check('push answers the slot\'s hash and the label stays ' + SLOT);
  else test.fail(OWED + 'pushing the slot\'s bytes as copy.jpg answered ' + short(same.body) + '; label now ' + short(n4));
}

// 5. ON A REAL NODE: the grants follow the slot. The node starts its own fileServer (intrinsic); the loopback reaches
// it through jobs.api, and the grants are read with jobs.authQuery (server.js 1832).
async function grants() {
  test.subHeading('5. grants on the old file move to the new one');
  const home = path.join(scratch, 'node', 'spirit', 'run');
  plantRun.plantRunTree(home);
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] });
  kids.push(node);
  const ask = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let b = {}; try { b = JSON.parse(r.text); } catch (e) { b = {}; }
      return { status: r.status, body: b };
    }, function () { return { status: 0, body: {} }; });
  };
  const files = function (verb, args) { const q = {}; q[verb] = args; return ask({ verb: 'jobs.api', ask: { fileServer: q } }); };
  const ready = await waitFor(function () { return files('push', { path: write('warm.txt', 'warm up\n') }).then(function (r) { return r.status === 200 && r.body && r.body.hash; }); }, 30000);
  if (!ready) { test.fail('the node\'s fileServer did not answer push on the loopback'); return; }
  const first = await files('fill', { slot: SLOT, path: write('me.jpg', 'node picture one\n') });
  const old = first.body && first.body.hash;
  if (!old) { test.fail(OWED + 'fill on the node answered ' + first.status + ' ' + short(first.body) + '; grants cannot be followed'); return; }
  const granted = await ask({ verb: 'jobs.authGrant', key: PEER.key, path: 'fileServer.' + old });
  const second = await files('fill', { slot: SLOT, path: write('me2.jpg', 'node picture two\n') });
  const neu = second.body && second.body.hash;
  const onNew = neu ? (await ask({ verb: 'jobs.authQuery', key: PEER.key, path: 'fileServer.' + neu })).body : {};
  const onOld = (await ask({ verb: 'jobs.authQuery', key: PEER.key, path: 'fileServer.' + old })).body;
  if (granted.status === 200 && neu && onNew && onNew.allowed === true && onOld && onOld.allowed === false) test.check('a peer granted the old picture is granted the new one, and no longer the old');
  else test.fail(OWED + 'grant ' + granted.status + ' ' + short(granted.body) + '; after fill: new ' + short(onNew) + ', old ' + short(onOld));
}

main().then(grants).catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
