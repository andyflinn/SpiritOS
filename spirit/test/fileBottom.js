'use strict';

// fileTransfer goal/G1.1: the fileServer bottom level — pull, status, and the hash-verb's info.
// Red on today's tree: fileServer.js (4fbf3201) serves push, fetch and delete; these three are owed.
//   Andy: "there is an oposite fucntion pullFile(destination) that copies a file back into the normal
//   filing system." Ruled as pull { hash, path }, owner-only.
//   Pull never overwrites (Andy, on a different file already at the path: "fail: already exists.";
//   recorded: the same file at the path answers already there).
//   status { hash } was in the proposal he said yes to; the dataset is fileStatus.json's.
//   The hash-verb's commands, G1.2 THE HASH-VERB'S COMMANDS: "info: answers { bytes, mime, name }
//   (one name, the one shared)". Andy: "the provider delivers the info, and the chunks, nothing else".
// Shapes this red fixes, argued in goal/G1.1 before building:
//   1. pull { hash, path } answers { copied: true }; the same bytes already at the path answer
//      { copied: false, already: true } — said, not an error; a DIFFERENT file there is refused
//      already-exists (a catalogue code this red names) and the file at the path is untouched.
//   2. status { hash } answers fileStatus.json's dataset { hash, bytes, mime, name, at } (one name since goal/G5.2);
//      a hash not held is refused no-such-file. Owner-only, like push, pull and delete.
//   3. The hash-verb answers { command: 'info', data } with data the JSON text { bytes, mime, name },
//      name the file's one name — to any caller the door let through: the grant is apiAuth's
//      business, not this server's. Any other command stays refused by name.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by fileTransfer goal/G1.1: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'fileServer', 'fileServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('fileTransfer goal/G1.1: pull, status, and the hash-verb\'s info');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-filebottom-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'fileServer', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('fileServer', pipe);
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAfileBottomOwnerAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const PEER = { key: 'MCowBQYDK2VwAyEAfileBottomPeerAAAAAAAAAAAAAAAAAAAAAAA=', label: 'bert' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ fileServer: b }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };

const source = path.join(scratch, 'notes.txt');
fs.writeFileSync(source, 'the bottom level red reads this back\n');

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
  if (!api) { test.fail(OWED + 'no fileServer answers; nothing below can fail for the right reason'); return; }
  const pushed = await call('push', { path: source }, ANDY);
  const id = pushed.body && pushed.body.hash;
  if (!id) { test.fail(OWED + 'push did not land, so the bottom level cannot be asked: ' + JSON.stringify(pushed.body)); return; }

  test.subHeading('pull copies out, and never overwrites');
  const out = path.join(scratch, 'back', 'notes.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const first = await call('pull', { hash: id, path: out }, ANDY);
  if (first.status === 200 && first.body && first.body.copied === true
    && fs.existsSync(out) && fs.readFileSync(out, 'utf8') === fs.readFileSync(source, 'utf8')) {
    test.check('pull wrote the same bytes back to the filing system and answered copied');
  } else test.fail(OWED + 'pull answered ' + first.status + ' ' + JSON.stringify(first.body));

  const again = await call('pull', { hash: id, path: out }, ANDY);
  if (again.status === 200 && again.body && again.body.copied === false && again.body.already === true) {
    test.check('the same file already at the path is said, not an error: already there');
  } else test.fail(OWED + 'pull onto the same bytes answered ' + again.status + ' ' + JSON.stringify(again.body));

  const other = path.join(scratch, 'other.txt');
  fs.writeFileSync(other, 'a different file lives here\n');
  const blocked = await call('pull', { hash: id, path: other }, ANDY);
  if (blocked.status !== 200 && blocked.body && blocked.body.code === 'already-exists'
    && fs.readFileSync(other, 'utf8') === 'a different file lives here\n') {
    test.check('a different file at the path is refused already-exists and left untouched');
  } else test.fail(OWED + 'pull onto a different file answered ' + blocked.status + ' ' + JSON.stringify(blocked.body));

  const asPeer = await call('pull', { hash: id, path: out }, PEER);
  if (asPeer.status !== 200 && asPeer.body && asPeer.body.code === 'not-owner') test.check('pull is the owner\'s alone, whatever apiAuth says');
  else test.fail(OWED + 'a member\'s pull answered ' + asPeer.status + ' ' + JSON.stringify(asPeer.body));

  test.subHeading('status answers the file\'s own dataset');
  const st = await call('status', { hash: id }, ANDY);
  const b = st.body || {};
  if (st.status === 200 && b.hash === id && b.bytes === fs.statSync(source).size
    && typeof b.mime === 'string' && b.name === 'notes.txt' && b.names === undefined && b.at) {
    test.check('status answers { hash, bytes, mime, name, at } as fileStatus.json holds them');
  } else test.fail(OWED + 'status answered ' + st.status + ' ' + JSON.stringify(b));

  const none = await call('status', { hash: 'verb-' + 'B'.repeat(43) }, ANDY);
  if (none.status !== 200 && none.body && none.body.code === 'no-such-file') test.check('a hash not held is refused no-such-file');
  else test.fail(OWED + 'status of a stranger answered ' + none.status + ' ' + JSON.stringify(none.body));

  const stPeer = await call('status', { hash: id }, PEER);
  if (stPeer.status !== 200 && stPeer.body && stPeer.body.code === 'not-owner') test.check('status is the owner\'s, like its siblings');
  else test.fail(OWED + 'a member\'s status answered ' + stPeer.status + ' ' + JSON.stringify(stPeer.body));

  test.subHeading('the hash-verb\'s info, the provider\'s first delivery');
  const info = await call(id, { command: 'info', data: '' }, PEER);
  let data = null;
  try { data = JSON.parse((info.body || {}).data); } catch (e) { data = null; }
  if (info.status === 200 && info.body.command === 'info' && data
    && data.bytes === fs.statSync(source).size && typeof data.mime === 'string' && data.name === 'notes.txt') {
    test.check('info echoes its command and delivers { bytes, mime, name } as JSON text in data');
  } else test.fail(OWED + 'info answered ' + info.status + ' ' + JSON.stringify(info.body));

  // chunk was refused here until goal/G1.2 built it; an unknown command stands in.
  const odd = await call(id, { command: 'erase', data: '' }, PEER);
  if (odd.status !== 200 && odd.body && odd.body.code) test.check('a command the hash-verb does not serve is refused by name');
  else test.fail(OWED + 'an unserved command answered ' + odd.status + ' ' + JSON.stringify(odd.body));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.message)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
});
