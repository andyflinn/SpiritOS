'use strict';

// spirit/test/boxesSuite.js
// HIS BOXES, SUMMED PER BOX, A WARNING WHEN OVER -- AND ONLY FROM HIS OWN
// SERVERS (public-app-server/G10, the node's half).
//
//   Andy: "go." on the node half, and before it: "over-committed is a
//   \"warning\" state only." -- "like an account sheet of rows, that must
//   add up to less or equal the the total resources". On keeping it in
//   memory: "the date is used on he spot to make decisions, and would
//   immediately go stale on disc".
//
// Built by claude-windows at 39bce45: boxes.js, fed by arrivals, answered
// as owner.boxes. Who counts as "his server" is relay-state/servers.json,
// owner-edited, read per report, absent means nobody -- agreed between the
// agents so that nobody else can invent a box in his view or hide one.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');
const boxes = require('../run/js/boxes');
const faceServer = require('../run/js/faceServer');

test.startTest('His boxes add up from his own servers, and over-committed is only ever a warning');

function world(serverKeys) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-boxes-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const file = path.join(root, 'relay-state', boxes.SERVERS);
  if (serverKeys) fs.writeFileSync(file, JSON.stringify({ keys: serverKeys }));
  const b = boxes.createBoxes({ rootDir: root, isEnvelope: packet.isEnvelope, decode: packet.decode });
  return {
    b: b,
    servers: function (keys) { fs.writeFileSync(file, JSON.stringify({ keys: keys })); },
    report: function (from, box) {
      b.onArrival({ from: from, text: packet.encode('', { box: box }).text });
    },
  };
}
function box(fp, allotted, total, label) {
  return { boxLabel: label || '', fingerprint: fp, allottedMB: allotted, boxTotalMB: total };
}

// ── ONLY HIS SERVERS COUNT ─────────────────────────────────────────────
{
  const w = world(['MINE']);
  w.report('MINE', box('fp1', 100, 1000, 'kitchen'));
  w.report('STRANGER', box('fp1', 900, 1000));
  w.report('STRANGER', box('fp-invented', 5000, 1000));
  const list = w.b.list();
  const one = list[0];
  if (list.length === 1 && one.fingerprint === 'fp1' && one.allottedMB === 100 && one.servers.length === 1
      && one.servers[0].key === 'MINE') {
    test.check('a report from a server on his list appears, and a stranger\'s reports -- one adding to his '
      + 'box, one inventing a box -- appear nowhere');
  } else {
    test.fail('reports taken: ' + JSON.stringify(list));
  }
}
{
  const w = world(null);
  w.report('MINE', box('fp1', 100, 1000));
  if (w.b.list().length === 0) {
    test.check('with no servers.json nobody counts as his server: absent means nobody');
  } else {
    test.fail('with no servers.json a report was taken: ' + JSON.stringify(w.b.list()));
  }
}

// ── THE SUM AND THE WARNING: EQUAL IS FINE, ONE OVER IS NOT ────────────
{
  const w = world(['A', 'B']);
  w.report('A', box('fp', 600, 1000));
  w.report('B', box('fp', 400, 1000));
  const equal = w.b.list()[0];
  w.report('B', box('fp', 401, 1000));
  const over = w.b.list()[0];
  w.report('B', box('fp', 100, 1000));
  const under = w.b.list()[0];
  if (equal.allottedMB === 1000 && equal.warning === false && over.allottedMB === 1001 && over.warning === true
      && under.warning === false) {
    test.check('two servers on one box are summed: exactly the total shows no warning, one MB over shows it, '
      + 'and under shows none -- "must add up to less or equal the the total resources"');
  } else {
    test.fail('equal ' + JSON.stringify(equal) + ', over ' + JSON.stringify(over) + ', under ' + JSON.stringify(under));
  }
}

// ── A WARNING, NEVER A REFUSAL ─────────────────────────────────────────
{
  const w = world(['A']);
  w.report('A', box('fp', 5000, 1000));
  const g = w.b.list()[0];
  if (g && g.warning === true && g.servers.length === 1 && g.allottedMB === 5000) {
    test.check('an over-committed server is still taken and shown, with the warning -- nothing is '
      + 'refused ("over-committed is a \\"warning\\" state only.")');
  } else {
    test.fail('over-committed report: ' + JSON.stringify(g));
  }
}

// ── NEWEST REPORT PER SERVER; BOXES KEPT APART BY FINGERPRINT ─────────
{
  const w = world(['A', 'B']);
  w.report('A', box('fp-one', 100, 1000));
  w.report('A', box('fp-one', 250, 1000));
  w.report('B', box('fp-two', 300, 2000));
  const list = w.b.list();
  const one = list.filter(function (g) { return g.fingerprint === 'fp-one'; })[0];
  const two = list.filter(function (g) { return g.fingerprint === 'fp-two'; })[0];
  if (list.length === 2 && one && one.allottedMB === 250 && two && two.allottedMB === 300) {
    test.check('a server\'s newest report replaces its last, and servers on different boxes are kept apart '
      + 'by fingerprint');
  } else {
    test.fail('newest/apart: ' + JSON.stringify(list));
  }
}

// ── READ PER ASK: A SERVER HE REMOVES STOPS COUNTING ───────────────────
//
// servers.json is his to edit and "absent means nobody". A server he takes
// off the list must leave his view -- not linger, with its allotment still
// counted towards a warning, until his node next restarts.
{
  const w = world(['A', 'B']);
  w.report('A', box('fp', 600, 1000));
  w.report('B', box('fp', 600, 1000));
  w.servers(['A']);
  const g = w.b.list()[0];
  const keys = g ? g.servers.map(function (s) { return s.key; }) : [];
  if (g && keys.join() === 'A' && g.allottedMB === 600 && g.warning === false) {
    test.check('a server he removes from servers.json leaves his view at once, and its allotment stops '
      + 'counting -- the list is read when he looks, not only when a report arrives');
  } else {
    test.fail('a REMOVED server still counts: servers ' + JSON.stringify(keys) + ', allotted ' + (g && g.allottedMB)
      + ', warning ' + (g && g.warning) + '. servers.json is checked only when a report ARRIVES, so a key '
      + 'he removes keeps its last report in his view, and its allotment in the sum, until the node restarts');
  }
}

// ── THE SERVER'S SIDE: FOUR FIELDS, NO OPINION, NOTHING READABLE ──────
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-boxreport-'));
  const r = faceServer.boxReport(root, 'starter');
  const keys = Object.keys(r).sort().join(',');
  const fp = String(r.fingerprint || '');
  const ips = [].concat.apply([], Object.values(os.networkInterfaces())).map(function (i) { return i.address; });
  const readable = fp.indexOf(os.hostname()) !== -1 || ips.some(function (ip) { return ip && fp.indexOf(ip) !== -1; });
  const again = faceServer.boxReport(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-boxreport-')), 'other').fingerprint;
  if (keys === 'allottedMB,boxLabel,boxTotalMB,fingerprint' && fp && !readable && again === fp) {
    test.check('a server reports exactly four facts about its box -- no opinion, no verdict -- and its '
      + 'fingerprint names this box the same way twice while carrying no hostname or address');
  } else {
    test.fail('box report ' + JSON.stringify(r) + '; readable in fingerprint: ' + readable + '; same twice: ' + (again === fp));
  }
}

test.reportSuccessFailureCount();
