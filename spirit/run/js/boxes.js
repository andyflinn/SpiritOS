'use strict';
// spirit/run/js/boxes.js
// THE OWNER'S VIEW OF HIS BOXES — public-app-server/G10, the node's half.
//
// Each of his app servers reports four facts about the box it sits on
// (appServer.boxReport: boxLabel, fingerprint, allottedMB, boxTotalMB) and
// never an opinion. The arithmetic is here, on the one node that holds
// every report:
//
//   Andy: "the owner must match up servers tht share a box, and allot
//   resources smartly himself?" — answered: the NODE matches and sums, he
//   decides. And: "over-committed is a \"warning\" state only." Nothing is
//   ever refused because of it.
//
// IN MEMORY, BY DESIGN. Andy: "the date is used on he spot to make
// decisions, and would immediately go stale on disc." After a restart the
// view fills again as servers re-report.
//
// ONLY HIS SERVERS ARE BELIEVED (wsl-claude): a box report is a system
// packet, which any key can send, so an unchecked view could be given
// invented boxes or have an over-committed one hidden. A report is kept
// only from a key in relay-state/servers.json { "keys": [...] }, which the
// owner edits, read on every report, where absent means nobody. Any other
// sender is ignored silently.
//
// `decode` is handed in as a value: the node reads a SYSTEM packet here and
// never an app's (test/nodeKnowsNoApps.js).

const fs = require('fs');
const path = require('path');

const SERVERS = 'servers.json';

function createBoxes(opts) {
  const o = opts || {};
  const now = o.now || function () { return Date.now(); };
  const latest = Object.create(null);   // server key -> { box, at }

  function mine(key) {
    let raw = null;
    try { raw = fs.readFileSync(path.join(String(o.rootDir || ''), 'relay-state', SERVERS), 'utf8'); }
    catch (e) { return false; }
    let keys = null;
    try { keys = JSON.parse(raw).keys; } catch (e) { keys = null; }
    return Array.isArray(keys) && keys.indexOf(key) !== -1;
  }

  function onArrival(message) {
    const text = message && typeof message.text === 'string' ? message.text : '';
    if (!text || !o.isEnvelope(text)) return;
    const info = o.decode(text);
    if (!info || info.app || !info.body || typeof info.body.box !== 'object' || !info.body.box) return;
    const from = String((message && (message.fromKey || message.from)) || '');
    if (!from || !mine(from)) return;
    const b = info.body.box;
    latest[from] = {
      at: now(),
      box: {
        boxLabel: typeof b.boxLabel === 'string' ? b.boxLabel : '',
        fingerprint: typeof b.fingerprint === 'string' ? b.fingerprint : '',
        allottedMB: typeof b.allottedMB === 'number' ? b.allottedMB : null,
        boxTotalMB: typeof b.boxTotalMB === 'number' ? b.boxTotalMB : null,
      },
    };
  }

  // Grouped by fingerprint: one row per box, its servers, what they were
  // allotted in sum against what the box reports it has, and a warning when
  // the sum is over. Equal is not over.
  function list() {
    const byBox = Object.create(null);
    Object.keys(latest).forEach(function (key) {
      const r = latest[key];
      const fp = r.box.fingerprint || '';
      if (!byBox[fp]) byBox[fp] = { fingerprint: fp, boxLabel: '', boxTotalMB: null, allottedMB: 0, servers: [] };
      const g = byBox[fp];
      if (!g.boxLabel && r.box.boxLabel) g.boxLabel = r.box.boxLabel;
      if (typeof r.box.boxTotalMB === 'number') g.boxTotalMB = Math.max(g.boxTotalMB || 0, r.box.boxTotalMB);
      if (typeof r.box.allottedMB === 'number') g.allottedMB += r.box.allottedMB;
      g.servers.push({ key: key, allottedMB: r.box.allottedMB, at: r.at });
    });
    return Object.keys(byBox).map(function (fp) {
      const g = byBox[fp];
      g.warning = typeof g.boxTotalMB === 'number' && g.allottedMB > g.boxTotalMB;
      return g;
    });
  }

  return { onArrival: onArrival, list: list };
}

module.exports = { createBoxes: createBoxes, SERVERS: SERVERS };
