'use strict';

// goal/G5.2: fileServer, one label per hash. Red on today's tree; wsl-claude wrote it from G5.2's box, without reading
// any build, and does not build it (claude-windows builds).
//   Andy (andy/NOFACE.md): "1. There will be only one label (file-name) per verb-hash. All the label arbitration will
//   disappear."; 2026-10-05 in Desk: "ah the same file added under a new name just replaces the labe.", "same is
//   determined by hash."; to Q2 (status replies name in place of names): "yes."; his go-all on goal/G5.
//
// THE SHAPES (G5.2's box):
//   1  status answers name, one string, and no names list; fileStatus.json holds name the same way.
//   2  push of bytes already held under another name: the new name replaces the old one (today it is appended,
//      fileServer.js 249-253), and info answers it too.
//   3  the same name on other bytes is another file, by its hash, kept beside the first (as today).
//   4  a folder already in the store with a names list is read as its last name, so nothing held is lost.
//   5  the suites asserting the list change with it: fileBottom.js 98 and fileFetch.js 168 test a names array today.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G5.2: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'fileServer', 'fileServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('goal/G5.2: fileServer, one label per hash');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fileonelabel-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'fileServer', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('fileServer', pipe);
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAfileOneLabelOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const PEER = { key: 'MCowBQYDK2VwAyEAfileOneLabelPeerAAAAAAAAAAAAAAAAAAAAA=', label: 'bert' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ fileServer: b }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };

function write(name, text) { const p = path.join(scratch, name); fs.writeFileSync(p, text); return p; }
function readDisk(id) { try { return JSON.parse(fs.readFileSync(path.join(state, id, 'fileStatus.json'), 'utf8')); } catch (e) { return null; } }
async function infoName(id) {
  const r = await call(id, { command: 'info', data: '' }, PEER);
  try { return JSON.parse((r.body || {}).data).name; } catch (e) { return undefined; }
}

async function start() {
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.fileServer && r.body.fileServer.ok !== false) return kid; } catch (e) { /* not yet */ }
  }
  return null;
}
async function stop(kid) {
  try { kid.kill(); } catch (e) { /* gone */ }
  for (let i = 0; i < 40 && kid.exitCode === null && kid.signalCode === null; i++) await sleep(100);
  try { if (process.platform !== 'win32') fs.rmSync(pipe, { force: true }); } catch (e) { /* none */ }
}

async function main() {
  let kid = await start();
  if (!kid) { test.fail(OWED + 'no fileServer answers; nothing below can fail for the right reason'); return; }

  test.subHeading('1. status answers one name');
  const first = await call('push', { path: write('notes.txt', 'one label per hash\n') }, ANDY);
  const id = first.body && first.body.hash;
  if (!id) { test.fail('push did not land: ' + short(first.body)); return; }
  const st = (await call('status', { hash: id }, ANDY)).body || {};
  if (st.name === 'notes.txt' && !('names' in st)) test.check('status answers name: notes.txt, and no names list');
  else test.fail(OWED + 'status answered ' + short(st));
  const disk = readDisk(id) || {};
  if (disk.name === 'notes.txt' && !('names' in disk)) test.check('fileStatus.json holds name, one string, and no names list');
  else test.fail(OWED + 'fileStatus.json reads ' + short(disk));

  test.subHeading('2. the same bytes under a new name replace the label');
  const again = await call('push', { path: write('renamed.txt', 'one label per hash\n') }, ANDY);
  const st2 = (await call('status', { hash: id }, ANDY)).body || {};
  const info2 = await infoName(id);
  if (again.body && again.body.hash === id && st2.name === 'renamed.txt' && info2 === 'renamed.txt') test.check('pushed again as renamed.txt: one file, now named renamed.txt in status and info');
  else test.fail(OWED + 'after the second push: hash ' + short(again.body && again.body.hash) + ', status ' + short(st2) + ', info name ' + short(info2));
  const disk2 = readDisk(id) || {};
  if (disk2.name === 'renamed.txt' && !('names' in disk2)) test.check('fileStatus.json now names renamed.txt alone');
  else test.fail(OWED + 'fileStatus.json reads ' + short(disk2));

  test.subHeading('3. the same name on other bytes is another file');
  const other = await call('push', { path: write('renamed.txt', 'other bytes, same name\n') }, ANDY);
  const otherId = other.body && other.body.hash;
  const firstStill = await call('status', { hash: id }, ANDY);
  if (otherId && otherId !== id && firstStill.status === 200) test.check('other bytes under renamed.txt get their own hash, and the first file is still held');
  else test.fail('the same name on other bytes: hash ' + short(otherId) + ', first file ' + firstStill.status);

  test.subHeading('4. a folder from before, with a names list, reads as its last name');
  await stop(kid);
  const legacy = readDisk(id) || {};
  delete legacy.name;
  legacy.names = ['old.txt', 'newer.txt'];
  fs.writeFileSync(path.join(state, id, 'fileStatus.json'), JSON.stringify(legacy));
  kid = await start();
  if (!kid) { test.fail('fileServer did not come back after the restart'); return; }
  const st4 = (await call('status', { hash: id }, ANDY)).body || {};
  const info4 = await infoName(id);
  if (st4.name === 'newer.txt' && info4 === 'newer.txt') test.check('a held names list answers its last name, newer.txt, in status and info');
  else test.fail(OWED + 'a folder with names [old.txt, newer.txt] answers status ' + short(st4) + ', info name ' + short(info4));

  test.subHeading('5. the suites asserting the list have moved');
  const stale = ['fileBottom.js', 'fileFetch.js'].filter(function (f) {
    return /Array\.isArray\(\w+\.names\)/.test(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  if (!stale.length) test.check('fileBottom.js and fileFetch.js no longer test a names array');
  else test.fail(OWED + 'still testing a names array: ' + stale.join(', '));
}

main().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
