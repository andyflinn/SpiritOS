'use strict';

// spirit/test/backupServer.js
// A COPY OF relay-state/process/, NEVER THE NODE KEYS — desk/G1.7, written
// FIRST, red on today's code.
//
//   Andy's go on desk/G1.7, after O2 and O5-O8: a server process run by the
//   node copies every process's state out of the node, into a .SpiritOS
//   folder of his, and reports every file it writes in its Jobs console.
//   "how can i trust the copy mechanist when i cant see it working", "copies
//   follow changes only", "1" copy, "agreed on the short hash".
//
// THE CONTRACT (wsl-claude's tests, sent to claude-windows before the build):
//   process/js/backup/backup.{js,json}: kind server, operated node, on
//   appServer.serve; started as the node starts it: [script, values JSON,
//   --pipe p, --state <relay-state>/process/backup]. relay-state is --state's
//   grandparent. The values JSON may carry quietMs (tests: 300).
//   THE NODE'S PUBLIC FACTS ARE HANDED OVER, NEVER READ (claude-windows'
//   objection): identity.json holds the private keys, so the backup never
//   opens it. jobs.startNodeServers hands every server it starts
//   --node '{"name","publicKey"}', and nothing private.
//   Home: relay-state/config.json spiritHome, else os.homedir(). The copy of
//   relay-state/process/<x> lands in <home>/backups/<node>/relay-state/
//   process/<x>, <node> the first 12 hex of sha256(identity.publicKey), with
//   <home>/backups/<node>/node.json {name, publicKey}.
//   It runs once at start, then after each change under relay-state/process/
//   once quiet for quietMs. Its own state folder is neither watched nor
//   copied. A .db goes through SQLite's backup, never as a plain file, and
//   its copy is one self-contained file (not left in WAL mode), so opening
//   the backup leaves no -wal or -shm beside it. A write that lands in a
//   live database's -wal is a change like any other.
//   Each run prints one line: an ISO time, then 'wrote <full path> <bytes>'
//   for each file written, or 'checked, unchanged since <ISO time>', and
//   'kept <full path>: new copy did not open' where a new copy failed.
//   status.get {} -> {lastCheck, lastCopy, lastError}. (T7's Desk half, Desk
//   showing these, lands with desk/G1.4, when Desk reaches its servers.)

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by desk/G1.7: ';
const SCRIPT = path.join(__dirname, '..', 'run', 'process', 'js', 'backup', 'backup.js');
const MANIFEST = path.join(path.dirname(SCRIPT), 'backup.json');
const QUIET = 300;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backup-'));
const HOME = path.join(scratch, 'home');
fs.mkdirSync(HOME, { recursive: true });
const kids = [];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function hex12(key) { return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12); }

// A node's run folder with an identity, keys and three processes' state.
function plantNode(label, extraConfig) {
  const run = path.join(scratch, label, 'spirit', 'run');
  const rs = path.join(run, 'relay-state');
  fs.mkdirSync(path.join(rs, 'process', 'desk'), { recursive: true });
  fs.mkdirSync(path.join(rs, 'process', 'other'), { recursive: true });
  fs.mkdirSync(path.join(rs, 'process', 'backup'), { recursive: true });
  const pub = 'MCowBQYDK2VwAyEA' + crypto.randomBytes(24).toString('base64');
  // A decoy: if the backup read identity.json, node.json would name WRONG.
  fs.writeFileSync(path.join(rs, 'identity.json'), JSON.stringify({ name: 'WRONG', publicKey: 'WRONG-KEY', privateKey: 'SECRET-' + label }));
  fs.writeFileSync(path.join(rs, 'relayKeys.json'), JSON.stringify({ key: 'SECRET-RELAY-' + label }));
  fs.writeFileSync(path.join(rs, 'contacts.json'), '{}');
  if (extraConfig) fs.writeFileSync(path.join(rs, 'config.json'), JSON.stringify(extraConfig));
  fs.writeFileSync(path.join(rs, 'process', 'desk', 'voice.jsonl'), JSON.stringify({ text: 'first', day: '2026-09-29' }) + '\n');
  fs.writeFileSync(path.join(rs, 'process', 'other', 'state.json'), JSON.stringify({ n: 1 }));
  fs.writeFileSync(path.join(rs, 'process', 'backup', 'own.json'), '{}');
  return { run: run, rs: rs, pub: pub, label: label };
}
function start(node) {
  const lines = [];
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(node.run, 'backup', 'win32', 'process') : path.join(node.rs, 'process', 'backup', 'door.sock');
  const env = Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME });
  if (!fs.existsSync(SCRIPT)) return { lines: lines, pipe: pipe, kid: null };
  const kid = spawn(process.execPath, [SCRIPT, JSON.stringify({ quietMs: QUIET }), '--pipe', pipe, '--state', path.join(node.rs, 'process', 'backup'),
    '--node', JSON.stringify({ name: node.label, publicKey: node.pub })],
    { env: env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  kids.push(kid);
  let buf = '';
  kid.stdout.on('data', function (b) {
    buf += b;
    let at;
    while ((at = buf.indexOf('\n')) !== -1) { lines.push(buf.slice(0, at)); buf = buf.slice(at + 1); }
  });
  kid.stderr.on('data', function () {});
  return { lines: lines, pipe: pipe, kid: kid };
}
// The next run line after `from` lines, within ms.
async function runLine(srv, from, ms) {
  const until = Date.now() + (ms || 6000);
  while (Date.now() < until) {
    const line = srv.lines.slice(from).find(function (l) { return /^\d{4}-\d\d-\d\dT[\d:.]+Z?\b/.test(l) && /(wrote|checked, unchanged|kept) /.test(l); });
    if (line) return line;
    await sleep(50);
  }
  return '';
}
function destOf(home, node) { return path.join(home, 'backups', hex12(node.pub)); }
function listAll(dir) {
  const out = [];
  (function walk(d, rel) {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else out.push(r); });
  })(dir, '');
  return out.sort();
}
function rowsIn(file) {
  try { const db = new DatabaseSync(file, { readOnly: true }); const n = db.prepare('SELECT count(*) AS n FROM t').get().n; db.close(); return n; }
  catch (e) { return -1; }
}

test.startTest('desk/G1.7: a copy of relay-state/process/, never the node keys');

(async function () {
  const A = plantNode('alpha');
  // THE DESK SERVER, WRITING: WAL mode, the connection kept open, so rows sit
  // in desk.db-wal and a plain copy of desk.db would miss them (T9).
  const live = new DatabaseSync(path.join(A.rs, 'process', 'desk', 'desk.db'));
  live.exec('PRAGMA journal_mode=WAL; CREATE TABLE t (v TEXT);');
  for (let i = 0; i < 5; i++) live.prepare('INSERT INTO t VALUES (?)').run('row' + i);
  // A second database, to be broken later (T12).
  const other = new DatabaseSync(path.join(A.rs, 'process', 'other', 'keep.db'));
  other.exec('CREATE TABLE t (v TEXT); INSERT INTO t VALUES (\'good\');');
  other.close();

  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  test.subHeading('The server itself');
  if (manifest && manifest.kind === 'server' && manifest.operated === 'node') test.check('process/js/backup/backup.json: kind server, operated node');
  else test.fail(OWED + 'no process/js/backup/backup.json saying kind server, operated node');

  const srv = start(A);
  const DEST = destOf(path.join(HOME, '.SpiritOS'), A);
  const first = await runLine(srv, 0, 8000);

  // ── T1, T2, T3, T6, T9: the first run ───────────────────────────────
  test.subHeading('T1: the copy holds every file under relay-state/process/ (but the backup\'s own)');
  const files = listAll(DEST);
  const want = ['node.json', 'relay-state/process/desk/desk.db', 'relay-state/process/desk/voice.jsonl', 'relay-state/process/other/keep.db', 'relay-state/process/other/state.json'];
  if (want.every(function (f) { return files.indexOf(f) !== -1; }) && !files.some(function (f) { return /process\/backup\//.test(f); })) {
    test.check('desk.db, voice.jsonl, keep.db and state.json are copied; the backup\'s own folder is not');
  } else test.fail(OWED + 'the copy holds ' + JSON.stringify(files));

  test.subHeading('T2: nothing outside relay-state/process/ is ever copied');
  const leaked = listAll(path.join(HOME, '.SpiritOS')).filter(function (f) { return /identity\.json|relayKeys|contacts\.json|config\.json/.test(f); });
  const secret = listAll(path.join(HOME, '.SpiritOS')).some(function (f) {
    try { return /SECRET-/.test(fs.readFileSync(path.join(HOME, '.SpiritOS', f), 'utf8')); } catch (e) { return false; }
  });
  if (files.length && !leaked.length && !secret) test.check('no identity, key, contacts or config file, and no secret in any file copied');
  else test.fail(OWED + (files.length ? 'leaked ' + JSON.stringify(leaked) + ', a secret copied ' + secret : 'nothing was copied'));

  test.subHeading('T3: it lands in <home>/.SpiritOS/backups/<12 hex of the key>/, with node.json from --node, never identity.json');
  let nodeJson = null;
  try { nodeJson = JSON.parse(fs.readFileSync(path.join(DEST, 'node.json'), 'utf8')); } catch (e) { nodeJson = null; }
  if (nodeJson && nodeJson.name === 'alpha' && nodeJson.publicKey === A.pub && !/SECRET/.test(JSON.stringify(nodeJson))) {
    test.check('backups/' + hex12(A.pub) + '/node.json names alpha and its public key, as --node gave them (the identity.json decoy was never read)');
  } else test.fail(OWED + 'node.json at ' + DEST + ': ' + JSON.stringify(nodeJson));

  test.subHeading('T6: the run said what it wrote, with sizes and full paths');
  const voiceDest = path.join(DEST, 'relay-state', 'process', 'desk', 'voice.jsonl');
  const voiceSize = fs.existsSync(voiceDest) ? fs.statSync(voiceDest).size : -1;
  if (first && first.indexOf('wrote ' + voiceDest + ' ' + voiceSize) !== -1) test.check('its line: ' + first.slice(0, 120) + '…');
  else test.fail(OWED + 'its first line was ' + JSON.stringify(first.slice(0, 200)));

  test.subHeading('T9: a database copied while its server writes still opens, and holds every row');
  const deskCopy = path.join(DEST, 'relay-state', 'process', 'desk', 'desk.db');
  if (rowsIn(deskCopy) === 5) test.check('the copy of desk.db opens and holds the 5 rows still in its WAL');
  else test.fail(OWED + 'the copy of desk.db holds ' + rowsIn(deskCopy) + ' rows');

  // ── T8: unchanged copies nothing ────────────────────────────────────
  test.subHeading('T8: a run compares first; a touch that changes nothing copies nothing');
  const stateDest = path.join(DEST, 'relay-state', 'process', 'other', 'state.json');
  const before = fs.existsSync(stateDest) ? fs.statSync(stateDest).mtimeMs : 0;
  let n = srv.lines.length;
  fs.writeFileSync(path.join(A.rs, 'process', 'other', 'state.json'), JSON.stringify({ n: 1 }));
  const same = await runLine(srv, n, QUIET + 4000);
  const after = fs.existsSync(stateDest) ? fs.statSync(stateDest).mtimeMs : 0;
  if (/checked, unchanged since \d{4}-/.test(same) && before && after === before) test.check('rewritten with the same bytes: the line says checked, unchanged, and the copy was not touched');
  else test.fail(OWED + 'after an identical rewrite: ' + JSON.stringify(same.slice(0, 160)) + ', copy touched ' + (after !== before));

  n = srv.lines.length;
  fs.writeFileSync(path.join(A.rs, 'process', 'other', 'state.json'), JSON.stringify({ n: 2 }));
  const sameSize = await runLine(srv, n, QUIET + 4000);
  let copied = '';
  try { copied = fs.readFileSync(stateDest, 'utf8'); } catch (e) { copied = ''; }
  if (sameSize.indexOf('wrote ' + stateDest) !== -1 && copied === JSON.stringify({ n: 2 })) test.check('same size, other content: the hash saw it, and the copy was written');
  else test.fail(OWED + 'same size, other content: ' + JSON.stringify(sameSize.slice(0, 160)) + ', copy ' + JSON.stringify(copied));

  // ── T5: a change starts a run after a quiet spell ───────────────────
  test.subHeading('T5: a change under relay-state/process/ starts a run once quiet');
  n = srv.lines.length;
  fs.appendFileSync(path.join(A.rs, 'process', 'desk', 'voice.jsonl'), JSON.stringify({ text: 'second', day: '2026-09-29' }) + '\n');
  const t0 = Date.now();
  const changed = await runLine(srv, n, QUIET + 4000);
  const waited = Date.now() - t0;
  if (changed.indexOf('wrote ' + voiceDest) !== -1 && waited >= QUIET - 50) test.check('a line appended to voice.jsonl was copied ' + waited + ' ms later, after the quiet spell');
  else test.fail(OWED + 'after a change: ' + JSON.stringify(changed.slice(0, 160)) + ' after ' + waited + ' ms');
  // A LIVE DATABASE'S WRITE IS A CHANGE TOO: the desk server's rows land in
  // desk.db-wal until a checkpoint, so a watcher that ignores -wal would miss
  // them (found proving these tests with a throwaway build).
  n = srv.lines.length;
  live.prepare('INSERT INTO t VALUES (?)').run('row5');
  const walRun = await runLine(srv, n, QUIET + 4000);
  if (walRun.indexOf('wrote ' + deskCopy) !== -1 && rowsIn(deskCopy) === 6) test.check('a row the live server wrote (still in its WAL) started a run, and the copy holds all 6');
  else test.fail(OWED + 'after a live write: ' + JSON.stringify(walRun.slice(0, 160)) + ', copy rows ' + rowsIn(deskCopy));

  n = srv.lines.length;
  fs.writeFileSync(path.join(A.rs, 'process', 'backup', 'own.json'), JSON.stringify({ touched: Date.now() }));
  const own = await runLine(srv, n, QUIET + 1500);
  // Judged only where changes start runs, or a backup that never runs passes
  // it (found writing it: it passed on today's code).
  if (!own && changed) test.check('a change in the backup\'s own folder starts no run');
  else test.fail(OWED + 'its own folder started a run: ' + own.slice(0, 120));

  // ── T11: one copy of each file ──────────────────────────────────────
  test.subHeading('T11: one copy of each file, no dated or older copies');
  const deskDir = listAll(path.join(DEST, 'relay-state', 'process', 'desk'));
  if (JSON.stringify(deskDir) === JSON.stringify(['desk.db', 'voice.jsonl'])) test.check('after four runs the desk folder holds desk.db and voice.jsonl, once each');
  else test.fail(OWED + 'the desk folder holds ' + JSON.stringify(deskDir));

  // ── T12: a copy that does not open never replaces the good one ──────
  test.subHeading('T12: a new copy that fails to open never replaces the last good one');
  const keepDest = path.join(DEST, 'relay-state', 'process', 'other', 'keep.db');
  n = srv.lines.length;
  fs.writeFileSync(path.join(A.rs, 'process', 'other', 'keep.db'), crypto.randomBytes(8192));
  const broken = await runLine(srv, n, QUIET + 4000);
  if (rowsIn(keepDest) === 1 && broken.indexOf('kept ' + keepDest + ': new copy did not open') !== -1) test.check('keep.db broken at the source: the good copy stays, and the line says kept');
  else test.fail(OWED + 'after breaking keep.db: copy rows ' + rowsIn(keepDest) + ', line ' + JSON.stringify(broken.slice(0, 200)));

  // ── T7 (the server half): status.get ────────────────────────────────
  test.subHeading('T7 (server half): status.get tells the last check, copy and error');
  const client = appClient.createAppClient({ rootDir: A.run });
  client.register('backup', srv.pipe);
  let st = null;
  try { st = (await client.ask({ backup: { 'status.get': {} } })).body; } catch (e) { st = null; }
  if (st && /^\d{4}-/.test(st.lastCheck) && /^\d{4}-/.test(st.lastCopy) && /keep\.db/.test(st.lastError)) test.check('lastCheck and lastCopy are times; lastError names keep.db');
  else test.fail(OWED + 'status.get answered ' + JSON.stringify(st));
  live.close();

  // ── T4 and T10: other nodes ─────────────────────────────────────────
  test.subHeading('T4: two nodes on one box write to two folders');
  const B = plantNode('beta');
  const srvB = start(B);
  await runLine(srvB, 0, 8000);
  const destB = destOf(path.join(HOME, '.SpiritOS'), B);
  if (hex12(A.pub) !== hex12(B.pub) && fs.existsSync(path.join(destB, 'node.json')) && fs.existsSync(path.join(DEST, 'node.json'))) {
    test.check('alpha and beta each have their own folder under backups/');
  } else test.fail(OWED + 'beta\'s folder ' + destB + ' exists ' + fs.existsSync(destB));

  test.subHeading('The node hands every server it starts --node, its name and public key, nothing private');
  const probeRun = path.join(scratch, 'probe', 'spirit', 'run');
  fs.mkdirSync(path.join(probeRun, 'process', 'js', 'probe'), { recursive: true });
  fs.mkdirSync(path.join(probeRun, 'relay-state'), { recursive: true });
  const auth = require('../run/js/relayAuth.js');
  const probeId = auth.generateIdentity('probe-node');
  auth.saveIdentity(probeRun, probeId);
  const argvFile = path.join(scratch, 'probe-argv.json');
  fs.writeFileSync(path.join(probeRun, 'process', 'js', 'probe', 'probe.json'), JSON.stringify({ kind: 'server', operated: 'node', args: [] }));
  fs.writeFileSync(path.join(probeRun, 'process', 'js', 'probe', 'probe.js'),
    'require("fs").writeFileSync(' + JSON.stringify(argvFile) + ', JSON.stringify(process.argv.slice(2)));\n');
  const jobs = require('../run/js/jobs.js')(require('../run/js/kernel.js'), 65432);
  const probeJobs = jobs.startNodeServers(probeRun) || [];
  let probeArgv = null;
  for (let i = 0; i < 60 && !probeArgv; i++) { await sleep(100); try { probeArgv = JSON.parse(fs.readFileSync(argvFile, 'utf8')); } catch (e) { probeArgv = null; } }
  probeJobs.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  const at = probeArgv ? probeArgv.indexOf('--node') : -1;
  let handed = null;
  try { handed = at !== -1 ? JSON.parse(probeArgv[at + 1]) : null; } catch (e) { handed = null; }
  if (handed && handed.name === 'probe-node' && handed.publicKey === probeId.publicKey && !/private/i.test(JSON.stringify(Object.keys(handed))) &&
      JSON.stringify(probeArgv).indexOf(probeId.privateKey) === -1) {
    test.check('--node {"name","publicKey"} reached the server, and no private key is anywhere in its arguments');
  } else test.fail(OWED + 'the server was started with ' + JSON.stringify(probeArgv && probeArgv.map(function (a) { return String(a).slice(0, 60); })));

  test.subHeading('T10: spiritHome in relay-state/config.json moves the whole .SpiritOS folder');
  const elsewhere = path.join(scratch, 'elsewhere');
  const C = plantNode('gamma', { spiritHome: elsewhere });
  const srvC = start(C);
  await runLine(srvC, 0, 8000);
  const destC = destOf(elsewhere, C);
  if (fs.existsSync(path.join(destC, 'relay-state', 'process', 'desk', 'voice.jsonl')) && !fs.existsSync(destOf(path.join(HOME, '.SpiritOS'), C))) {
    test.check('gamma\'s copy is in the configured folder, and nothing of it under the default home');
  } else test.fail(OWED + 'gamma\'s copy at ' + destC + ' exists ' + fs.existsSync(destC));
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
