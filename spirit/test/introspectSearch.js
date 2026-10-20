'use strict';

// spirit/test/introspectSearch.js
// goal/G29.19: introSpector on the new search, and only what the caller is granted. Red on today's tree; claude-windows
// writes it and builds it (one agent). The item's box (v5):
//   - AGENTS.introspect, on the node and on every process server, becomes a search: {text} -> {items: [{key: verb,
//     label: name}], more}. Names only; the description, request and reply are AGENTS.<verb>'s.
//   - With no words every verb with a file, in name order. With words each verb is ranked by the probability modules:
//     its name weighs 2/3, its verb-description file 1/3; a verb matching neither is left out.
//   - Cut by bytes to one answer through the probability bucket's serialize; no old graded search in introSpector.
//   - deskAgent's tools ask it with text ''.
//   - The node filters by the caller's grants: AGENTS.introspect lists only granted verbs, AGENTS.<verb> describes only
//     a granted verb. The owner sees all. Per-persona and per-job grants are out of scope.
// NAMED HERE where the box names none: the filter lives in apiDoor's gate (answer), the one way a member's ask reaches a
// server; a member granted any path of an app may ask that app's AGENTS family, and is answered only its granted verbs.
// rule/11: through testSupport only; a temp folder; no node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.19: ';
const RUN = path.join(__dirname, '..', 'run');
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G29.19: introSpector searches names and descriptions, and shows a caller only what it is granted');

(async function () {
  // SINCE goal/G30.4 the AGENTS verbs are gone and the search is the family folder's FS.search {q}, over its file
  // names: a verb file is <verb>.json, and AGENTS.md is listed beside them.
  test.subHeading('1. FS.search {q}: names 2/3, descriptions 1/3');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-introspect-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# a test family\n');
  fs.writeFileSync(path.join(dir, 'item.get.json'), JSON.stringify({ description: 'reads one item by its id' }));
  fs.writeFileSync(path.join(dir, 'tree.walk.json'), JSON.stringify({ description: 'walks the folders one by one' }));
  fs.writeFileSync(path.join(dir, 'search.json'), JSON.stringify({ description: 'searches the tree for words' }));
  let fam = null;
  try { fam = require('../run/js/introSpector.js').family(dir, { declared: ['item.get', 'tree.walk', 'search'], prefix: '' }); } catch (e) { fam = null; }
  const intro = fam && fam.verbs['FS.search'];
  if (intro && JSON.stringify(intro.request) === JSON.stringify({ q: '' })) test.check('FS.search takes {q}');
  else test.fail(OWED + 'FS.search takes ' + short(intro && intro.request));
  const ask = function (text) { try { return intro.handler({ q: text }); } catch (e) { return { items: [], error: String(e && e.message || e) }; } };
  const keys = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }); };
  const all = intro ? ask('') : null;
  if (all && keys(all).join() === 'AGENTS.md,item.get.json,search.json,tree.walk.json' && all.items.every(function (i) { return i.label === i.key; })) test.check('no words: every file of the folder, in name order, the name alone as label');
  else test.fail(OWED + 'no words answered ' + short(all));
  // THE DESCRIPTION WEIGHTING IS GONE (goal/G30.4): AGENTS.introspect weighed a verb's description file 1/3 (Andy,
  // 2026-10-18: "name 66% description 33%"). AGENTS.introspect went (Andy, 2026-10-20: "cannot the agent simply use FS
  // to retrieve the AGENTS.md file of the verb.json files?"), and its replacement is FS.search over the folder's file
  // names ("then put a search in there."). So a file is found by its name alone, never by what its description says.
  const tree = intro ? ask('tree') : null;
  if (tree && keys(tree).join() === 'tree.walk.json') test.check('tree: the file named so, and not search.json, whose description says it: names alone');
  else test.fail(OWED + 'tree answered ' + short(keys(tree)));
  const reads = intro ? ask('reads') : null;
  if (reads && !keys(reads).length) test.check('reads: a word found only in a description finds nothing');
  else test.fail(OWED + 'reads answered ' + short(keys(reads)));
  const none = intro ? ask('zebra') : null;
  if (none && !keys(none).length && none.more === false) test.check('a word nothing has: nothing, more false');
  else test.fail(OWED + 'zebra answered ' + short(none));
  const src = code('js/introSpector.js');
  if (!/searchBucket/.test(src) && /probabilityStringObjectMatch|probabilityStringMatch/.test(src) && /probabilityBucket/.test(src)) test.check('introSpector ranks on the probability modules and requires no searchBucket');
  else test.fail(OWED + 'introSpector still on searchBucket, or not on the probability modules');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  // SINCE goal/G30.4 apiDoor has no AGENTS special case: the folder's FS verbs are granted like any other verb, so a
  // member reads a family's folder only when granted the app, or the exact FS verb, and nothing is cut from an answer.
  test.subHeading('2. a member reaches the folder only as granted; the owner sees all');
  const door = require('../run/js/apiDoor.js');
  const FILES = ['AGENTS.md', 'item.add.json', 'item.get.json', 'rule.get.json'];
  const servers = {
    ask: function (q) {
      const app = Object.keys(q)[0];
      const verb = Object.keys(q[app])[0];
      if (verb === 'FS.search') return Promise.resolve({ status: 200, body: { items: FILES.map(function (v) { return { key: v, label: v }; }), more: false } });
      if (verb === 'FS.loadJsonValue') return Promise.resolve({ status: 200, body: { value: { description: 'the file ' + q[app][verb].path } } });
      if (verb === 'FS.loadFile') return Promise.resolve({ status: 200, body: { text: '# desk' } });
      return Promise.resolve({ status: 200, body: { ran: verb } });
    },
  };
  const member = function (paths) { return { key: 'K-MEMBER', auth: { pathsOf: function () { return paths; }, labelOf: function () { return 'm'; } } }; };
  const call = function (verb, args, caller) { const q = { desk: {} }; q.desk[verb] = args; return door.answer(servers, q, caller); };
  const one = await call('FS.search', { q: '' }, member(['desk.item.get']));
  if (one.status === 403 && one.body && one.body.code === 'not-granted') test.check('granted desk.item.get alone: desk\'s FS.search refused not-granted');
  else test.fail(OWED + 'granted desk.item.get, FS.search answered ' + one.status + ' ' + short(one.body));
  const desc = await call('FS.loadJsonValue', { path: 'item.get.json' }, member(['desk.item.get', 'desk.FS.loadJsonValue']));
  const hidden = await call('FS.loadJsonValue', { path: 'item.get.json' }, member(['desk.item.get']));
  if (desc.status === 200 && hidden.status === 403 && hidden.body && hidden.body.code === 'not-granted') test.check('FS.loadJsonValue read when granted by name; refused not-granted when only item.get is');
  else test.fail(OWED + 'FS.loadJsonValue granted ' + desc.status + ', not granted ' + hidden.status + ' ' + short(hidden.body));
  const md = await call('FS.loadFile', { path: 'AGENTS.md' }, member(['desk.item.get']));
  if (md.status === 403) test.check('and the app\'s AGENTS.md is not read by a member granted only a verb in it');
  else test.fail(OWED + 'FS.loadFile of AGENTS.md answered ' + md.status + ' ' + short(md.body));
  const whole = await call('FS.search', { q: '' }, member(['desk']));
  if (whole.status === 200 && keys(whole.body).join() === FILES.join()) test.check('granted the whole desk: every file, nothing cut');
  else test.fail(OWED + 'granted desk, FS.search answered ' + short(whole.body));
  const elsewhere = await call('FS.search', { q: '' }, member(['chatter']));
  if (elsewhere.status === 403) test.check('granted nothing in desk: desk\'s FS.search refused');
  else test.fail(OWED + 'granted only chatter, desk FS.search answered ' + elsewhere.status);
  const owner = await call('FS.search', { q: '' }, { owner: true });
  if (owner.status === 200 && keys(owner.body).join() === FILES.join()) test.check('the owner sees all');
  else test.fail(OWED + 'the owner got ' + short(owner.body));

  test.subHeading('3. deskAgent asks FS.search with q \'\'');
  const tools = code('process/js/deskAgent/tools.js');
  if (/route\.fs\('search'\),\s*\{\s*q:\s*''\s*\}/.test(tools)) test.check('tools.js asks FS.search {q: \'\'}');
  else test.fail(OWED + 'tools.js does not ask FS.search {q: \'\'}');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
