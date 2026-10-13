'use strict';

// spirit/run/process/js/desk/plugins/js/stackFrameChecks/violators.js
// A DOOR'S RUN AS ONE LINE PER VIOLATOR (goal/G22.3), for the Stacks tab's run dialog.
//
// Andy, 2026-10-13, on the run dialog: "much better, gimme that when i press run:", with the lines he wants, one per
// distinct violator, e.g.
//   hub.js:300 sealedClaim (from handleClaim) ---> GET /api/relay/key, bypassing createPeerPost
//   hub.js:2784 relaySummary (from relayGet and relaySearch, via ownerBadge probe) ---> GET /api/relay/key, bypassing createPeerPost
//   offboard.js:78 main ---> GET /api/relay/key by plain fetch, bypassing createPeerPost and relayRequest
// The stack-frame runner's verdict carries each path around the gate raw ("<what it reached> from <frame> < <frame>
// ..."); this turns them into those lines. Loaded by the plugin's server half; it is not a plugin of its own (no .json).
//
// A FRAME is "spirit/run/<file>.js:<line>[:<function>][ in <outer>]...": its function is its own name, or, when the
// line sits in an anonymous function, the first function it is written inside.
//
// THE RULE, in order:
//   the violator  the first frame, walking up from the call, outside the endpoint's own file and outside the request
//                 library (relayRequest.js): what put the call there.
//   its entry     the highest frame further up in the violator's file with the violator's function: where that
//                 function was entered. Frames of other files between the two are a "via" (the ownerBadge probe that
//                 calls back into relaySummary).
//   from          the function of the frame right above the entry, when it is in the same file and has a name: the
//                 sibling that called it. A caller in another file (server.js's dispatch) or top-level code is not said.
//   what reached  a node: endpoint's "METHOD /path"; a module endpoint's "<file>.js <exported function>".
//   bypassing     the gate's function; a node: endpoint reached with no frame of the request library below the
//                 violator also bypassed the library ("and relayRequest"), and is "by plain fetch" when the violator's
//                 own source line calls fetch(.
// Paths with the same violator and the same rest are one line; their froms and vias are joined ("from A and B").
// Lines keep the order their first path came in. A path that does not read as one is kept as it came.

const fs = require('fs');
const path = require('path');

const LIBRARY = 'spirit/run/js/relayRequest.js';
const LIBRARY_NAME = 'relayRequest';
const FRAME_RE = /^(spirit\/run\/(?:[^\s:]+\/)*[^\s:/]+\.js):(\d+)(?::([^\s]+))?((?: in [^\s]+)*)$/;

function frameOf(s) {
  const m = FRAME_RE.exec(String(s).trim());
  if (!m) return null;
  const outers = m[4] ? m[4].split(' in ').filter(Boolean) : [];
  return { file: m[1], line: Number(m[2]), fn: m[3] || outers[0] || '' };
}
function base(file) { return String(file).slice(String(file).lastIndexOf('/') + 1); }
function andJoin(list) {
  return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}
function addOnce(list, x) { if (x && list.indexOf(x) === -1) list.push(x); }

// One line per distinct violator, from a door ({ gate, endpoint }) and its run's raw paths. options.root is the repo
// the frames' files are read from (for "by plain fetch"); options.readLine(file, line) replaces that read.
function violators(door, paths, options) {
  const o = options || {};
  const node = /^node:/.test(String(door && door.endpoint));
  const endpoint = String((door && door.endpoint) || '');
  const gateFn = String((door && door.gate) || '').split('::')[1] || String((door && door.gate) || '');
  const sources = Object.create(null);
  const readLine = typeof o.readLine === 'function' ? o.readLine : function (file, line) {
    if (!o.root) return '';
    if (!(file in sources)) {
      try { sources[file] = fs.readFileSync(path.join(o.root, file), 'utf8').split('\n'); } catch (e) { sources[file] = []; }
    }
    return sources[file][line - 1] || '';
  };
  const order = [];
  const byKey = Object.create(null);
  (Array.isArray(paths) ? paths : []).forEach(function (raw) {
    const p = String(raw);
    const at = p.indexOf(' from ');
    const frames = at === -1 ? [] : p.slice(at + 6).split(' < ').map(frameOf);
    const where = at === -1 ? '' : p.slice(0, at);
    let v = -1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f && f.file !== LIBRARY && (node || f.file !== endpoint)) { v = i; break; }
    }
    if (v === -1) {
      if (!byKey[p]) { byKey[p] = { head: p, rest: '', froms: [], vias: [] }; order.push(p); }
      return;
    }
    const vf = frames[v];
    let entry = v;
    for (let i = frames.length - 1; i > v; i--) {
      if (frames[i] && frames[i].file === vf.file && frames[i].fn === vf.fn) { entry = i; break; }
    }
    const vias = [];
    for (let i = v + 1; i < entry; i++) {
      const f = frames[i];
      if (f && f.file !== vf.file) addOnce(vias, base(f.file).replace(/\.js$/, '') + (f.fn ? ' ' + f.fn : ''));
    }
    const up = frames[entry + 1];
    const from = up && up.file === vf.file && up.fn && up.fn !== vf.fn ? up.fn : '';
    const direct = node && !frames.slice(0, v).some(function (f) { return f && f.file === LIBRARY; });
    const fetched = direct && /(^|[^A-Za-z0-9_$.])fetch\s*\(/.test(readLine(vf.file, vf.line));
    const reached = node ? where + (fetched ? ' by plain fetch' : '') : base(endpoint) + ' ' + where;
    const head = base(vf.file) + ':' + vf.line + ' ' + (vf.fn || '(top level)');
    const rest = ' ---> ' + reached + ', bypassing ' + gateFn + (direct ? ' and ' + LIBRARY_NAME : '');
    const key = head + rest;
    if (!byKey[key]) { byKey[key] = { head: head, rest: rest, froms: [], vias: [] }; order.push(key); }
    addOnce(byKey[key].froms, from);
    vias.forEach(function (x) { addOnce(byKey[key].vias, x); });
  });
  return order.map(function (key) {
    const g = byKey[key];
    const said = [];
    if (g.froms.length) said.push('from ' + andJoin(g.froms));
    if (g.vias.length) said.push('via ' + andJoin(g.vias));
    return g.head + (said.length ? ' (' + said.join(', ') + ')' : '') + g.rest;
  });
}

module.exports = { violators: violators };
