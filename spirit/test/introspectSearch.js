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
  test.subHeading('1. AGENTS.introspect {text}: names 2/3, descriptions 1/3');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-introspect-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# a test family\n');
  fs.writeFileSync(path.join(dir, 'item.get.json'), JSON.stringify({ description: 'reads one item by its id' }));
  fs.writeFileSync(path.join(dir, 'tree.walk.json'), JSON.stringify({ description: 'walks the folders one by one' }));
  fs.writeFileSync(path.join(dir, 'search.json'), JSON.stringify({ description: 'searches the tree for words' }));
  let fam = null;
  try { fam = require('../run/js/introSpector.js').family(dir, { declared: ['item.get', 'tree.walk', 'search'], prefix: '' }); } catch (e) { fam = null; }
  const intro = fam && fam.verbs['AGENTS.introspect'];
  if (intro && JSON.stringify(intro.request) === JSON.stringify({ text: '' })) test.check('AGENTS.introspect takes {text}');
  else test.fail(OWED + 'AGENTS.introspect takes ' + short(intro && intro.request));
  const ask = function (text) { try { return intro.handler({ text: text }); } catch (e) { return { items: [], error: String(e && e.message || e) }; } };
  const keys = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }); };
  const all = intro ? ask('') : null;
  if (all && keys(all).join() === 'item.get,search,tree.walk' && all.items.every(function (i) { return i.label === i.key; })) test.check('no words: every verb with a file, in name order, the name alone as label');
  else test.fail(OWED + 'no words answered ' + short(all));
  const tree = intro ? ask('tree') : null;
  if (tree && keys(tree).join() === 'tree.walk,search') test.check('tree: the verb named so first (2/3), the one whose description says it second (1/3), item.get left out');
  else test.fail(OWED + 'tree answered ' + short(keys(tree)));
  const reads = intro ? ask('reads') : null;
  if (reads && keys(reads).join() === 'item.get') test.check('reads: found in a description alone');
  else test.fail(OWED + 'reads answered ' + short(keys(reads)));
  const none = intro ? ask('zebra') : null;
  if (none && !keys(none).length && none.more === false) test.check('a word nothing has: nothing, more false');
  else test.fail(OWED + 'zebra answered ' + short(none));
  const src = code('js/introSpector.js');
  if (!/searchBucket/.test(src) && /probabilityStringObjectMatch|probabilityStringMatch/.test(src) && /probabilityBucket/.test(src)) test.check('introSpector ranks on the probability modules and requires no searchBucket');
  else test.fail(OWED + 'introSpector still on searchBucket, or not on the probability modules');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  test.subHeading('2. a member sees only what it is granted; the owner sees all');
  const door = require('../run/js/apiDoor.js');
  const VERBS = ['item.add', 'item.get', 'rule.get'];
  const servers = {
    ask: function (q) {
      const app = Object.keys(q)[0];
      const verb = Object.keys(q[app])[0];
      if (verb === 'AGENTS.introspect') return Promise.resolve({ status: 200, body: { items: VERBS.map(function (v) { return { key: v, label: v }; }), more: false } });
      const m = /^AGENTS\.(.+)$/.exec(verb);
      if (m) return Promise.resolve({ status: 200, body: { description: 'the file of ' + m[1] } });
      if (verb === 'AGENTS') return Promise.resolve({ status: 200, body: { text: '# desk' } });
      return Promise.resolve({ status: 200, body: { ran: verb } });
    },
  };
  const member = function (paths) { return { key: 'K-MEMBER', auth: { pathsOf: function () { return paths; }, labelOf: function () { return 'm'; } } }; };
  const call = function (verb, args, caller) { const q = { desk: {} }; q.desk[verb] = args; return door.answer(servers, q, caller); };
  const one = await call('AGENTS.introspect', { text: '' }, member(['desk.item.get']));
  if (one.status === 200 && keys(one.body).join() === 'item.get') test.check('granted desk.item.get alone: introspect lists item.get alone');
  else test.fail(OWED + 'granted desk.item.get, introspect answered ' + one.status + ' ' + short(one.body));
  const desc = await call('AGENTS.item.get', {}, member(['desk.item.get']));
  const hidden = await call('AGENTS.item.add', {}, member(['desk.item.get']));
  if (desc.status === 200 && hidden.status === 403 && hidden.body && hidden.body.code === 'not-granted') test.check('AGENTS.item.get described; AGENTS.item.add refused not-granted');
  else test.fail(OWED + 'AGENTS.item.get ' + desc.status + ', AGENTS.item.add ' + hidden.status + ' ' + short(hidden.body));
  const md = await call('AGENTS', {}, member(['desk.item.get']));
  if (md.status === 200) test.check('and the app\'s AGENTS text is read by anyone granted a path in it');
  else test.fail(OWED + 'AGENTS answered ' + md.status + ' ' + short(md.body));
  const whole = await call('AGENTS.introspect', { text: '' }, member(['desk']));
  if (whole.status === 200 && keys(whole.body).join() === VERBS.join()) test.check('granted the whole desk: every verb');
  else test.fail(OWED + 'granted desk, introspect answered ' + short(whole.body));
  const elsewhere = await call('AGENTS.introspect', { text: '' }, member(['chatter']));
  if (elsewhere.status === 403) test.check('granted nothing in desk: desk\'s introspect refused');
  else test.fail(OWED + 'granted only chatter, desk introspect answered ' + elsewhere.status);
  const owner = await call('AGENTS.introspect', { text: '' }, { owner: true });
  if (owner.status === 200 && keys(owner.body).join() === VERBS.join()) test.check('the owner sees all');
  else test.fail(OWED + 'the owner got ' + short(owner.body));

  test.subHeading('3. deskAgent asks with text \'\'');
  const tools = code('process/js/deskAgent/tools.js');
  if (/route\.family\('introspect'\),\s*\{\s*text:\s*''\s*\}/.test(tools)) test.check('tools.js asks introspect {text: \'\'}');
  else test.fail(OWED + 'tools.js does not ask introspect {text: \'\'}');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
