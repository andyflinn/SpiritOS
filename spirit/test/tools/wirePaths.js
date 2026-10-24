'use strict';

// spirit/test/tools/wirePaths.js
// EVERY CALL STACK INSIDE OUR OWN CODE THAT REACHES THE WIRE, RANKED.
//
//   Andy, 2026-09-24, having crossed out his own first two ideas to get
//   here: "i would set an auto-observed breakpoint at the ultimate post
//   function. at that automated breakpoint i would track the stack in
//   that thread, and compile a list of where its called from during a
//   full harness run...."
//
//   The shape: "a ranked summary of all call paths to that bottom. you
//   two will spot a culprit in a jiffie."
//
//   And what a path is made of: "it's only the call points in our own
//   code, you have to show" — "the call stack inside our code..."
//
// ── WHY A STACK AND NOT A SEARCH ────────────────────────────────────
//
// He rejected searching for `require('HTTP')` himself, and the reason is
// the whole value of this tool: A FORK HAS NO REFERENCES TO FIND. It
// calls nothing, so nothing that looks for relationships can see it, and
// a SEMANTIC fork shares no token with the thing it duplicates — the
// fixed 8-second timeout found on 2026-09-24 shared no word with
// `grantedMs`, and no grep would ever have matched the two together.
//
// A STACK SEES ARRIVAL RATHER THAN RESEMBLANCE. Two pieces of code that
// solve the same problem usually reach the same bottom, whatever they
// are named, and the bottom is where they become visible as siblings.
//
// ── IT IS A METER, NOT A GATE ───────────────────────────────────────
//
// It fails nothing and declares nothing. `oneDoor.js` already gates WHICH
// FILES may touch the wire and fails on growth; a second gate on the same
// fact would be a fork of a gate. This answers a different question —
// which stacks actually arrive — and the judgement is a reader's.
//
// ── WHAT IT CANNOT SEE, PRINTED IN THE OUTPUT AND NOT ONLY HERE ─────
//
// IT FINDS FORKS THAT CONVERGE. A fork that bypasses the bottom is
// invisible to it: the raw `fetch` in `shell/starter/starter.html` ran in a
// browser, never in node, and was found by a suite READING THE FILE. A
// ranked list that does not say so reads as "these are all the ways this
// tree reaches the wire", which is false — and it would quietly retire
// the static check that caught the worst instance of the very thing this
// tool exists for.
//
// ── TWO MODES, ONE FILE ─────────────────────────────────────────────
//
//   node spirit/test/tools/wirePaths.js      run the harness, then report
//
// Preloaded into every suite process with `--require`, it is the probe;
// run directly, it is the runner. ONE FILE, because a probe and a
// reporter that disagree about the log format is a fork with two homes.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const SELF = path.resolve(__filename);

// ── THE BOTTOMS AN INTERFACE MAY FUNNEL INTO ────────────────────────
//
// DATA, NOT CODE. One probe, many interfaces — because the SOP that
// makes this tool standing practice would be defeated by a second copy
// of the tool.
//
// `wire` is the one this was built for and stays the default. The rest
// are the catch-up Andy named — *"this implies that there is some
// catchup-work to be done"* — and each is here because an interface
// exists that everything is supposed to go through:
//
//   fs-write   the filesystem, whose jail is per-tree rather than
//              per-app and whose scoped handle says in its own comment
//              that it is "not a security boundary"
//   seal       one sealer, or a cipher-key rotation goes half-applied
//   sign       one signer, over bytes assembled one way
//
// A BOTTOM THAT IS NOT LISTED IS NOT WATCHED, and that is the honest
// state rather than a gap: listing one is a line, and nobody should
// believe a probe covers what it was never pointed at.
// ── AND EACH BOTTOM CARRIES ITS OWN DEFAULT SUITES ──────────────────
//
// MEASURED, not assumed. The wire's three — Andy's *"then you need only
// one suite that makes every api call"* — are right for the wire and
// WRONG FOR THE FILESYSTEM: run against them, `fs-write` reported 384
// calls and NOT ONE production frame, because those suites write their
// own fixtures and never drive the node's file verbs.
//
// A probe pointed at the wrong suites does not fail. It reports
// honestly about a run that exercised nothing, and the output looks
// exactly like an interface with no duplicates in it.
const BOTTOMS = {
  wire: {
    watch: [
      { mod: 'http', fn: 'request' },
      { mod: 'https', fn: 'request' },
    ],
    suites: ['serverSurface.js', 'verbTable.js', 'protocolSurface.js'],
  },
  'fs-write': {
    watch: [
      { mod: 'fs', fn: 'writeFileSync' },
      { mod: 'fs', fn: 'appendFileSync' },
      { mod: 'fs', fn: 'rmSync' },
      { mod: 'fs', fn: 'unlinkSync' },
      { mod: 'fs', fn: 'mkdirSync' },
    ],
    // DELIBERATELY EMPTY, WHICH FORCES `--all` OR NAMED SUITES. Nobody
    // has yet said which suites drive the node's file verbs, and
    // guessing a set here would produce a quiet, plausible, empty
    // report. An empty default refuses; a wrong default reassures.
    suites: [],
  },
  // ── CRYPTO AND child_process ARE BOTTOMS. seal AND sign ARE NOT ─────
  //
  // The first version of this list had `seal` and `sign` as bottoms, and
  // wsl-claude's framing shows why that was wrong: THEY ARE THE
  // CHOKEPOINTS, not the floor. The assertion worth making is not "which
  // routes reach seal" — it is *every stack that reaches the PRIMITIVE
  // passes through a named SpiritOS chokepoint*, which asserts that the
  // funnel EXISTS rather than describing the contents of a list.
  //
  // The wire got that property free from Node, because `relayRequest` is
  // the only place a socket is opened. The filesystem never had it.
  //
  // THE COMPLETION CRITERION IS HIS AND IT IS DERIVABLE FROM THE TREE:
  // an interface is probeable when it has a PLATFORM-IMPOSED BOTTOM that
  // every use must pass through AND every passage means the same thing.
  //
  // THE DENOMINATOR IS PRODUCED BY ARRIVAL, NOT BY GREP, and this file
  // of all files must not get that backwards. An earlier draft counted
  // `require` sites with a pattern and said the answer was four. It was
  // five: the pattern was `[a-z_]+` and a colon is not in it, so
  // `node:sqlite` never appeared — and `relayStore.js:44` reaches disc
  // through exactly that, which is why `relay.db` is absent from every
  // fs reading. The deeper reason a pattern cannot do this is the one
  // recorded against `oneDoor`: `require(<variable>)` is invisible to
  // every pattern, so anything wanting to dodge the count only has to
  // not write the module's name.
  //
  // `process.moduleLoadList` records what the run actually loaded.
  // Filter to entries beginning `NativeModule ` and drop `internal/`.
  // Verified against the failure mode — a name assembled from a
  // variable still appears:
  //   node -e "const m='node:sq'+'lite'; require(m); ..."
  //   -> events, util/types, buffer, diagnostics_channel, async_hooks,
  //      timers, path, querystring, fs, util, url, module, SQLITE
  //
  // Pure or trivial passages — path, os, url, events, perf_hooks — mean
  // nothing in particular, which IS the test. Five carry a single
  // meaning: http/https, fs, node:sqlite, crypto and child_process.
  //
  // FOUR OF THE FIVE ARE BELOW. The store is not, and its absence is
  // deliberate rather than an oversight: its bottom is not a module
  // function but `DatabaseSync.prototype.exec` / `.prepare`, which the
  // patcher here cannot name, since a watch entry is `{ mod, fn }` and
  // `mod` is require()d whole. Building that is a change to the
  // patcher, not a row in this table, and nobody has asked for it.
  // Until then every fs reading is missing `relay-state/relay.db`, and
  // a reading that does not say so is lying by omission.
  crypto: {
    watch: [
      { mod: 'crypto', fn: 'sign' },
      { mod: 'crypto', fn: 'verify' },
      { mod: 'crypto', fn: 'generateKeyPairSync' },
      { mod: 'crypto', fn: 'createCipheriv' },
      { mod: 'crypto', fn: 'createDecipheriv' },
    ],
    suites: [],
  },
  'child-process': {
    watch: [
      { mod: 'child_process', fn: 'spawn' },
      { mod: 'child_process', fn: 'spawnSync' },
      { mod: 'child_process', fn: 'exec' },
      { mod: 'child_process', fn: 'execFileSync' },
    ],
    suites: [],
  },
};

// ── THE DOORS ARE THE PLUGIN'S LIST, NOT ROWS WRITTEN HERE (goal/G22.3) ──
//
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box), not this file's to loosen: "The plugin keeps the doors in
// spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameList.json, which the stack-frame test reads to know
// which checks to run." The three doors once written here as rows (presenceNode and postQueue, goal/G19.14; the relay,
// goal/G22.2) moved into it, their gates narrowed.
//
// ONE DOOR, ONE ENTRY: { gate, endpoint, paths?, suites, item }.
//
//   gate      NARROW: "spirit/run/<file>.js::<function>", one function. Andy: a whole module named as the gate is
//             cheating, so an entry without its ::function matches no frame and its door fails.
//   endpoint  WIDE: "spirit/run/<file>.js", the whole module, every function it exports and every function on what an
//             exported function returns (a factory's instance), so no side door is missed. Or, for what lies outside
//             our code, Node's own bottom: "node:" and its kinds joined by "+", of http (http.request), https
//             (https.request) and fetch (the global): "node:http+https+fetch".
//   paths     a node: endpoint only, and needed there: a request counts only when its path starts with one of them
//             (the relay's, ["/api/relay/"]; the why is at relayBound below).
//   suites    what drives it, MEASURED by an agent; empty until then, and an empty run is its red.
//   item      the desk item that asked for it.
//
// THE SUITES OF THE THREE DOORS MOVED IN, as measured when they were rows: presenceNode and postQueue are driven
// through a real node by serverSurface.js and everyVerb.js; the relay by agentOnboard.js (onboard.js and offboard.js
// against a lab relay and a real node, all five relay routes, the fetch in offboard.js among them) and serverSurface.js
// (hub.js asking a relay for its key at enrol); everyVerb.js reached nothing on a relay the two did not.
//
// Each door becomes a row of BOTTOMS under doorKey(), so the probe in a child process, given the same key, rebuilds the
// same row from the same file.
//
// THE LIST'S HOME IS THIS ONE CONSTANT, LIST_HOME, and one in the plugin (stackFrameChecks.js, LIST_HOME): moving the
// list is those two lines. A run started by the plugin's Run (goal/G22.3) names the list it used in SPIRIT_STACKS_LIST,
// so the runner and every probed child read that same list, a suite's scratch list included.
const LIST_HOME = path.join(REPO, 'spirit', 'run', 'process', 'js', 'desk', 'plugins', 'js', 'stackFrameChecks', 'stackFrameList.json');
const LIST = process.env.SPIRIT_STACKS_LIST ? path.resolve(process.env.SPIRIT_STACKS_LIST) : LIST_HOME;
const NODE_KINDS = {
  http: { mod: 'http', fn: 'request' },
  https: { mod: 'https', fn: 'request' },
  fetch: { global: 'fetch' },
};

function doors() {
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  if (!Array.isArray(list)) throw new Error(path.relative(REPO, LIST) + ' is not an array of doors');
  return list;
}
function doorKey(d) {
  return 'door ' + String(d.gate) + ' -> ' + String(d.endpoint) + (Array.isArray(d.paths) && d.paths.length ? ' ' + d.paths.join(',') : '');
}
function rowOf(d) {
  const row = { door: d, gate: String(d.gate), suites: Array.isArray(d.suites) ? d.suites : [] };
  const end = String(d.endpoint);
  if (/^node:/.test(end)) {
    row.watch = end.slice(5).split('+').map(function (k) { return NODE_KINDS[k]; }).filter(Boolean);
    row.paths = Array.isArray(d.paths) ? d.paths.map(String) : [];
  } else {
    row.file = end;
    row.wide = true;
  }
  return row;
}
// A list that does not read leaves BOTTOMS without doors; oneDoorStacks.js and stackFrameTestItems.js say so in red.
try { doors().forEach(function (d) { if (d && d.gate && d.endpoint) BOTTOMS[doorKey(d)] = rowOf(d); }); } catch (e) { /* said by the suites */ }
// A DOOR MEASURED BEFORE IT IS LISTED (goal/G22.3): measure() given a door object passes it down as SPIRIT_WIRE_DOOR,
// so an agent can say what a proposed gate or endpoint would read without writing the plugin's list, which is Andy's.
try {
  if (process.env.SPIRIT_WIRE_DOOR) { const d = JSON.parse(process.env.SPIRIT_WIRE_DOOR); BOTTOMS[doorKey(d)] = rowOf(d); }
} catch (e) { /* an unreadable door is measured as nothing, and its empty run says so */ }

// ── A FRAME CARRIES ITS FUNCTION, SO A GATE CAN NAME ONE (goal/G22.3) ──
//
// A frame is "file:line:function", or "file:line" when V8 names no function. THE FUNCTION IS THE LAST SEGMENT OF THE
// NAME V8 PRINTS, before any "[as alias]": "Object.post", "peerPost.post" and "async post" are all "post"; "new Thing"
// is "Thing"; "Object.holdStreams [as hold]" is "holdStreams", the function's own name as its file defines it, not the
// property it was reached through. "<anonymous>" is no name.
//
// ── AND THE FUNCTIONS IT IS WRITTEN INSIDE: THE COMPLETE FRAME (goal/G22.3) ──
//
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box), not this file's to undo: "you can construct a complete stackframe for
// anything that reaches endpoint. do it." A frame carries, after its own function, every named function its position
// is written inside in the source, innermost first, each after " in ":
//
//   spirit/run/spirit/peerPost.js:657 in sendAttempt in createPeerPost
//   spirit/run/spirit/peerPost.js:899:post in createPeerPost
//
// WHY: peerPost's instance functions (post, onRequest, holdStreams, sendAttempt, pump ...) are all written inside
// createPeerPost, which has returned long before any of them runs, so no live frame names it. The source does.
// Anonymous enclosing functions are left out (they cannot be a gate); the frame's own function is not repeated.
function frameName(file, line, v8name, enclosing) {
  let n = String(v8name || '').replace(/\s*\[as [^\]]*\]\s*$/, '').replace(/^(async|new)\s+/, '').trim();
  n = n.split('.').pop();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)) n = '';
  const outer = (enclosing || []).slice();
  if (n && outer[0] === n) outer.shift();
  return file + ':' + line + (n ? ':' + n : '') + outer.map(function (o) { return ' in ' + o; }).join('');
}
// A GATE file::F MATCHES a frame in that file whose function is F OR that is written anywhere inside F (Andy's decision
// above frameName). A gate without "::function" matches nothing.
function gateMatches(frame, gate) {
  const g = /^(.+)::([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(String(gate));
  if (!g) return false;
  const f = /^(.+?):(\d+)(?::([A-Za-z_$][A-Za-z0-9_$]*))?((?: in [A-Za-z_$][A-Za-z0-9_$]*)*)$/.exec(String(frame));
  if (!f || f[1] !== g[1]) return false;
  if (f[3] === g[2]) return true;
  return f[4].split(' in ').indexOf(g[2]) > 0;
}

// ── WHERE EACH FUNCTION IS WRITTEN: A SCANNER, NOT A PARSER (goal/G22.3) ──
//
// No JavaScript parser is in the tree (no acorn, no node_modules beyond chokidar and readdirp), and Node's own acorn is
// internal. So a small scanner: tokens, skipping comments, strings, template literals (their ${} expressions scanned as
// code) and regex literals (a "/" where an operand may start), with every bracket matched. Over the tokens it finds
// every function and where it starts and ends, by offset:
//
//   function [name] (...) {...}      its own name, else the name it is assigned to or the property it sits under
//   [async] (...) => ... / x => ...  the name it is assigned to or sits under; an expression body ends at the first
//                                    , ; ) ] } outside its brackets
//   name (...) {...}                 a method in an object or class (after { , ; } or get set static async *)
//   class [name] ... {...}           a class, named like a function
//
// Anything else is anonymous. What it gets wrong it gets wrong quietly in a frame's " in " chain, which only ever WIDENS
// what a gate matches by a name the file really has; tested on peerPost.js, hub.js and presenceNode.js when built.
const KEYWORDS = new Set(('if for while switch catch with function return typeof instanceof in of new delete void throw ' +
  'case do else yield await class const let var try finally super this import export default extends').split(' '));
const REGEX_AFTER = new Set('return typeof instanceof in of new delete void throw case do else yield await'.split(' '));
const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=',
  '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];

function scanTokens(src) {
  const toks = [];
  const braces = []; // 'b' for a {, 't' for a template's ${
  let i = 0;
  const n = src.length;
  if (src.slice(0, 2) === '#!') { while (i < n && src[i] !== '\n') i++; }
  const regexMayStart = function () {
    const p = toks[toks.length - 1];
    if (!p) return true;
    if (p.t === 'id') return REGEX_AFTER.has(p.v);
    if (p.t === 'p') return p.v !== ')' && p.v !== ']' && p.v !== '++' && p.v !== '--';
    return false;
  };
  // A template's text from i (just past ` or a closing } of ${), to its end or to the next ${.
  const templateText = function () {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') { toks.push({ t: 'p', v: '${', s: i, e: i + 2 }); braces.push('t'); i += 2; return; }
      i++;
    }
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === '﻿' || c === ' ') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; continue; }
    const s = i;
    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
      i++;
      toks.push({ t: 's', v: src.slice(s + 1, i - 1), s: s, e: i });
      continue;
    }
    if (c === '`') { i++; toks.push({ t: 's', v: '', s: s, e: s + 1 }); templateText(); continue; }
    if (/[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 127) {
      while (i < n && (/[A-Za-z0-9_$]/.test(src[i]) || src.charCodeAt(i) > 127)) i++;
      toks.push({ t: 'id', v: src.slice(s, i), s: s, e: i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      while (i < n && /[0-9A-Za-z_.]/.test(src[i])) i++;
      toks.push({ t: 'n', v: '', s: s, e: i });
      continue;
    }
    if (c === '/' && regexMayStart()) {
      i++;
      let cls = false;
      while (i < n && src[i] !== '\n') {
        const r = src[i];
        if (r === '\\') { i += 2; continue; }
        if (r === '[') cls = true; else if (r === ']') cls = false; else if (r === '/' && !cls) break;
        i++;
      }
      i++;
      while (i < n && /[A-Za-z]/.test(src[i])) i++;
      toks.push({ t: 'r', v: '', s: s, e: i });
      continue;
    }
    if (c === '{') { braces.push('b'); toks.push({ t: 'p', v: '{', s: s, e: ++i }); continue; }
    if (c === '}') {
      const was = braces.pop();
      toks.push({ t: 'p', v: '}', s: s, e: ++i });
      if (was === 't') templateText();
      continue;
    }
    let p = c;
    for (let k = 0; k < PUNCT.length; k++) { if (src.startsWith(PUNCT[k], i)) { p = PUNCT[k]; break; } }
    i += p.length;
    toks.push({ t: 'p', v: p, s: s, e: i });
  }
  return toks;
}

// Every function in a source text: [{ name, start, end }], offsets, name '' when anonymous.
function functionRanges(src) {
  const toks = scanTokens(src);
  // Brackets matched both ways; a ${ closes with a }.
  const match = new Array(toks.length).fill(-1);
  const open = [];
  toks.forEach(function (t, k) {
    if (t.t !== 'p') return;
    if (t.v === '(' || t.v === '[' || t.v === '{' || t.v === '${') open.push(k);
    else if (t.v === ')' || t.v === ']' || t.v === '}') { const o = open.pop(); if (o !== undefined) { match[o] = k; match[k] = o; } }
  });
  const is = function (k, v) { return k >= 0 && k < toks.length && toks[k].t === 'p' && toks[k].v === v; };
  const id = function (k) { return k >= 0 && k < toks.length && toks[k].t === 'id' ? toks[k].v : ''; };
  // The name a function or class starting at token k is assigned to or sits under: x = ..., a.x = ..., x: ..., 'x': ...
  const assigned = function (k) {
    const p = k - 1;
    if (!(is(p, '=') || is(p, ':') || is(p, '||=') || is(p, '??=') || is(p, '&&='))) return '';
    const left = toks[p - 1];
    if (!left) return '';
    if (left.t === 'id' && !KEYWORDS.has(left.v)) return left.v;
    if (left.t === 's' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(left.v)) return left.v;
    return '';
  };
  const out = [];
  const add = function (name, first, last) { if (last >= first && last < toks.length) out.push({ name: name, start: toks[first].s, end: toks[last].e }); };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'id' && t.v === 'function' && !is(k - 1, '.')) {
      let j = k + 1;
      if (is(j, '*')) j++;
      const own = id(j) && !is(j, '(') ? id(j) : '';
      if (own) j++;
      if (!is(j, '(') || match[j] === -1 || !is(match[j] + 1, '{')) continue;
      const first = id(k - 1) === 'async' ? k - 1 : k;
      add(own || assigned(first), first, match[match[j] + 1]);
    } else if (t.t === 'id' && t.v === 'class' && !is(k - 1, '.')) {
      let j = k + 1;
      const own = id(j) && id(j) !== 'extends' ? id(j) : '';
      while (j < toks.length && !is(j, '{')) j = match[j] > j ? match[j] + 1 : j + 1;
      if (j < toks.length && match[j] > j) add(own || assigned(k), k, match[j]);
    } else if (t.t === 'p' && t.v === '=>') {
      let first = -1;
      if (is(k - 1, ')') && match[k - 1] !== -1) first = match[k - 1];
      else if (id(k - 1)) first = k - 1;
      if (first === -1) continue;
      if (id(first - 1) === 'async') first--;
      let last;
      if (is(k + 1, '{') && match[k + 1] > k) last = match[k + 1];
      else {
        let j = k + 1;
        last = k;
        while (j < toks.length) {
          const u = toks[j];
          if (u.t === 'p' && (u.v === ',' || u.v === ';' || u.v === ')' || u.v === ']' || u.v === '}')) break;
          last = match[j] > j ? match[j] : j;
          j = last + 1;
        }
      }
      add(assigned(first), first, last);
    } else if (t.t === 'id' && !KEYWORDS.has(t.v) && is(k + 1, '(') && match[k + 1] > k && is(match[k + 1] + 1, '{')) {
      const p = toks[k - 1];
      const before = !p || (p.t === 'p' && (p.v === '{' || p.v === ',' || p.v === ';' || p.v === '}' || p.v === '*')) ||
        (p.t === 'id' && (p.v === 'get' || p.v === 'set' || p.v === 'static' || p.v === 'async'));
      if (before) add(t.v, k, match[match[k + 1] + 1]);
    }
  }
  return out;
}

// For a file and a 1-based line and column, the named functions written around that position, innermost first.
// Each file is read and scanned once per process; a file that does not read gives no chain.
const rangesByFile = new Map();
function enclosingAt(file, line, col) {
  let entry = rangesByFile.get(file);
  if (!entry) {
    entry = { lines: [0], ranges: [] };
    try {
      const src = fs.readFileSync(file, 'utf8');
      for (let k = 0; k < src.length; k++) if (src.charCodeAt(k) === 10) entry.lines.push(k + 1);
      entry.ranges = functionRanges(src);
    } catch (e) { /* no chain */ }
    rangesByFile.set(file, entry);
  }
  const at = entry.lines[Number(line) - 1];
  if (at === undefined) return [];
  const off = at + Math.max(0, Number(col) - 1);
  return entry.ranges
    .filter(function (r) { return r.name && r.start <= off && off < r.end; })
    .sort(function (a, b) { return b.start - a.start; })
    .map(function (r) { return r.name; });
}

// ── OUR OWN CODE, AND NOTHING ELSE ──────────────────────────────────
//
// Andy: "it's only the call points in our own code, you have to show."
// Node's internals are not call points anybody can fix, and a stack made
// mostly of them buries the frames that matter. Dropped: anything outside
// the repo, node's own modules, dependencies, and this probe.
//
// A PLANTED COPY OF spirit/run IS OURS TOO (goal/G19.14). A suite that
// boots a real node copies the run tree into a temp home (plantRun.js)
// and starts spirit/server.js there, so every frame of that node sat outside
// the repo and was dropped — and a node is exactly where a component is
// reached in production. Named by its path from `spirit/run/` on, as if
// it were the repo's.
//
// Returns the repo-relative name, or '' for a frame that is not ours.
function ours(file) {
  if (!file) return '';
  const f = String(file).replace(/\\/g, '/');
  if (f.indexOf('node:') === 0) return '';
  if (f.indexOf('internal/') === 0) return '';
  if (f.indexOf('node_modules') !== -1) return '';
  const abs = path.resolve(f);
  if (abs === SELF) return '';
  if (abs.toLowerCase().indexOf(REPO.toLowerCase()) === 0) {
    return path.relative(REPO, abs).replace(/\\/g, '/');
  }
  const slashed = abs.replace(/\\/g, '/');
  const at = slashed.lastIndexOf('/spirit/run/');
  return at === -1 ? '' : slashed.slice(at + 1);
}

// THE WHOLE CHAIN, not the nearest frame. Andy: "the call stack inside
// our code". One call point tells you where the wire was touched; the
// STACK tells you which route got there, and two routes to one bottom is
// the thing being hunted.
function callStack() {
  const holder = {};
  // ── THE LIMIT IS THE DOMINANT COST ──────────────────────────────────
  //
  // wsl-claude, refusing the first version: a per-call `new Error().stack`
  // is one of the more expensive things V8 does, and it would land on
  // every call in timing-sensitive worlds — a claim limiter at ten a
  // minute, windows a suite waits on, "back in N ms against the M ms
  // members are told". Capturing 10 frames to keep 3 of ours is most of
  // the price for none of the answer.
  //
  // Raised and restored around the capture, never set globally: a probe
  // that leaves V8 configured differently has changed the program it is
  // observing in a way nothing downstream can see.
  const was = Error.stackTraceLimit;
  Error.stackTraceLimit = 24;
  Error.captureStackTrace(holder, callStack);
  Error.stackTraceLimit = was;
  const out = framesOf(holder);
  if (placers) joinPlacers(out, placers());
  return out;
}

// One captured stack, as frames of ours, nearest first.
function framesOf(holder) {
  const lines = String(holder.stack || '').split('\n').slice(1);
  const out = [];
  // THE FUNCTION'S NAME IS KEPT (goal/G22.3): "at <name> (<file>:<line>:<col>)", or "at <file>:<line>:<col>" with no
  // name; frameName() says which part of the name is kept. THE COLUMN IS READ (goal/G22.3) so the position is exact
  // when enclosingAt() finds the functions it is written inside; the frame shows the line only.
  lines.forEach(function (line) {
    let m = /^\s*at\s+(.*?)\s+\(([^()]+):(\d+):(\d+)\)\s*$/.exec(line);
    let fn = '';
    let file = '';
    let at = '';
    let col = '';
    if (m) { fn = m[1]; file = m[2]; at = m[3]; col = m[4]; } else {
      m = /\bat\s+([^()\s]+):(\d+):(\d+)\s*$/.exec(line);
      if (m) { file = m[1]; at = m[2]; col = m[3]; }
    }
    const name = file && ours(file);
    if (!name) return;
    out.push(frameName(name, at, fn, enclosingAt(file, at, col)));
  });
  return out;
}

// ── A CALLBACK'S STACK IS JOINED TO ITS PLACER'S (goal/G22.3) ───────
//
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box), not this file's to undo: "the probe uses async_hooks: when a callback
// is placed, it keeps the placer's stack and joins it under the callback's stack, so the walk reaches the named function
// that set it up." Test-only, and probed runs are slower for it; that price was accepted with the decision.
//
// WHY: a callback runs on a fresh stack. peerPost's relay post (`Promise.resolve().then(function () { return
// request(...) })`) reached the wire with no frame of the named function that queued it, so no gate could match it.
//
// THE JOINT IS A FRAME OF ITS OWN, PLACED: "<callback's frames> < (placed by) < <placer's frames> < (placed by) < ...".
// It is joined with the same " < " every reader splits on, and it starts with neither "spirit/run/" nor a file, so it
// is never a production frame, never matches a gate, and is never last (no joint without frames after it).
//
// BOUNDED: at most JOIN_HOPS placers, JOIN_FRAMES frames in all, and a frame already in the stack is not repeated.
const PLACED = '(placed by)';
const JOIN_HOPS = 8;
const JOIN_FRAMES = 64;
let placers = null; // set by the probe: the current callback's chain of placer stacks, nearest first
function joinPlacers(out, chain) {
  if (!chain) return;
  const seen = new Set(out);
  for (let i = 0; i < chain.length && i < JOIN_HOPS; i++) {
    const frames = framesOf(chain[i]).filter(function (f) { return !seen.has(f); });
    if (!frames.length) continue;
    if (out.length) out.push(PLACED);
    for (let j = 0; j < frames.length && out.length < JOIN_FRAMES; j++) { seen.add(frames[j]); out.push(frames[j]); }
    if (out.length >= JOIN_FRAMES) break;
  }
}

// ── PROBE MODE ──────────────────────────────────────────────────────
if (process.env.SPIRIT_WIRE_LOG && require.main !== module) {
  const counts = new Map();

  // ── EVERY PLACED CALLBACK KEEPS ITS PLACER'S STACK (goal/G22.3, Andy's decision above joinPlacers) ──
  //
  // init: an async resource (a promise, a timer, a socket) is being created, which is the moment a callback is placed.
  // Its stack is captured there, and its chain is that stack followed by the chain of what was running when it was
  // placed (the current execution's resource; the trigger when that one has none), cut to JOIN_HOPS. The chain copies
  // references, so a record never holds more than JOIN_HOPS stacks however long a loop of callbacks runs.
  //
  // CAPTURED, NOT FORMATTED: V8 formats `.stack` on first read, so a placer nobody reaches the endpoint from costs the
  // capture and never the formatting. The limit is raised and restored around it, as in callStack().
  //
  // FREED on destroy (a promise's when it is collected). MAX_RECORDS drops the oldest past that, so a process that
  // creates resources faster than it collects them stays bounded; a callback whose placer was dropped records its own
  // stack only, which is what it recorded before the decision.
  const asyncHooks = require('async_hooks');
  const records = new Map();
  // MEASURED 2026-10-13 (node 24.20): a capture from inside the hook costs ~25 microseconds even at one frame, so a
  // promise-bound loop of 200k awaits went from 0.06 s to 26 s; the suites that drive the doors wait on I/O and did
  // not move (the relay door's two: 59.3 s without, 58.7 s with). The price Andy accepted with the decision.
  const MAX_RECORDS = 20000;
  const placed = function placed(asyncId, type, triggerAsyncId) {
    const holder = {};
    const was = Error.stackTraceLimit;
    Error.stackTraceLimit = 24;
    Error.captureStackTrace(holder, placed);
    Error.stackTraceLimit = was;
    const up = records.get(asyncHooks.executionAsyncId()) || records.get(triggerAsyncId);
    records.set(asyncId, up ? [holder].concat(up.slice(0, JOIN_HOPS - 1)) : [holder]);
    if (records.size > MAX_RECORDS) records.delete(records.keys().next().value);
  };
  asyncHooks.createHook({
    init: placed,
    destroy: function (asyncId) { records.delete(asyncId); },
  }).enable();
  placers = function () { return records.get(asyncHooks.executionAsyncId()) || null; };

  // ── WHICH ENDPOINT, NOT ONLY WHICH STACK ────────────────────────────
  //
  //   Andy: "so, that suite will have a set of endpoints we can check in
  //   the same go....."
  //
  // The probe is already standing at the moment the request is composed,
  // so the METHOD and PATH cost nothing extra — and they answer a second
  // question the tree has never been able to ask from the outside: WHICH
  // ENDPOINTS DOES OUR CODE ACTUALLY CALL, and from where.
  //
  // That is the other half of the fork hunt. Two scopes reaching one
  // ENDPOINT is the same finding as two scopes reaching one bottom, and
  // it is legible without reading a stack at all: `GET /api/relay/key`
  // called from two places is a duplicate whatever the routes look like.
  //
  // It is also the live half of the protocol inventory: a declared route
  // that no stack ever calls is a route with no caller, and a path called
  // here that the relay does not route is a caller with no route. Neither
  // is decidable by reading either side alone.
  //
  // The QUERY IS DROPPED. It carries tokens and it splits one endpoint
  // into as many rows as there were values.
  const endpointOf = function (args) {
    const a = args[0];
    let method = '';
    let target = '';
    if (typeof a === 'string' || (a && a.href)) {
      try { target = new URL(String(a.href || a)).pathname; } catch (e) { target = String(a); }
      const opts = args[1];
      method = (opts && opts.method) || 'GET';
    } else if (a && typeof a === 'object' && typeof a.url === 'string') {
      // A fetch Request (goal/G22.2): its url and its own method.
      try { target = new URL(a.url).pathname; } catch (e) { target = a.url; }
      method = (args[1] && args[1].method) || a.method || 'GET';
    } else if (a && typeof a === 'object') {
      method = a.method || 'GET';
      target = String(a.path || a.pathname || '');
    }
    return String(method).toUpperCase() + ' ' + String(target).split('?')[0];
  };

  // ── THE FIRST SIGHTING OF A STACK IS WRITTEN AT ONCE ────────────────
  //
  // A node a suite spawns is killed, not asked to exit, and a killed
  // process runs no `exit` handler: everything it saw was lost. So a stack
  // seen for the first time goes to the log as it is seen — once per
  // distinct stack, never per call — and the exit handler below writes
  // only the calls counted after that.
  const written = new Map();
  const count = function (key) {
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (n !== 1) return;
    written.set(key, 1);
    try { fs.appendFileSync(process.env.SPIRIT_WIRE_LOG, '1\t' + key + '\n'); } catch (e) { written.delete(key); }
  };

  // `label` says which endpoint a call is: the request line for the wire,
  // the function's own name for a module of ours.
  // `keep`, when given, decides from the endpoint whether a call counts at
  // all (a relayOnly row: see relayBound below).
  const patch = function (mod, method, label, keep) {
    const original = mod[method];
    if (typeof original !== 'function') return;
    mod[method] = function () {
      const stack = callStack();
      // A call with no frame of ours is node talking to itself, and there
      // is no call point in our code to show.
      if (stack.length) {
        let where = '';
        try { where = label ? label(arguments) : endpointOf(arguments); } catch (e) { where = '(unreadable)'; }
        if (!keep || keep(where)) count(where + '\t' + stack.join(' < '));
      }
      return original.apply(this, arguments);
    };
  };

  // A FACTORY'S INSTANCE IS PART OF THE COMPONENT. Every function on what
  // it returns is patched the same way, named `factory().method`, so a
  // caller holding the instance is seen as clearly as one calling the
  // factory.
  const patchFactory = function (mod, fn) {
    const original = mod[fn];
    if (typeof original !== 'function') return;
    patch(mod, fn, function () { return fn; });
    const counted = mod[fn];
    mod[fn] = function () {
      const made = counted.apply(this, arguments);
      if (made && typeof made === 'object') {
        Object.keys(made).forEach(function (k) {
          if (typeof made[k] !== 'function') return;
          patch(made, k, function () { return fn + '().' + k; });
        });
      }
      return made;
    };
  };

  // A MODULE OF OURS IS PATCHED AS IT LOADS, not loaded by the probe: a
  // probe that required presenceNode into every relay it rides would be
  // changing what each process carries. After Module._load returns the
  // exports and before the caller reads a property off them.
  //
  // Matched by name from `spirit/run/` on (see ours()), so the copy a
  // planted node runs is watched as the repo's own file would be.
  const watchFile = function (row) {
    const Module = require('module');
    const load = Module._load;
    const base = path.basename(row.file, '.js');
    const done = new Set();
    Module._load = function (request, parent) {
      const exported = load.apply(this, arguments);
      if (typeof request === 'string' && path.basename(request, '.js') === base) {
        let file = '';
        try { file = Module._resolveFilename(request, parent); } catch (e) { file = ''; }
        const m = file && !done.has(file) && ours(file) === row.file ? require.cache[file] : null;
        // `loaded`, because the module sits in the cache while it is still
        // requiring its own dependencies, before it has exported anything.
        if (m && m.loaded === true && m.exports) {
          done.add(file);
          // THE ENDPOINT IS WIDE (Andy, goal/G22.3): every function the module exports, each watched as a factory
          // too, so whatever an exported function returns has its functions watched as well. Own enumerable keys
          // only: a class instance's prototype methods are not reached, and no module of ours that is a door's
          // endpoint today returns one.
          Object.keys(m.exports).forEach(function (k) {
            if (typeof m.exports[k] === 'function') patchFactory(m.exports, k);
          });
        }
      }
      return exported;
    };
  };

  // ── THE BOTTOM IS AN ARGUMENT, WHICH IS THE RULE APPLIED TO ITSELF ──
  //
  //   Andy, 2026-09-25, making this standing practice: "when an interface
  //   is designed/implemented, it would be SOP to protect those
  //   interfaces from duplication using that technique."
  //
  // A technique copied once per interface is exactly the thing the rule
  // exists to prevent. So the bottoms are DECLARED DATA in one place and
  // the mechanism is inherited — the plugin pattern, for the third time
  // this week.
  //
  // Each entry names the module and the function an interface funnels
  // into. Adding one is a line; writing a second probe would be a fork.
  // THE PAIR, NOT A FUNCTION — wsl-claude's correction to the shape, and
  // it is a fact about how the patch works rather than a preference: it
  // replaces a PROPERTY on a required module (`mod[method] = ...`), so
  // `probe(require('fs'), 'writeFileSync')` works identically and
  // `probe(seal.seal)` does not exist as a shape at all.
  const row = BOTTOMS[process.env.SPIRIT_WIRE_BOTTOM] || BOTTOMS.wire;
  // ── ADDRESSED TO THE DOOR'S PATHS, read off the request path (goal/G22.2, the paths from the list since goal/G22.3) ──
  //
  // The relay's door counts a request only when it is addressed to a relay. Not by host: a lab relay listens on
  // 127.0.0.1 exactly like a process's own node, so "not loopback" would miss every relay a suite starts. BY PATH:
  // every route a relay answers for a member sits under /api/relay/ (key, stream, claim, post, reply; relayServer.js's
  // public table), and a node answers none of them (server.js: "A node no longer answers any relay route"), so a
  // process asking its own node (/api/spirit, /api/events) is never counted. /api/version is answered by both and asks
  // nothing of a relay's members, so it is left out.
  //
  // fetch is watched beside http and https because global fetch goes through undici and never through http.request:
  // without it a fetch to a relay is invisible here.
  //
  // An endpoint the probe could not read is counted: a request nobody can place must not pass as one that went
  // elsewhere.
  const onPaths = function (where) {
    if (where === '(unreadable)') return true;
    const p = String(where).slice(String(where).indexOf(' ') + 1);
    return row.paths.some(function (want) { return p.indexOf(want) === 0; });
  };
  const keep = Array.isArray(row.paths) ? onPaths : null;
  if (row.file) watchFile(row);
  else {
    (row.watch || []).forEach(function (b) {
      // A GLOBAL, such as fetch: patched on globalThis, read like a request.
      if (b.global) patch(globalThis, b.global, null, keep);
      else patch(require(b.mod), b.fn, null, keep);
    });
  }

  // WRITTEN AT EXIT, NOT PER CALL. Appending on every request would make
  // the instrument a participant in what it measures, and this harness
  // has timing-sensitive worlds: a diminishing timeout, a claim limiter
  // at ten a minute, windows a suite waits on. An instrument that changes
  // the thing it observes is worse than no instrument. (Only a stack's
  // first sighting is written as it happens — see `count` above.)
  process.on('exit', function () {
    const lines = [];
    counts.forEach(function (n, key) {
      const left = n - (written.get(key) || 0);
      if (left > 0) lines.push(left + '\t' + key);
    });
    if (!lines.length) return;
    try {
      fs.appendFileSync(process.env.SPIRIT_WIRE_LOG, lines.join('\n') + '\n');
    } catch (e) {
      // A probe that cannot write must not break the run it observes.
    }
  });
}

// ── RUNNER MODE ─────────────────────────────────────────────────────
// ── ONE MEASUREMENT, FOR THE RUNNER BELOW AND FOR A SUITE ────────────
//
// Runs the named suites (or, with `all`, the harness) under the probe for
// one bottom and hands back what arrived: `counts` keyed
// `endpoint \t stack`, the runs' own output, and their status. The
// runner prints it; oneDoorStacks.js (goal/G19.14) judges it. One home
// for the spawning and the log format, so the two cannot disagree.
function measure(bottom, targets, all) {
  const { spawnSync } = require('child_process');
  const os = require('os');
  // A door object, listed or not, is measured under its key (SPIRIT_WIRE_DOOR above).
  const door = bottom && typeof bottom === 'object' ? bottom : null;
  if (door) bottom = doorKey(door);

  // A door's key carries a path, "::" and "->" (doorKey), none of them a file name's: reduced to a plain word.
  const log = path.join(os.tmpdir(), 'spirit-wire-' + process.pid + '-' + String(bottom).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80) + '.tsv');
  try { fs.unlinkSync(log); } catch (e) { /* not there yet */ }

  const runner = path.join(REPO, 'spirit', 'test', 'runAll.js');
  const env = Object.assign({}, process.env, {
    SPIRIT_WIRE_LOG: log,
    // WHICH BOTTOM, PASSED DOWN. `--bottom fs-write` and the probe in
    // every child instruments the filesystem instead of the wire. An
    // unknown name is refused above rather than silently falling back to
    // the wire, because a probe that watched something other than what
    // was asked for is worse than one that refused.
    SPIRIT_WIRE_BOTTOM: bottom,
    SPIRIT_WIRE_DOOR: door ? JSON.stringify(door) : '',
    // EVERY SUITE PROCESS IS INSTRUMENTED AND NO SUITE KNOWS. runAll is
    // not touched, and a suite that had to opt in is a suite that can
    // forget to — which would make the quiet paths the unwatched ones.
    NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' +
      SELF.replace(/\\/g, '/')).trim(),
  });

  let r;
  if (all) {
    r = spawnSync(process.execPath, [runner], { env: env, encoding: 'utf8', maxBuffer: 1 << 28 });
  } else {
    r = { status: 0, stdout: '' };
    targets.forEach(function (t) {
      const one = spawnSync(process.execPath, [path.join(REPO, 'spirit', 'test', t)], {
        env: env, encoding: 'utf8', maxBuffer: 1 << 26,
      });
      r.stdout += String(one.stdout || '');
      if (one.status) r.status = one.status;
    });
  }

  const counts = new Map();
  let raw = '';
  try { raw = fs.readFileSync(log, 'utf8'); } catch (e) { raw = ''; }
  // count \t endpoint \t stack — split on the FIRST tab only, because the
  // key carries one of its own.
  raw.split('\n').filter(Boolean).forEach(function (line) {
    const at = line.indexOf('\t');
    if (at === -1) return;
    const n = Number(line.slice(0, at)) || 0;
    const key = line.slice(at + 1);
    counts.set(key, (counts.get(key) || 0) + n);
  });
  try { fs.unlinkSync(log); } catch (e) { /* leave it behind */ }
  return { out: String(r.stdout || ''), status: r.status, counts: counts };
}

module.exports = { BOTTOMS: BOTTOMS, measure: measure, LIST: LIST, LIST_HOME: LIST_HOME, doors: doors, doorKey: doorKey, frameName: frameName, gateMatches: gateMatches, functionRanges: functionRanges, enclosingAt: enclosingAt };

if (require.main === module) {
  // ── ONE SUITE, NOT THE HARNESS — AND THAT IS ANDY'S SIMPLIFICATION ──
  //
  //   Andy, 2026-09-24, to wsl-claude while this agent was building:
  //   "then you need only one suite that makes every api call."
  //
  // THE FIRST VERSION INSTRUMENTED THE WHOLE HARNESS, and wsl-claude
  // refused it on the grounds that it walked that sentence back. He is
  // right, and the reason is not cost: HIS SENTENCE DELETED THE
  // PERTURBATION PROBLEM rather than managing it. `NODE_OPTIONS` inherits
  // into every spawned child, so a whole-harness run instruments
  // labMaster's fixture relays and nodes too — and those are exactly the
  // timing-sensitive worlds: a claim limiter at ten a minute, `answering`
  // windows with fixed deadlines, the diminishing timeout, and every
  // assertion of the form "back in N ms against the M ms members are
  // told". A probe over one small suite never touches any of them.
  //
  // So the default is the named suites, and the whole harness is an
  // explicit `--all` that says what it is paying for.
  // `--bottom <name>`, defaulting to the wire. REFUSED rather than
  // defaulted when unknown: a probe that watched something other than
  // what was asked for would report honestly about the wrong thing.
  const bottomAt = process.argv.indexOf('--bottom');
  const bottom = bottomAt === -1 ? 'wire' : String(process.argv[bottomAt + 1] || '');
  if (!BOTTOMS[bottom]) {
    console.error('Unknown bottom ' + JSON.stringify(bottom) + '. Declared: ' +
      Object.keys(BOTTOMS).join(', ') + '.');
    console.error('A bottom that is not listed is not watched — add it to BOTTOMS, one line; a door goes into the stackFrameChecks plugin\'s stackFrameList.json.');
    process.exit(1);
  }

  // Each bottom carries its own default suites. An empty list means the
  // bottom has none yet and REFUSES rather than running against a set
  // that would report a quiet, plausible, empty result.
  const SURFACE = BOTTOMS[bottom].suites || [];
  const argv = process.argv.slice(2);
  const all = argv.indexOf('--all') !== -1;
  // The value after `--bottom` is not a suite name. Without this it was
  // taken as one, the runner looked for `spirit/test/fs-write`, found
  // nothing, and reported "(no verdict)" with zero calls — a run that
  // measured nothing and said so quietly.
  const named = argv.filter(function (a, i) {
    return a.indexOf('--') !== 0 && argv[i - 1] !== '--bottom';
  });
  // A suite is run directly rather than through runAll, so nothing but
  // the named files is instrumented. `--all` is the opt-in that pays for
  // coverage with the perturbation risk, and says so out loud.
  const targets = named.length ? named : SURFACE;
  if (!all && !targets.length) {
    console.error('The bottom ' + JSON.stringify(bottom) + ' has no default suites yet.');
    console.error('Name them, or pass --all. An empty default refuses; a wrong default reassures.');
    process.exit(1);
  }
  if (all) {
    process.stdout.write('Instrumenting the WHOLE HARNESS. This inherits into every\n' +
      'spawned relay and node, including the timing-sensitive worlds.\n\n');
  } else {
    process.stdout.write('Instrumenting ' + targets.join(', ') + '.\n\n');
  }
  const r = measure(bottom, targets, all);
  const out = r.out;
  const verdict = out.trim().split('\n').filter(Boolean).slice(-1)[0] || '(no verdict)';
  const counts = r.counts;

  const ranked = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
  const calls = ranked.reduce(function (n, e) { return n + e[1]; }, 0);

  // ── THE RUN'S OWN VERDICT IS NOT SWALLOWED ──────────────────────────
  //
  // The first version printed only the last line and threw the rest away
  // — so when the instrumented run went red where the clean one had been
  // green, the tool could not say WHICH suite, and the one question the
  // control exists to answer had no answer. An instrument that hides the
  // failures of the run it observes is worse than no instrument.
  const red = out.split('\n').filter(function (l) {
    return /^---\s|FAILURE|never reported/.test(l);
  });
  if (red.length) {
    console.log('');
    console.log('== THE INSTRUMENTED RUN WAS NOT CLEAN ==');
    console.log('');
    console.log('  Compare against a run WITHOUT the probe. If a suite is red here and');
    console.log('  green there, the instrument is lying about the tree and nothing below');
    console.log('  should be trusted until that is resolved.');
    console.log('');
    red.forEach(function (l) { console.log('  ' + l.trim()); });
  }

  console.log('');
  console.log('== EVERY CALL STACK IN OUR CODE THAT REACHED THE ' + bottom + ' BOTTOM ==');
  console.log('');
  console.log('  harness: ' + verdict);
  console.log('  ' + ranked.length + ' distinct stacks, ' + calls + ' calls');
  console.log('');
  console.log('  READ THE TAIL, NOT THE HEAD. Ranking is by count and count is not');
  console.log('  importance: the interface is used properly and often, so it sits at');
  console.log('  the top. A duplicate somebody wrote once is a stack with ONE call.');
  console.log('');
  console.log('  IT SEES ONLY WHAT CONVERGES HERE. Code reaching the network without');
  console.log('  passing through node http -- a browser fetch in an app page -- cannot');
  console.log('  appear, and is found by reading files instead.');
  console.log('');

  // ── TWO SCOPES IN ONE STACK, SEPARATED ──────────────────────────────
  //
  //   Andy: "you filter the tools output two ways: 1) the stack-scope of
  //   the tested code, and the stack frames of the testING code."
  //
  // THE FIRST VERSION SORTED WHOLE STACKS and it buried the finding.
  // Measured: every production route looked like
  // `relayRequest.js:67 < relayRequest.js:61 < <a different suite>`, so
  // one route appeared as a dozen entries and the list ranked SUITES
  // while claiming to rank code. All the variation was in the frames
  // that are not the subject.
  //
  // SO THE KEY IS THE TESTED SCOPE — the `spirit/run` frames alone. That
  // collapses those dozen into one row saying "this is how production
  // reaches the wire", and TWO ROWS WITH DIFFERENT PRODUCTION SCOPES
  // REACHING THE SAME BOTTOM IS THE FINDING. The testing frames are kept,
  // underneath, because they say who provoked it and a route nothing
  // drives is a route nobody has tested — but they never split a row.
  // ── THE ENDPOINTS, AND THIS IS THE RULE ENFORCED GENERALLY ──────────
  //
  //   Andy: "so, that suite will have a set of endpoints we can check in
  //   the same go....." — "thus enforcing the rule generally".
  //
  // The rule is the tree's first priority: anything that CAN be a packet
  // MUST be. Read one file at a time it is a judgement every reviewer
  // makes again; read as a SET of endpoints that our code actually
  // reached, it is one list anybody can check in one pass.
  //
  // TWO SCOPES ON ONE ENDPOINT IS A DUPLICATE, and it is legible without
  // reading a stack at all — which is how `GET /api/relay/key` from two
  // places was found.
  const byEndpoint = new Map();
  counts.forEach(function (n, key) {
    const tab = key.indexOf('\t');
    const where = tab === -1 ? '(unknown)' : key.slice(0, tab);
    const stack = tab === -1 ? key : key.slice(tab + 1);
    const scopes = stack.split(' < ').filter(function (f) { return f.indexOf('spirit/run/') === 0; });
    const row = byEndpoint.get(where) || { calls: 0, scopes: new Map() };
    row.calls += n;
    const scope = scopes.length ? scopes[scopes.length - 1] : '(suite only)';
    row.scopes.set(scope, (row.scopes.get(scope) || 0) + n);
    byEndpoint.set(where, row);
  });

  const endpoints = Array.from(byEndpoint.entries()).sort(function (a, b) { return b[1].calls - a[1].calls; });

  console.log('  -- THE ENDPOINTS: ' + endpoints.length + ' reached by our code --');
  console.log('');
  console.log('  AN ENDPOINT WITH TWO PRODUCTION SCOPES IS A DUPLICATE. It needs no stack');
  console.log('  reading and no judgement about naming: two places composing the same');
  console.log('  request is the fork, whatever either of them is called.');
  console.log('');
  endpoints.forEach(function (e) {
    const scopes = Array.from(e[1].scopes.entries()).sort(function (a, b) { return b[1] - a[1]; });
    const production = scopes.filter(function (s) { return s[0] !== '(suite only)'; });
    const flag = production.length > 1 ? '  <-- TWO OR MORE PRODUCTION SCOPES' : '';
    console.log('  ' + String(e[1].calls).padStart(6) + '  ' + e[0] + flag);
    scopes.forEach(function (s) {
      console.log('          ' + String(s[1]).padStart(5) + '  ' + s[0]);
    });
    console.log('');
  });

  const byScope = new Map();
  counts.forEach(function (n, key) {
    const tab = key.indexOf('\t');
    const frames = (tab === -1 ? key : key.slice(tab + 1)).split(' < ');
    const tested = frames.filter(function (f) { return f.indexOf('spirit/run/') === 0; });
    const testing = frames.filter(function (f) { return f.indexOf('spirit/run/') !== 0; });
    const scope = tested.length ? tested.join(' < ') : '(no production frame — the suite reached the ' + bottom + ' bottom itself)';
    const row = byScope.get(scope) || { calls: 0, drivers: new Map() };
    row.calls += n;
    if (testing.length) {
      const d = testing[testing.length - 1];
      row.drivers.set(d, (row.drivers.get(d) || 0) + n);
    }
    byScope.set(scope, row);
  });

  const scopes = Array.from(byScope.entries()).sort(function (a, b) { return b[1].calls - a[1].calls; });

  console.log('  -- THE TESTED CODE: ' + scopes.length + ' distinct production scopes reached the ' + bottom + ' bottom --');
  console.log('');
  console.log('  Each row is a route through spirit/run. TWO ROWS DOING THE SAME JOB BY');
  console.log('  DIFFERENT ROUTES IS THE CULPRIT -- that is what a fork looks like from');
  console.log('  the bottom, where it has no reference for anything else to find.');
  console.log('');

  scopes.forEach(function (entry) {
    const frames = entry[0].split(' < ');
    console.log('  ' + String(entry[1].calls).padStart(6) + '  ' + frames[0]);
    frames.slice(1).forEach(function (f) { console.log('          < ' + f); });
    const drivers = Array.from(entry[1].drivers.entries())
      .sort(function (a, b) { return b[1] - a[1]; });
    if (drivers.length) {
      console.log('          driven by ' + drivers.length + ': ' +
        drivers.slice(0, 6).map(function (d) { return d[0]; }).join(', ') +
        (drivers.length > 6 ? ', +' + (drivers.length - 6) + ' more' : ''));
    }
    console.log('');
  });

  process.exit(r.status === null ? 1 : r.status);
}
