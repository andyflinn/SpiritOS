'use strict';

// spirit/test/deprecations.js
// EVERY SHIM IS REGISTERED, AND EVERY REGISTERED SHIM IS FOUND.
//
//   Andy: "every official release must identify expired deprecation status
//   and address it with risk-assessment and then either elimination, or
//   backward compatibility."
//
// Decision 0014. The register is design/DEPRECATIONS.md; each row's id
// appears in the code as `DEPRECATED(D<n>, expires: <release>)` at every
// site belonging to it. This suite keeps the two in step, so a shim cannot
// be added without a row, and a row cannot outlive its code:
//
//   - every marker names a row, with the same expiry
//   - every `live` or `kept` row has at least one marker
//   - an `eliminated` row has none left
//   - a reserved id has no marker yet
//
// AT A RELEASE GATE: `node spirit/test/deprecations.js --release alpha`
// also fails on every live row expiring at that release with no decision
// written — which is the release not being allowed to ship.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const REGISTER = path.join(REPO, 'design', 'DEPRECATIONS.md');
const MARKER = /DEPRECATED\(D(\d+), expires: ([a-z0-9._-]+)\)/g;

// Where product code lives. Tests are not scanned: a suite that mentions
// a marker in prose (this one) is not a shim.
const ROOTS = [
  path.join(REPO, 'spirit', 'run'),
  path.join(REPO, 'bash'),
];
const TOP_LEVEL = fs.readdirSync(REPO)
  .filter(function (f) { return /\.js$/.test(f); })
  .map(function (f) { return path.join(REPO, f); });

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|html|sh)$/.test(e.name) || !/\./.test(e.name)) out.push(full);
  });
  return out;
}

function markersInTree() {
  const found = [];
  ROOTS.reduce(function (acc, d) { return walk(d, acc); }, TOP_LEVEL.slice()).forEach(function (file) {
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
    let m;
    MARKER.lastIndex = 0;
    while ((m = MARKER.exec(src))) {
      found.push({ id: 'D' + m[1], expires: m[2], file: path.relative(REPO, file) });
    }
  });
  return found;
}

// The first table is the register proper; the one under "## Reserved" holds
// ids set aside for code not written yet.
function readRegister() {
  const doc = fs.readFileSync(REGISTER, 'utf8');
  const cut = doc.indexOf('## Reserved');
  const main = cut === -1 ? doc : doc.slice(0, cut);
  const reserved = cut === -1 ? '' : doc.slice(cut);
  const rows = [];
  main.split('\n').forEach(function (line) {
    const cells = line.split('|').map(function (c) { return c.trim(); });
    if (cells.length < 7 || !/^D\d+$/.test(cells[1])) return;
    rows.push({ id: cells[1], expires: cells[4], status: cells[5], decision: cells[6] });
  });
  const reservedIds = [];
  reserved.split('\n').forEach(function (line) {
    const cells = line.split('|').map(function (c) { return c.trim(); });
    if (cells.length >= 3 && /^D\d+$/.test(cells[1])) reservedIds.push(cells[1]);
  });
  return { rows: rows, reserved: reservedIds };
}

test.startTest('Deprecations — every shim registered, every row found (decision 0014)');

function run() {
  const reg = readRegister();
  const markers = markersInTree();
  const byId = {};
  reg.rows.forEach(function (r) { byId[r.id] = r; });

  test.subHeading('The register and the code agree');

  if (reg.rows.length) {
    test.check('the register holds ' + reg.rows.length + ' rows; the tree holds ' + markers.length + ' markers');
  } else {
    test.fail('the register has no rows — is design/DEPRECATIONS.md readable?');
  }

  const strays = markers.filter(function (m) { return !byId[m.id]; });
  if (!strays.length) {
    test.check('every marker names a registered row');
  } else {
    strays.forEach(function (m) { test.fail(m.id + ' in ' + m.file + ' has no row in design/DEPRECATIONS.md'); });
  }

  const wrongExpiry = markers.filter(function (m) { return byId[m.id] && byId[m.id].expires !== m.expires; });
  if (!wrongExpiry.length) {
    test.check('and every marker carries its row’s expiry');
  } else {
    wrongExpiry.forEach(function (m) {
      test.fail(m.id + ' in ' + m.file + ' says ' + m.expires + '; the register says ' + byId[m.id].expires);
    });
  }

  reg.rows.forEach(function (r) {
    const sites = markers.filter(function (m) { return m.id === r.id; });
    if (r.status === 'live' || r.status === 'kept') {
      if (sites.length) test.check(r.id + ' (' + r.status + ') found at ' + sites.map(function (s) { return s.file; }).join(', '));
      else test.fail(r.id + ' is ' + r.status + ' but no marker for it remains in the code');
    } else if (r.status === 'eliminated') {
      if (!sites.length) test.check(r.id + ' eliminated, and no marker remains');
      else test.fail(r.id + ' is eliminated but still marked at ' + sites.map(function (s) { return s.file; }).join(', '));
    } else {
      test.fail(r.id + ' has status "' + r.status + '" — expected live, kept or eliminated');
    }
  });

  const early = markers.filter(function (m) { return reg.reserved.indexOf(m.id) !== -1; });
  if (!early.length) {
    test.check('no reserved id is in the code yet (' + (reg.reserved.join(', ') || 'none reserved') + ')');
  } else {
    early.forEach(function (m) { test.fail(m.id + ' is reserved but already marked in ' + m.file + ' — move its row into the register'); });
  }

  const at = process.argv.indexOf('--release');
  if (at !== -1 && process.argv[at + 1]) {
    const release = process.argv[at + 1];
    test.subHeading('Release gate: ' + release);
    const due = reg.rows.filter(function (r) { return r.expires === release && r.status === 'live'; });
    if (!due.length) test.check('nothing expires at ' + release + ' without a decision');
    due.forEach(function (r) {
      if (r.decision) test.check(r.id + ': ' + r.decision);
      else test.fail(r.id + ' expires at ' + release + ' and has no decision — assess, then eliminate or keep');
    });
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
