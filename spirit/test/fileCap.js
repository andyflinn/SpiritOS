'use strict';

// fileTransfer goal/G1.5: the fileServer holds at most 32 files. Red on today's tree.
//   Andy: "i'd rather limit the number of files that can exist in fileServer. that number would be bounded by how
//   many verb-hash records fit in MAX_PAYLOAD, and be done with this discussion, don't forget: a file inside of
//   fileServer is otherwise useless to the owner, and takes up diskspace for who-knows-who?"
//   Andy: "make the limit 32. that's enough. we'll find a method later to clean up that folder."
// The contract the builder follows (paths and names this red fixes, argue them in goal/G1.5 before building):
//   The server is spirit/run/process/js/fileServer/fileServer.js, started like desk: [file, '{}', --pipe, --state];
//   its store lives under the node's state. push {path} answers {hash}, the hash being the file's id, one string
//   everywhere: 'verb-' + sha256 base64url, 48 characters (goal/G1.3, THE FILE ID).
//   1. 32 pushes of 32 different files each land and answer a 48-character verb- id.
//   2. The 33rd push is refused pool-full, by name, with the store untouched.
//   3. fetch of a 33rd id at 32 held is refused pool-full BEFORE any peer is contacted (a bogus `from` must not
//      change the refusal), complete or partial counting alike.
//   4. delete of one file frees room: the push that was refused then lands. A live count, not a ratchet.
//   5. The api answer with 32 files held fits ONE answer (appClient.ANSWER_MAX, 8377), every held id listed:
//      the api stays whole, which is the point of the cap (goal/G1.5, THE LIMIT IS 32).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by fileTransfer goal/G1.5: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'fileServer', 'fileServer.js');
const CAP = 32;
const ID_RE = /^verb-[A-Za-z0-9_-]{43}$/;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('fileTransfer goal/G1.5: the fileServer holds at most 32 files');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-filecap-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'fileServer', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('fileServer', pipe);
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAfileCapTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const PEER = 'MCowBQYDK2VwAyEAfileCapTestPeerAAAAAAAAAAAAAAAAAAAAAA=';
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ fileServer: b }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };

// 33 different tiny files on the owner's disk; push takes a path, never bytes.
const files = [];
for (let i = 0; i < CAP + 1; i++) {
  const p = path.join(scratch, 'file-' + i + '.txt');
  fs.writeFileSync(p, 'the file number ' + i + ' of the cap red\n');
  files.push(p);
}

async function start() {
  if (!fs.existsSync(SERVER)) return null;
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.fileServer && r.body.fileServer.ok !== false) return r.body.fileServer; } catch (e) { /* not yet */ }
  }
  return null;
}

async function main() {
  const api = await start();
  if (!api) {
    test.fail(OWED + 'no fileServer answers at ' + path.relative(path.join(__dirname, '..'), SERVER)
      + '; nothing below can fail for the right reason without it');
    return;
  }

  test.subHeading('32 files land, each answering its one id');
  const ids = [];
  for (let i = 0; i < CAP; i++) {
    const r = await call('push', { path: files[i] }, ANDY);
    if (r.status === 200 && r.body && ID_RE.test(r.body.hash)) ids.push(r.body.hash);
  }
  if (ids.length === CAP && new Set(ids).size === CAP) test.check('32 pushes answered 32 distinct verb- ids of 48 characters');
  else test.fail(OWED + 'wanted 32 distinct 48-character verb- ids, got ' + new Set(ids).size);

  test.subHeading('the 33rd is refused pool-full, by name');
  const over = await call('push', { path: files[CAP] }, ANDY);
  if (over.status !== 200 && over.body && over.body.code === 'pool-full') test.check('push number 33 refused pool-full');
  else test.fail(OWED + 'push 33 answered ' + over.status + ' ' + JSON.stringify((over.body || {}).code));

  const unheld = 'verb-' + 'A'.repeat(43);
  const fetchOver = await call('fetch', { id: unheld, from: PEER }, ANDY);
  if (fetchOver.status !== 200 && fetchOver.body && fetchOver.body.code === 'pool-full') test.check('fetch of a 33rd id refused pool-full before any peer is asked');
  else test.fail(OWED + 'fetch at the cap answered ' + fetchOver.status + ' ' + JSON.stringify((fetchOver.body || {}).code));

  test.subHeading('delete frees room: a live count, not a ratchet');
  const gone = await call('delete', { hash: ids[0] }, ANDY);
  const retry = await call('push', { path: files[CAP] }, ANDY);
  if (gone.status === 200 && retry.status === 200 && retry.body && ID_RE.test(retry.body.hash)) test.check('after one delete the refused push lands');
  else test.fail(OWED + 'delete then push answered ' + gone.status + ' then ' + retry.status);

  test.subHeading('the api with 32 files held fits one answer');
  const whole = await client.ask('api', ANDY);
  const tree = (whole.body || {}).fileServer || {};
  const bytes = Buffer.byteLength(JSON.stringify(tree), 'utf8');
  const held = ids.slice(1).concat([retry.body && retry.body.hash]).filter(Boolean);
  const listed = held.every(function (id) { return tree[id]; });
  if (bytes <= appClient.ANSWER_MAX && listed) test.check('all 32 ids listed and the answer is ' + bytes + ' bytes, inside ' + appClient.ANSWER_MAX);
  else test.fail(OWED + (listed ? 'the api answer is ' + bytes + ' bytes, over ' + appClient.ANSWER_MAX : 'a held id is missing from the api answer'));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.message)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
});
