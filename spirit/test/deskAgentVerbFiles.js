'use strict';

// spirit/test/deskAgentVerbFiles.js
// goal/G24.1. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Levant's desk tools are the desk verbs that have a description file beside desk.js
//   (spirit/run/process/js/desk/<verb>.json). The ones cw uses daily had none.
//   Each of these gets its description file, and with it becomes his tool: line.take, item.release, box.take,
//   box.release, item.add, goal.add, phase.take, phase.done, phase.may, changes, chat.search, log.search, items.find,
//   rule.get, rules.search, profile.get, pending.get.
//   Only the files are added: the desk still decides what it allows him. session.set, rule.add, item.delete,
//   profile.set, the verifier's verbs (verify.pass/reject/regress), log.add, agent.state, signoff,
//   rule.draft/version/history get no file.
//
// HOW THE DECLARED REQUEST IS READ: from desk.js's source, never by requiring it (it starts a server): the verb's
// entry `'<verb>': {` in the served table, then its `request: {...}` literal, balanced braces, evaluated as a literal.
//
// WHAT IS ASSERTED
//   1. for each of the seventeen: desk/<verb>.json exists, parses, has a description, and its request's keys equal
//      the keys desk.js declares for the verb.
//   2. none of the excluded verbs has a file.
//   3. the family of the desk's folder (introSpector.family, as the desk serves it) lists each of the seventeen in
//      AGENTS.introspect and answers AGENTS.<verb> with its request.
//   4. deskUnsloth's tools.js, describing the desk through a route answered by that family, offers desk_<verb> for
//      each of the seventeen.
// rule/11: through testSupport only; reads files, starts nothing.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G24.1: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const DESK_JS = path.join(DESK_DIR, 'desk.js');
const TOOLS = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth', 'tools.js');

const SEVENTEEN = ['line.take', 'item.release', 'box.take', 'box.release', 'item.add', 'goal.add', 'phase.take', 'phase.done', 'phase.may', 'changes', 'chat.search', 'log.search', 'items.find', 'rule.get', 'rules.search', 'profile.get', 'pending.get'];
const EXCLUDED = ['session.set', 'rule.add', 'item.delete', 'profile.set', 'verify.pass', 'verify.reject', 'verify.regress', 'log.add', 'agent.state', 'signoff', 'rule.draft', 'rule.version', 'rule.history'];

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sameKeys(a, b) { return JSON.stringify(Object.keys(a || {}).sort()) === JSON.stringify(Object.keys(b || {}).sort()); }

test.startTest('goal/G24.1: the desk verbs cw uses daily are described to agents, and so are Levant\'s tools');

const source = fs.readFileSync(DESK_JS, 'utf8');
// The declared request of one verb, read from the source.
function declaredRequest(verb) {
  const at = source.indexOf("\n  '" + verb + "': {");
  if (at === -1) return null;
  const r = source.indexOf('request:', at);
  if (r === -1) return null;
  let i = source.indexOf('{', r);
  const from = i;
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  try { return Function('return (' + source.slice(from, i + 1) + ');')(); } catch (e) { return null; }
}
function fileOf(verb) { try { return JSON.parse(fs.readFileSync(path.join(DESK_DIR, verb + '.json'), 'utf8')); } catch (e) { return null; } }

async function suite() {
  test.subHeading('1. the seventeen have their files, each request the declared one');
  SEVENTEEN.forEach(function (v) {
    const decl = declaredRequest(v);
    if (!decl) { test.fail('the world: desk.js declares no request for ' + v); return; }
    const f = fileOf(v);
    if (f && typeof f.description === 'string' && f.description && f.request && typeof f.request === 'object' && sameKeys(f.request, decl)) test.check(v + '.json: a description and the request ' + JSON.stringify(Object.keys(decl)));
    else test.fail(OWED + v + '.json ' + (f ? 'reads ' + short(f) + ', the declared request ' + short(Object.keys(decl)) : 'is missing (declared request ' + short(Object.keys(decl)) + ')'));
  });

  test.subHeading('2. the excluded verbs get no file');
  const present = EXCLUDED.filter(function (v) { return fs.existsSync(path.join(DESK_DIR, v + '.json')); });
  if (!present.length) test.check('none of ' + EXCLUDED.join(', ') + ' has a file');
  else test.fail('files for verbs that get none: ' + present.join(', '));

  test.subHeading('3. the desk\'s family lists the seventeen with their requests');
  const existing = fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).map(function (f) { return f.replace(/\.json$/, ''); });
  const declared = existing.concat(SEVENTEEN.filter(function (v) { return existing.indexOf(v) === -1; }));
  let family = null;
  try { family = require('../run/js/introSpector.js').family(DESK_DIR, { declared: declared, manifest: 'desk.json' }); } catch (e) { family = null; }
  if (!family) { test.fail('the world: introSpector.family threw on the desk folder'); return; }
  let listed = [];
  try { const r = await family.verbs['AGENTS.introspect'].handler({}); listed = ((r && r.items) || []).map(function (i) { return i.key; }); } catch (e) { listed = []; }
  const unlisted = SEVENTEEN.filter(function (v) { return listed.indexOf(v) === -1; });
  if (!unlisted.length) test.check('AGENTS.introspect lists all seventeen');
  else test.fail(OWED + 'AGENTS.introspect does not list ' + unlisted.join(', '));
  const unanswered = SEVENTEEN.filter(function (v) { const h = family.verbs['AGENTS.' + v]; let a = null; try { a = h && h.handler({}); } catch (e) { a = null; } return !a || !a.request || !sameKeys(a.request, declaredRequest(v)); });
  if (!unanswered.length) test.check('AGENTS.<verb> answers each with its request');
  else test.fail(OWED + 'AGENTS.<verb> answers no matching request for ' + unanswered.join(', '));

  test.subHeading('4. deskUnsloth offers each as a desk tool');
  const deskRoute = {
    ask: function (verb) {
      const h = family.verbs[verb];
      let body = null;
      try { body = h ? h.handler({}) : { ok: false, code: 'no-such-verb' }; } catch (e) { body = { ok: false, code: 'refused' }; }
      return Promise.resolve(body).then(function (b) { return { status: b && b.ok === false ? 404 : 200, body: b, text: JSON.stringify(b) }; });
    },
    verb: function (stem) { return stem; },
    family: function (name) { return 'AGENTS.' + name; },
  };
  const tools = require(TOOLS).createTools({ routes: { desk: deskRoute }, room: 4000 });
  const described = await tools.describe('desk');
  const names = (described || []).map(function (t) { return t.function && t.function.name; });
  const missing = SEVENTEEN.map(function (v) { return 'desk_' + v.replace(/\./g, '_'); }).filter(function (n) { return names.indexOf(n) === -1; });
  if (!missing.length) test.check('describe(desk) offers desk_<verb> for all seventeen');
  else test.fail(OWED + 'describe(desk) does not offer ' + missing.join(', '));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
