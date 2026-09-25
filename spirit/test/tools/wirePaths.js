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
// invisible to it: the raw `fetch` in `app/starter/starter.html` ran in a
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

// ── OUR OWN CODE, AND NOTHING ELSE ──────────────────────────────────
//
// Andy: "it's only the call points in our own code, you have to show."
// Node's internals are not call points anybody can fix, and a stack made
// mostly of them buries the frames that matter. Dropped: anything outside
// the repo, node's own modules, dependencies, and this probe.
function ours(file) {
  if (!file) return false;
  const f = String(file).replace(/\\/g, '/');
  if (f.indexOf('node:') === 0) return false;
  if (f.indexOf('internal/') === 0) return false;
  if (f.indexOf('node_modules') !== -1) return false;
  const abs = path.resolve(f);
  if (abs === SELF) return false;
  return abs.toLowerCase().indexOf(REPO.toLowerCase()) === 0;
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
  const lines = String(holder.stack || '').split('\n').slice(1);
  Error.stackTraceLimit = was;
  const out = [];
  lines.forEach(function (line) {
    const m = /\(([^()]+):(\d+):\d+\)\s*$/.exec(line) ||
      /\bat\s+([^()\s]+):(\d+):\d+\s*$/.exec(line);
    if (!m || !ours(m[1])) return;
    out.push(path.relative(REPO, path.resolve(m[1])).replace(/\\/g, '/') + ':' + m[2]);
  });
  return out;
}

// ── PROBE MODE ──────────────────────────────────────────────────────
if (process.env.SPIRIT_WIRE_LOG && require.main !== module) {
  const counts = new Map();

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
    } else if (a && typeof a === 'object') {
      method = a.method || 'GET';
      target = String(a.path || a.pathname || '');
    }
    return String(method).toUpperCase() + ' ' + String(target).split('?')[0];
  };

  const patch = function (mod, method) {
    const original = mod[method];
    if (typeof original !== 'function') return;
    mod[method] = function () {
      const stack = callStack();
      // A call with no frame of ours is node talking to itself, and there
      // is no call point in our code to show.
      if (stack.length) {
        let where = '';
        try { where = endpointOf(arguments); } catch (e) { where = '(unreadable)'; }
        const key = where + '\t' + stack.join(' < ');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return original.apply(this, arguments);
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
  ((BOTTOMS[process.env.SPIRIT_WIRE_BOTTOM] || BOTTOMS.wire).watch || [])
    .forEach(function (b) { patch(require(b.mod), b.fn); });

  // WRITTEN AT EXIT, NOT PER CALL. Appending on every request would make
  // the instrument a participant in what it measures, and this harness
  // has timing-sensitive worlds: a diminishing timeout, a claim limiter
  // at ten a minute, windows a suite waits on. An instrument that changes
  // the thing it observes is worse than no instrument.
  process.on('exit', function () {
    if (!counts.size) return;
    const lines = [];
    counts.forEach(function (n, key) { lines.push(n + '\t' + key); });
    try {
      fs.appendFileSync(process.env.SPIRIT_WIRE_LOG, lines.join('\n') + '\n');
    } catch (e) {
      // A probe that cannot write must not break the run it observes.
    }
  });
}

// ── RUNNER MODE ─────────────────────────────────────────────────────
if (require.main === module) {
  const { spawnSync } = require('child_process');
  const os = require('os');

  const log = path.join(os.tmpdir(), 'spirit-wire-' + process.pid + '.tsv');
  try { fs.unlinkSync(log); } catch (e) { /* not there yet */ }

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
    console.error('A bottom that is not listed is not watched — add it to BOTTOMS, one line.');
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
  const runner = path.join(REPO, 'spirit', 'test', 'runAll.js');
  const env = Object.assign({}, process.env, {
    SPIRIT_WIRE_LOG: log,
    // WHICH BOTTOM, PASSED DOWN. `--bottom fs-write` and the probe in
    // every child instruments the filesystem instead of the wire. An
    // unknown name is refused above rather than silently falling back to
    // the wire, because a probe that watched something other than what
    // was asked for is worse than one that refused.
    SPIRIT_WIRE_BOTTOM: bottom,
    // EVERY SUITE PROCESS IS INSTRUMENTED AND NO SUITE KNOWS. runAll is
    // not touched, and a suite that had to opt in is a suite that can
    // forget to — which would make the quiet paths the unwatched ones.
    NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' +
      SELF.replace(/\\/g, '/')).trim(),
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
  let r;
  if (all) {
    process.stdout.write('Instrumenting the WHOLE HARNESS. This inherits into every\n' +
      'spawned relay and node, including the timing-sensitive worlds.\n\n');
    r = spawnSync(process.execPath, [runner], { env: env, encoding: 'utf8', maxBuffer: 1 << 28 });
  } else {
    process.stdout.write('Instrumenting ' + targets.join(', ') + '.\n\n');
    r = { status: 0, stdout: '' };
    targets.forEach(function (t) {
      const one = spawnSync(process.execPath, [path.join(REPO, 'spirit', 'test', t)], {
        env: env, encoding: 'utf8', maxBuffer: 1 << 26,
      });
      r.stdout += String(one.stdout || '');
      if (one.status) r.status = one.status;
    });
  }
  const out = String(r.stdout || '');
  const verdict = out.trim().split('\n').filter(Boolean).slice(-1)[0] || '(no verdict)';

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

  try { fs.unlinkSync(log); } catch (e) { /* leave it behind */ }
  process.exit(r.status === null ? 1 : r.status);
}
