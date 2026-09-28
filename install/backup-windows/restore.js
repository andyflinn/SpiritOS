// Opens one backup made by backup.js into a folder, and checks it.
//
// transport/R19.1's proof is a restore, not a copy (wsl-claude: "a backup
// nobody has restored from is a hope"). So this unpacks into a NEW folder,
// never over a live relay-state, and runs SQLite's integrity check on every
// database it finds. Putting the result in place of a node's relay-state is
// a person's decision, done by hand with the node stopped.
//
//   node restore.js <backup.tgz.enc> <empty folder> [--passphrase-file <file>]

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { MAGIC, SCRYPT, TAR } = require('./backup.js');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function open(sealed, pass) {
  if (!sealed.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('not a SpiritOS backup (wrong header)');
  let at = MAGIC.length;
  const salt = sealed.subarray(at, at += 16);
  const iv = sealed.subarray(at, at += 12);
  const tag = sealed.subarray(at, at += 16);
  const key = crypto.scryptSync(pass, salt, 32, SCRYPT);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(sealed.subarray(at)), d.final()]); } catch (e) {
    throw new Error('cannot open: wrong passphrase, or the file was damaged');
  }
}

function main() {
  const file = process.argv[2];
  const into = process.argv[3];
  if (!file || !into || /^--/.test(file) || /^--/.test(into)) throw new Error('usage: node restore.js <backup.tgz.enc> <empty folder>');
  const passFile = path.resolve(arg('passphrase-file', path.join(os.homedir(), '.spirit-backup-passphrase')));
  const pass = fs.readFileSync(passFile, 'utf8').trim();
  fs.mkdirSync(into, { recursive: true });
  if (fs.readdirSync(into).length) throw new Error(into + ' is not empty; restore only into an empty folder');
  const tgz = path.join(into, 'relay-state.tgz');
  fs.writeFileSync(tgz, open(fs.readFileSync(file), pass));
  execFileSync(TAR, ['-xzf', tgz, '-C', into]);
  fs.unlinkSync(tgz);
  const dir = path.join(into, 'relay-state');
  const { DatabaseSync } = require('node:sqlite');
  const report = fs.readdirSync(dir).map(function (n) {
    if (!/\.db$/.test(n)) return n;
    const db = new DatabaseSync(path.join(dir, n), { readOnly: true });
    try { return n + ' (' + db.prepare('PRAGMA integrity_check').get().integrity_check + ')'; } finally { db.close(); }
  });
  console.log('restored into ' + dir + ': ' + report.join(', '));
}

try { main(); } catch (e) { console.error('restore FAILED: ' + e.message); process.exit(1); }
