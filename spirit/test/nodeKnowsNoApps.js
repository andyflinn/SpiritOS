'use strict';

// spirit/test/nodeKnowsNoApps.js
// THE NODE MAY BUILD A SYSTEM PACKET. IT MAY NEVER OPEN AN APP'S.
//
//   Andy: "nothing in node and relay should know about apps."
//
// WHAT THE DELETION ACTUALLY REMOVED, and the distinction this file
// exists to keep: `decorateWithPacket` parsed an ARRIVING payload and
// hung it on the row so a reader could tell its own traffic from another
// app's — the node decoding on behalf of a layer above it
// (arrivals.js:172-183). It forbade the node DECODING AN APP'S
// ENVELOPE. It never forbade the node COMPOSING ITS OWN, and the node
// already does: system packets carry no app at all, which is what makes
// them impossible for a puppet to claim.
//
// So the line is one sentence and it is asymmetric:
//
//   THE NODE LAYER MAY CALL packet.encode. IT MAY NEVER CALL
//   packet.decode.
//
// Asked for by the other agent as the thing that keeps the deletion
// honest once `require('./client/packet.js')` is back in hub.js — and
// written here rather than by him, because a suite written by the author
// of the change is the asymmetry gone.
//
// ── MATCHED BY THE BINDING, NOT BY THE WORD ─────────────────────────
//
// `.decode(` alone is wrong three times over: sseClient.js:298 and
// agents.js:443 call `decoder.decode(...)` on a TextDecoder, and a
// comment mentioning decode is not a call. So this resolves the NAME
// each file binds packet.js to and looks for that name's decode —
// matching what a file DOES rather than what it says, which is the third
// costume of a lesson this suite family has paid for twice.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

test.startTest('The node may build a system packet and may never open an app\'s');

const REPO = path.join(__dirname, '..', '..');
const NODE_DIR = path.join(REPO, 'spirit', 'run', 'js');
const SHELL_DIR = path.join(NODE_DIR, 'client');

function withoutComments(text) {
  return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// The local name a file binds packet.js to, or null if it does not take it.
function packetBinding(body) {
  const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\([^)]*client\/packet(?:\.js)?['"]\)/.exec(body);
  return m ? m[1] : null;
}

function jsFilesIn(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter(function (n) { return /\.js$/.test(n); })
    .map(function (n) { return path.join(dir, n); });
}

// ── THE NODE LAYER: js/*.js, NOT js/client/ ──────────────────────────
//
// `client/` is the SHELL, and the shell is the layer arrivals.js names
// as the one entitled to parse: "That reader is the SHELL, and the shell
// already loads packet.js — so the node was decoding an app envelope on
// behalf of a layer that can do it itself."
const offenders = [];
const builders = [];
jsFilesIn(NODE_DIR).forEach(function (full) {
  const rel = path.relative(REPO, full).split(path.sep).join('/');
  const body = withoutComments(fs.readFileSync(full, 'utf8'));
  const bound = packetBinding(body);
  if (!bound) return;
  if (new RegExp('\\b' + bound + '\\.decode\\s*\\(').test(body)) offenders.push(rel);
  if (new RegExp('\\b' + bound + '\\.encode\\s*\\(').test(body)) builders.push(rel);
});

if (!offenders.length) {
  test.check('no file in the node layer opens an app envelope — ' +
    (builders.length
      ? builders.length + ' of them compose one (' + builders.join(', ') + '), which is the half that is allowed'
      : 'and none composes one yet, which is also allowed'));
} else {
  test.fail('THE NODE IS DECODING AN APP ENVELOPE AGAIN: ' + offenders.join(', ') +
    '. arrivals.js:172-183 removed exactly this — the node parsing on behalf of the shell. ' +
    'Composing a system packet is allowed; opening an app\'s is not');
}

// ── THE CONTROL, AND THIS FILE NEEDS ONE MORE THAN MOST ─────────────
//
// Everything above is an absence. It is GREEN ON A TREE WHERE NOBODY
// REQUIRES packet.js AT ALL, and green if the binding regex stopped
// matching — a silent pass that would survive the very change it exists
// to catch. So: prove the detector can see a decode where one is
// legitimate. The shell and the puppets are entitled to decode, and if
// none of them reads as decoding, this file is measuring nothing.
const seers = [];
[SHELL_DIR, path.join(REPO, 'spirit', 'run', 'app')].forEach(function (root) {
  const stack = [root];
  while (stack.length) {
    const p = stack.pop();
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); });
      continue;
    }
    if (!/\.js$/.test(p)) continue;
    const body = withoutComments(fs.readFileSync(p, 'utf8'));
    const bound = packetBinding(body);
    if (!bound) continue;
    if (new RegExp('\\b' + bound + '\\.decode\\s*\\(').test(body)) {
      seers.push(path.relative(REPO, p).split(path.sep).join('/'));
    }
  }
});

if (seers.length) {
  test.check('and the detector can see a decode where one belongs — ' + seers.length +
    ' above the node boundary do it (' + seers.slice(0, 3).join(', ') +
    (seers.length > 3 ? ', …' : '') + '), so the absence above is measured rather than assumed');
} else {
  test.fail('THE CONTROL FAILED, so the assertion above proves nothing: nothing anywhere reads as ' +
    'decoding an app envelope, which means the binding is no longer being resolved and this suite ' +
    'would stay green through the change it exists to catch');
}

test.reportSuccessFailureCount();
