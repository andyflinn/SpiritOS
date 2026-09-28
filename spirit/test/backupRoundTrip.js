'use strict';

// spirit/test/backupRoundTrip.js
// THE BACKUP IS PROVEN BY A RESTORE — transport/R19.1.
//
//   Andy, 2026-09-28: the node log moves into node.db and "i'd rather rely on
//   backups, and not worry about it", then "it's required to pull this off
//   safely", and "go." on an ENCRYPTED backup into his Google Drive folder.
//   A backup nobody has restored from is a hope, so this suite restores one
//   on every harness run, the way a person would: install/backup-windows/
//   backup.js and restore.js as separate processes, on a fixture relay-state.
//
// What it holds:
//   (a) the target folder only ever receives ONE sealed file, and the private
//       key's text appears nowhere in it (it syncs to Google);
//   (b) a restore gives back every plain file byte for byte, and every
//       database with the same rows and a clean integrity check;
//   (c) a wrong passphrase is refused, and no passphrase means no backup.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');

const TOOL = path.join(__dirname, '..', '..', 'install', 'backup-windows');

test.startTest('The encrypted backup round-trips: sealed on the way out, whole on the way back');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backup-test-'));
const from = path.join(root, 'relay-state');
const to = path.join(root, 'drive');
const pass = path.join(root, 'pass');
const wrong = path.join(root, 'wrong');
fs.mkdirSync(from, { recursive: true });

// A fixture shaped like a node's relay-state: a private key, a contact book,
// a log, and a database with rows in it.
const SECRET = 'PRIVATE-' + crypto.randomBytes(24).toString('hex');
fs.writeFileSync(path.join(from, 'identity.json'), JSON.stringify({ privateKey: SECRET, publicKey: 'MCowPUBLIC' }));
fs.writeFileSync(path.join(from, 'contacts.json'), JSON.stringify({ rows: [{ publicKey: 'MCowA', label: 'alpha' }] }));
fs.writeFileSync(path.join(from, 'traffic.jsonl'), '{"at":"2026-09-28T00:00:00.000Z","dir":"in","hash":"h1"}\n');
{
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(from, 'node.db'));
  db.exec('CREATE TABLE replay (hash TEXT PRIMARY KEY, at INTEGER NOT NULL)');
  const put = db.prepare('INSERT INTO replay (hash, at) VALUES (?, ?)');
  for (let i = 0; i < 200; i++) put.run('hash-' + i, i);
  db.close();
}
fs.writeFileSync(pass, 'correct horse battery staple\n');
fs.writeFileSync(wrong, 'not the passphrase at all\n');

function run(script, args) {
  return spawnSync(process.execPath, [path.join(TOOL, script)].concat(args), { encoding: 'utf8', timeout: 60000 });
}

// ── (a) SEALED ON THE WAY OUT ─────────────────────────────────────────
test.subHeading('The synced folder only ever receives one sealed file');
const made = run('backup.js', ['--from', from, '--to', to, '--passphrase-file', pass]);
const outFiles = fs.existsSync(to) ? fs.readdirSync(to) : [];
const sealedName = outFiles.find(function (n) { return /^spirit-backup-\d{8}-\d{6}\.tgz\.enc$/.test(n); });
const sealedBytes = sealedName ? fs.readFileSync(path.join(to, sealedName)) : Buffer.alloc(0);
// NOT READABLE MEANS NOT DECOMPRESSIBLE. The payload is a .tgz before it is
// sealed, and gzip alone already hides the key's text from a byte search, so
// 'the secret is not in the file' would pass with NO encryption at all. The
// check that bites: the file carries backup.js's header, and neither the
// whole file nor its body after the header (5 + salt 16 + iv 12 + tag 16)
// opens as gzip.
const zlib = require('zlib');
function gunzips(buf) { try { zlib.gunzipSync(buf); return true; } catch (e) { return false; } }
const HEADER = 5 + 16 + 12 + 16;
const sealedProperly = sealedBytes.subarray(0, 5).toString() === 'SPBK1'
  && !gunzips(sealedBytes) && !gunzips(sealedBytes.subarray(HEADER));
if (made.status === 0 && outFiles.length === 1 && sealedName && sealedProperly
    && sealedBytes.indexOf(SECRET) === -1) {
  test.check('one file lands in the target, sealed: it carries the backup header and its body will not even decompress without the passphrase');
} else {
  test.fail('backup: status ' + made.status + ' ' + (made.stderr || '').trim() + '; target holds ' + JSON.stringify(outFiles)
    + '; key readable: ' + (sealedBytes.indexOf(SECRET) !== -1));
}

// ── (b) WHOLE ON THE WAY BACK ─────────────────────────────────────────
test.subHeading('A restore gives back every file and every row');
const into = path.join(root, 'restored');
const back = sealedName ? run('restore.js', [path.join(to, sealedName), into, '--passphrase-file', pass]) : { status: -1 };
const restored = path.join(into, 'relay-state');
const plain = ['identity.json', 'contacts.json', 'traffic.jsonl'];
const same = plain.filter(function (n) {
  try { return fs.readFileSync(path.join(from, n)).equals(fs.readFileSync(path.join(restored, n))); } catch (e) { return false; }
});
let rows = -1;
let integrity = '';
try {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(restored, 'node.db'), { readOnly: true });
  rows = db.prepare('SELECT COUNT(*) AS n FROM replay').get().n;
  integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  db.close();
} catch (e) { integrity = String(e.message || e); }
if (back.status === 0 && same.length === plain.length) {
  test.check('identity, contacts and the log come back byte for byte');
} else {
  test.fail('restore: status ' + back.status + ' ' + ((back.stderr || '') + '').trim() + '; identical: ' + JSON.stringify(same));
}
if (rows === 200 && integrity === 'ok') {
  test.check('node.db comes back with all 200 rows and passes SQLite\'s integrity check');
} else {
  test.fail('node.db after restore: ' + rows + ' rows, integrity ' + integrity);
}

// ── (c) ONLY THE PASSPHRASE OPENS IT ──────────────────────────────────
test.subHeading('A wrong passphrase is refused, and no passphrase makes no backup');
const intruder = sealedName ? run('restore.js', [path.join(to, sealedName), path.join(root, 'intruder'), '--passphrase-file', wrong]) : { status: 0 };
const nothingOpened = !fs.existsSync(path.join(root, 'intruder', 'relay-state'));
if (intruder.status !== 0 && /cannot open/.test(intruder.stderr || '') && nothingOpened) {
  test.check('the wrong passphrase is refused by name, and nothing is unpacked');
} else {
  test.fail('wrong passphrase: status ' + intruder.status + ' ' + (intruder.stderr || '').trim());
}
const empty = path.join(root, 'empty-pass');
fs.writeFileSync(empty, '\n');
const to2 = path.join(root, 'drive2');
const refused = run('backup.js', ['--from', from, '--to', to2, '--passphrase-file', empty]);
if (refused.status !== 0 && /no passphrase/.test(refused.stderr || '') && !fs.existsSync(to2)) {
  test.check('with no passphrase, backup refuses and writes nothing: there is never an unencrypted backup');
} else {
  test.fail('empty passphrase: status ' + refused.status + ', wrote ' + (fs.existsSync(to2) ? fs.readdirSync(to2).join(',') : 'nothing'));
}

fs.rmSync(root, { recursive: true, force: true });
test.reportSuccessFailureCount();
