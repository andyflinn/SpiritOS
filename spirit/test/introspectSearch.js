'use strict';

// spirit/test/introspectSearch.js
// goal/G29.19: introSpector's search over a family folder, and who may ask it.
//   - Part 1: introSpector.family(dir) gives the folder an FS.search {q} -> {items: [{key, label}], more}, over its
//     file names (<verb>.json and AGENTS.md), ranked by the probability modules; no words lists every file in name order.
//   - Part 2 asserts that a member granted the app reaches its FS verbs. apiDoor.js makes every family's FS verbs the
//     owner's (goal/G41.28), so a member is refused owner-only and part 2 fails.
//   - Part 3 reads spirit/run/process/js/deskAgent/tools.js, which is not in the tree.
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
  // The search is the family folder's FS.search {q}, over its file names (goal/G30.4): a verb file is <verb>.json, and
  // AGENTS.md is listed beside them.
  test.subHeading('1. FS.search {q}: names 2/3, descriptions 1/3');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-introspect-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# a test family\n');
  fs.writeFileSync(path.join(dir, 'item.get.json'), JSON.stringify({ description: 'reads one item by its id' }));
  fs.writeFileSync(path.join(dir, 'tree.walk.json'), JSON.stringify({ description: 'walks the folders one by one' }));
  fs.writeFileSync(path.join(dir, 'search.json'), JSON.stringify({ description: 'searches the tree for words' }));
  let fam = null;
  try { fam = require('../run/spirit/introSpector.js').family(dir, { declared: ['item.get', 'tree.walk', 'search'], prefix: '' }); } catch (e) { fam = null; }
  const intro = fam && fam.verbs['FS.search'];
  if (intro && JSON.stringify(intro.request) === JSON.stringify({ q: '' })) test.check('FS.search takes {q}');
  else test.fail(OWED + 'FS.search takes ' + short(intro && intro.request));
  const ask = function (text) { try { return intro.handler({ q: text }); } catch (e) { return { items: [], error: String(e && e.message || e) }; } };
  const keys = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }); };
  const all = intro ? ask('') : null;
  if (all && keys(all).join() === 'AGENTS.md,item.get.json,search.json,tree.walk.json' && all.items.every(function (i) { return i.label === i.key; })) test.check('no words: every file of the folder, in name order, the name alone as label');
  else test.fail(OWED + 'no words answered ' + short(all));
  // NAMES ALONE (goal/G30.4). Andy: "cannot the agent simply use FS to retrieve the AGENTS.md file of the verb.json
  // files?", then "then put a search in there.". So a file is found by its name alone, never by what its description says.
  const tree = intro ? ask('tree') : null;
  if (tree && keys(tree).join() === 'tree.walk.json') test.check('tree: the file named so, and not search.json, whose description says it: names alone');
  else test.fail(OWED + 'tree answered ' + short(keys(tree)));
  const reads = intro ? ask('reads') : null;
  if (reads && !keys(reads).length) test.check('reads: a word found only in a description finds nothing');
  else test.fail(OWED + 'reads answered ' + short(keys(reads)));
  const none = intro ? ask('zebra') : null;
  if (none && !keys(none).length && none.more === false) test.check('a word nothing has: nothing, more false');
  else test.fail(OWED + 'zebra answered ' + short(none));
  const src = code('spirit/introSpector.js');
  if (!/searchBucket/.test(src) && /probabilityStringObjectMatch|probabilityStringMatch/.test(src) && /probabilityBucket/.test(src)) test.check('introSpector ranks on the probability modules and requires no searchBucket');
  else test.fail(OWED + 'introSpector still on searchBucket, or not on the probability modules');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  // These checks expect the folder's FS verbs to be granted like any other verb. apiDoor.js refuses every FS verb to a
  // member, granted or not (goal/G41.28, "owner-only"); only the refusals and the owner's checks still hold.
  test.subHeading('2. a member reaches the folder only as granted; the owner sees all');
  const door = require('../run/spirit/apiDoor.js');
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
