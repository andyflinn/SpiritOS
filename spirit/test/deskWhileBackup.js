'use strict';

// spirit/test/deskWhileBackup.js
// THE DESK SERVER KEEPS WRITING WHILE THE BACKUP COPIES desk.db — found live
// on Andy's node, written FIRST, red on today's code.
//
//   Andy, 2026-09-29, in Desk: "Desk could not keep its log: the handler
//   failed". His desk.db is 11 MB in SQLite's default journal mode, where a
//   reader copying the file holds it against a writer; the backup copies it
//   after every change, so log.add meets a locked database.
//
// THE CONTRACT: with the backup server copying the same node's desk.db over
// and over, every log.add succeeds, and every copy the backup makes opens.
// How (a journal mode that lets one write while another reads, a copy that
// does not hold the file) is the build's.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by the desk-while-backup finding: ';
const RUN_JS = path.join(__dirname, '..', 'run', 'process', 'js');
const DESK = path.join(RUN_JS, 'desk', 'desk.js');
const BACKUP = path.join(RUN_JS, 'backup', 'backup.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('The desk server keeps writing while the backup copies desk.db');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskbackup-'));
const run = path.join(scratch, 'spirit', 'run');
const rs = path.join(run, 'relay-state');
const deskState = path.join(rs, 'process', 'desk');
const backupState = path.join(rs, 'process', 'backup');
fs.mkdirSync(deskState, { recursive: true });
fs.mkdirSync(backupState, { recursive: true });
const kids = [];

(async function () {
  // A record the size of Andy's order of magnitude, so a copy takes a while.
  const seed = new DatabaseSync(path.join(deskState, 'desk.db'));
  seed.exec('CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);');
  const ins = seed.prepare('INSERT INTO lines VALUES (?, ?, ?, ?, ?, ?, ?)');
  seed.exec('BEGIN');
  for (let i = 0; i < 6000; i++) {
    const body = 'seed ' + i + ' ' + crypto.randomBytes(600).toString('hex');
    ins.run('s' + i, new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString(), 'team/chat', 'claude-windows', 'note', body, JSON.stringify({ key: 's' + i, text: body }));
  }
  seed.exec('COMMIT');
  seed.close();

  const pipe = function (name, folder) {
    return process.platform === 'win32' ? appClient.pipePathFor(run, name, 'win32', 'process') : path.join(folder, 'door.sock');
  };
  const deskPipe = pipe('desk', deskState);
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  const backupLines = [];
  const home = path.join(scratch, 'home');
  const bk = spawn(process.execPath, [BACKUP, JSON.stringify({ quietMs: 50 }), '--pipe', pipe('backup', backupState), '--state', backupState,
    '--node', JSON.stringify({ name: 'probe', publicKey: 'MCowBQYDK2VwAyEAprobeprobeprobeprobeprobeprobeprobeprob=' })],
    { env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }), stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
  kids.push(bk);
  bk.stdout.on('data', function (b) { String(b).split('\n').filter(Boolean).forEach(function (l) { backupLines.push(l); }); });

  const client = appClient.createAppClient({ rootDir: run });
  client.register('desk', deskPipe);
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { up = false; }
  }

  // Write steadily for a few seconds, each write a change the backup copies after.
  let failed = 0;
  let firstError = '';
  let n = 0;
  const until = Date.now() + 6000;
  while (up && Date.now() < until) {
    n += 1;
    const line = JSON.stringify({ key: 'w' + n, at: new Date().toISOString(), todo: 'team/chat', from: 'andy', kind: 'note', text: 'write ' + n, dir: 'out' });
    let r = null;
    try { r = await client.ask({ desk: { 'log.add': { json: line } } }); } catch (e) { r = { status: 0, body: { error: e.message } }; }
    if (!r || r.status !== 200 || !r.body || r.body.added !== true) { failed += 1; if (!firstError) firstError = JSON.stringify(r && r.body).slice(0, 160); }
    await sleep(20);
  }
  // Under a loaded harness a copy of the big record can take seconds: wait
  // for the second one rather than judging at a fixed moment.
  for (let i = 0; i < 60 && backupLines.filter(function (l) { return /wrote .*desk\.db/.test(l); }).length < 2; i++) await sleep(250);
  await sleep(500);

  test.subHeading('Every log.add succeeds while the backup copies desk.db');
  const copies = backupLines.filter(function (l) { return /wrote .*desk\.db/.test(l); }).length;
  if (up && n > 50 && copies >= 2 && failed === 0) test.check(n + ' writes, all kept, while the backup copied desk.db ' + copies + ' times');
  else test.fail(OWED + 'up ' + up + ', ' + failed + ' of ' + n + ' writes failed (' + firstError + '), ' + copies + ' copies of desk.db');

  test.subHeading('Every copy the backup made of desk.db opens');
  const kept = backupLines.filter(function (l) { return /kept .*desk\.db/.test(l); });
  let rows = -1;
  const copy = (function find(d) {
    for (const e of (function () { try { return fs.readdirSync(d, { withFileTypes: true }); } catch (x) { return []; } })()) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { const f = find(p); if (f) return f; } else if (e.name === 'desk.db') return p;
    }
    return '';
  })(path.join(home, '.SpiritOS'));
  try { const c = new DatabaseSync(copy, { readOnly: true }); rows = c.prepare('SELECT count(*) AS n FROM lines').get().n; c.close(); } catch (e) { rows = -1; }
  if (copy && rows >= 6000 && !kept.length) test.check('the last copy opens with ' + rows + ' lines; no copy was refused');
  else test.fail(OWED + 'copy ' + (copy || 'none') + ' holds ' + rows + ' lines; refused copies: ' + kept.length);
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 400);
});
