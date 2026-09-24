#!/usr/bin/env node

// spirit/test/tools/inspect.js
// ASK THE TREE A QUESTION, WITH A COMMAND THAT NEVER CHANGES.
//
// NAMED inspect AND NOT ask, AFTER A VOCABULARY COLLISION. Both agents
// created an ask.js within minutes: this one, and spirit/run/app/shared/ask.js
// — the app's door, ask(verb, args), which is G3's "ask has one home".
// THAT ONE OWNS THE WORD. `ask` is the product's verb, in the dictionary and
// in the requirement; this is a dev tool that reads files. A collision in
// vocabulary costs more than a duplicate implementation, because nothing
// ever goes red — the two just quietly mean different things in the same
// sentence.
//
//   Andy, 2026-09-24, refusing a grep and naming the cure in three words:
//   "use your ask.js"
//
// ── THE LAST CATEGORY ───────────────────────────────────────────────
//
// Three sources of approval dialogs were found and cured today: the vault
// guard (four defects), the messages between agents (every one a freshly
// composed command), and the probes written to measure those. THIS IS THE
// FOURTH AND IT IS THE ONE LEFT: reading the tree. Every grep, every
// sed -n, every ls is a new string, so every one is a new dialog — and
// inspection is what an agent does most.
//
// The cure is the same one, for the fourth time, which is why it is worth
// stating as a rule rather than as a fix: WORK THAT WILL BE REPEATED
// LIVES AT A PATH, NOT IN A STRING.
//
//     node spirit/test/tools/inspect.js
//
// The question lives in a file, the way say.js's message does. One
// approval, once, for every question after it.
//
// ── IT READS AND NEVER WRITES ───────────────────────────────────────
//
// Deliberately, and it is the property that makes it safe to approve
// once: there is no verb here that changes anything. No write, no shell,
// no spawn. A tool that could do both would have to be judged on every
// use, which is the thing being cured.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

// The box says where its own askbox is, the same ordering say.js uses:
// the environment, then the box file, then this file's last resort.
function fromBoxFile(key) {
  try {
    const raw = fs.readFileSync(path.join(REPO, '.spiritbox'), 'utf8');
    const m = new RegExp('^\\s*' + key + '\\s*=\\s*(.+)$', 'm').exec(raw);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}

const ASKBOX = String(process.env.SPIRIT_ASKBOX || '').trim() ||
  fromBoxFile('askbox') ||
  (fromBoxFile('outbox') || '').replace(/outbox\.txt$/, 'askbox.txt');

const SKIP = new Set(['.git', 'node_modules', 'relay-state', 'app-state', 'lab', 'media']);

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function underOrAll(where) {
  const base = where ? path.join(REPO, where) : REPO;
  let st = null;
  try { st = fs.statSync(base); } catch (e) { return []; }
  return st.isDirectory() ? walk(base, []) : [base];
}

// ── THE QUESTIONS IT ANSWERS ────────────────────────────────────────
//
// Four, because four covers what an inspection actually needs and a fifth
// would be a shell in disguise. Each prints paths relative to the repo,
// so an answer can be pasted into a message without editing.
const VERBS = {
  // grep: <pattern>        [in: <dir or file>]  [ext: js,md]
  grep: function (q) {
    const re = new RegExp(q.pattern, q.flags || '');
    const ext = q.ext ? q.ext.split(',').map(function (s) { return '.' + s.trim().replace(/^\./, ''); }) : null;
    const hits = [];
    for (const file of underOrAll(q.in)) {
      if (ext && !ext.some(function (x) { return file.endsWith(x); })) continue;
      let body = '';
      try { body = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
      body.split('\n').forEach(function (line, i) {
        if (re.test(line)) {
          hits.push(path.relative(REPO, file) + ':' + (i + 1) + ': ' + line.trim().slice(0, 160));
        }
      });
    }
    return hits;
  },
  // files: <dir>           [ext: js]
  files: function (q) {
    const ext = q.ext ? q.ext.split(',').map(function (s) { return '.' + s.trim().replace(/^\./, ''); }) : null;
    return underOrAll(q.in || q.pattern)
      .filter(function (f) { return !ext || ext.some(function (x) { return f.endsWith(x); }); })
      .map(function (f) { return path.relative(REPO, f); });
  },
  // show: <path>           [from: 10] [to: 40]
  show: function (q) {
    const file = path.join(REPO, q.pattern);
    let body = '';
    try { body = fs.readFileSync(file, 'utf8'); } catch (e) { return ['cannot read ' + q.pattern + ': ' + e.message]; }
    const lines = body.split('\n');
    const from = Math.max(1, parseInt(q.from, 10) || 1);
    const to = Math.min(lines.length, parseInt(q.to, 10) || lines.length);
    return lines.slice(from - 1, to).map(function (l, i) { return (from + i) + ': ' + l; });
  },
  // count: <pattern>       [in: <dir>] [ext: js]  — per file, which is the
  // shape a tally question actually wants.
  count: function (q) {
    const re = new RegExp(q.pattern, q.flags || 'g');
    const ext = q.ext ? q.ext.split(',').map(function (s) { return '.' + s.trim().replace(/^\./, ''); }) : null;
    const rows = [];
    for (const file of underOrAll(q.in)) {
      if (ext && !ext.some(function (x) { return file.endsWith(x); })) continue;
      let body = '';
      try { body = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
      const n = (body.match(re) || []).length;
      if (n) rows.push(String(n).padStart(5) + '  ' + path.relative(REPO, file));
    }
    return rows.sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
  },
};

function fail(why) {
  process.stderr.write('inspect: ' + why + '\n');
  process.exit(1);
}

let raw = '';
try { raw = fs.readFileSync(ASKBOX, 'utf8'); } catch (e) {
  fail('no askbox at ' + (ASKBOX || '(unset)') + '. Write the question there first, or set ' +
    'SPIRIT_ASKBOX / an `askbox =` line in .spiritbox. It is named rather than guessed: ' +
    'a tool that invents where its input lives is the defect this file exists to stop.');
}

// One question per file, as `verb: argument` plus optional `key: value`
// lines. Parsed, never guessed — an answer to a question nobody asked is
// worse than no answer, because it reads like one.
const q = {};
let verb = null;
raw.split('\n').forEach(function (line) {
  const m = /^\s*([a-z]+)\s*:\s*(.*)$/.exec(line);
  if (!m) return;
  const key = m[1];
  const val = m[2].trim();
  if (VERBS[key]) { verb = key; q.pattern = val; return; }
  q[key] = val;
});

if (!verb) fail('the askbox names no question. One of: ' + Object.keys(VERBS).join(', '));
if (!q.pattern) fail('`' + verb + ':` has no argument');

let rows = [];
try { rows = VERBS[verb](q); } catch (e) { fail('the question could not be answered: ' + e.message); }

// A CAP, AND IT SAYS WHEN IT CAPPED. A tool that silently truncates
// teaches its reader that the list was complete — which is the same shape
// as a check that cannot fail, in an answer.
const LIMIT = parseInt(q.limit, 10) || 200;
rows.slice(0, LIMIT).forEach(function (r) { process.stdout.write(r + '\n'); });
if (rows.length > LIMIT) {
  process.stdout.write('... ' + (rows.length - LIMIT) + ' more (raise `limit:` to see them)\n');
}
process.stderr.write('\n' + rows.length + ' result(s) for ' + verb + ': ' + q.pattern + '\n');
