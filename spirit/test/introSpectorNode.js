'use strict';

// goal/G10.5: the family on the node's own door (introSpector.js, mounted by verbTable.js), and who may ask it.
//   Andy, 2026-10-09: "the module in core like hub.js could have a corresponding folder spirit/run/spirit/hub/ where the
//   AGENTS.md and the verb descriptions are"; "so the introSpector could still insist on lower-case verbs to be
//   registered, and then STILL add the uppercase set"; "that is a decision. make it so.".
// The node's namespaces have such folders (spirit/run/spirit/<namespace>/AGENTS.md and verb files). The family's verbs
// are FS (goal/G30.4; no AGENTS verbs), added by the table, never claimed by a module.
//
// WHAT IS ASSERTED:
//   1. the world: a namespace is claimed with bare handlers, lowercase, in its own namespace (verbTable claim).
//   2. the world: a module cannot claim an uppercase verb, so the family can only ever be the system's.
//   3. the table takes the declaration form {request, reply, handler, accepts?} for a namespace (verbTable mount,
//      goal/G30.4); introSpector exports the family alone.
//   4. a mounted namespace carries the family folder's FS: fs.FS.loadFile, fs.FS.loadJsonValue, fs.FS.search ...,
//      added by the table through introSpector and not by the module; no AGENTS verb.
//   5. the family is FS with or without an AGENTS.md, and FS reads the AGENTS.md and the verb files.
//   6. the world: who may ask the family is not gated here. Andy, 2026-10-09: "it is already the case that when an
//      appServer is called via loopback, the appClient inserts the public key of the local node as 'caller', and thus
//      as \"allowed\" everything." One world line stands for it and nothing is owed.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G10.5: ';
const REPO = path.join(__dirname, '..', '..');
const INTROSPECTOR_REL = 'spirit/run/spirit/introSpector.js';
const INTROSPECTOR = path.join(REPO, INTROSPECTOR_REL);

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function threw(fn) { try { fn(); return null; } catch (e) { return e; } }

const verbTable = require('../run/spirit/verbTable.js');
const apiDoor = require('../run/spirit/apiDoor.js');

test.startTest('goal/G10.5: the AGENTS family on the node, and who may ask it');

(async function () {
  test.subHeading('1. the world: a namespace is claimed with bare handlers, lowercase, in its own namespace');
  const t = verbTable.createVerbTable();
  t.claim('fs', 'fs', { 'fs.stat': function () { return { there: true }; } }, { wire: false });
  if (typeof t.handlerFor('fs.stat') === 'function') test.check('fs.stat is claimed and answered (verbTable.js claim)');
  else { test.fail('the world: fs.stat was not claimed; verbTable has moved'); return; }
  const notAFunction = threw(function () {
    verbTable.createVerbTable().claim('fs', 'fs', { 'fs.stat': { request: {}, reply: {}, handler: function () {} } }, { wire: false });
  });
  if (notAFunction && /not a function/.test(notAFunction.message)) test.check('the world: a declaration object is refused today, so the form is what the retrofit changes');
  else test.fail('the world: a declaration object was taken by claim: ' + short(notAFunction && notAFunction.message));

  test.subHeading('2. the world: a module cannot claim an uppercase verb, so the family is the system\'s alone');
  const upper = threw(function () {
    verbTable.createVerbTable().claim('fs', 'fs', { 'fs.AGENTS': function () {} }, { wire: false });
  });
  if (upper) test.check('a module offering fs.AGENTS is refused at the claim (' + short(upper.message).slice(0, 80) + ')');
  else test.fail('a module may claim fs.AGENTS today, so an uppercase verb is not reserved to the system');

  test.subHeading('3. the table takes the declaration form for a namespace (mount, goal/G30.4)');
  // Mounting is verbTable's, not introSpector's (goal/G30.4; Andy, 2026-10-20: "it does NOT belong in introSpector. a
  // namespace container is not known by the namespace."). The verbs come in bare.
  if (!fs.existsSync(INTROSPECTOR)) {
    test.fail(OWED + INTROSPECTOR_REL + ' is not in the tree, so the family folder has no reader');
  } else {
    let mod = null;
    const bad = threw(function () { mod = require(INTROSPECTOR); });
    if (mod) test.check(INTROSPECTOR_REL + ' loads');
    else { test.fail(OWED + INTROSPECTOR_REL + ' does not load: ' + short(bad && bad.message)); }
    if (mod && typeof mod.claim !== 'function' && typeof mod.family === 'function') test.check('introSpector offers the family alone; the claim moved out');
    else if (mod) test.fail(OWED + 'introSpector exports ' + short(Object.keys(mod)) + '; claim belongs to the table (goal/G30.4)');
  }
  const mountable = typeof verbTable.createVerbTable().mount === 'function';
  if (mountable) test.check('verbTable offers mount, which takes the declaration form');
  else test.fail(OWED + 'verbTable has no mount to take declarations');

  test.subHeading('4. a mounted namespace carries the family folder\'s FS, and no AGENTS');
  if (mountable) {
    const table = verbTable.createVerbTable();
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-introspectornode-'));
    const taken = threw(function () {
      table.mount('fs', dir, {
        'stat': { request: { path: '' }, reply: { there: false }, handler: function () { return { there: true }; } },
      }, { wire: false, by: 'fs' });
    });
    if (taken) test.fail(OWED + 'mount refused the declaration form: ' + short(taken.message));
    const verbs = table.verbs();
    ['fs.stat', 'fs.FS.loadFile', 'fs.FS.loadJsonValue', 'fs.FS.search'].forEach(function (v) {
      if (verbs.indexOf(v) !== -1) test.check(v + ' is on the node, named by the table');
      else test.fail(OWED + v + ' is not on the node; it answers ' + short(verbs));
    });
    const agents = verbs.filter(function (v) { return /\.AGENTS(\.|$)/.test(v); });
    if (!agents.length) test.check('no AGENTS verb is on the node (goal/G30.4)');
    else test.fail(OWED + 'AGENTS verbs are still on the node: ' + short(agents));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('5. the family is FS, with or without an AGENTS.md');
  // FS is always there (Andy, 2026-10-20: "introSpector will ALWAYS supply the following owner-VERB: FS"), with or
  // without an AGENTS.md; AGENTS.md is what FS reads, when it is there.
  if (fs.existsSync(INTROSPECTOR)) {
    const introSpector = require(INTROSPECTOR);
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-introspectornode-'));
    fs.writeFileSync(path.join(dir, 'stat.json'), JSON.stringify({ description: 'A verb file with no rules beside it.' }));
    const bare = introSpector.family(dir, { declared: ['stat'], prefix: 'fs.', declarations: { 'fs.stat': { request: {}, reply: {} } } });
    const names = Object.keys((bare && bare.verbs) || {});
    const bareText = bare && bare.verbs['fs.FS.loadFile'] ? bare.verbs['fs.FS.loadFile'].handler({ path: introSpector.AGENTS_FILE }).text : 'no FS.loadFile';
    if (names.indexOf('fs.FS.loadFile') !== -1 && !names.some(function (n) { return /AGENTS/.test(n); }) && bareText === null) {
      test.check('a folder without an AGENTS.md carries FS and no AGENTS verb, and FS.loadFile finds no AGENTS.md');
    } else test.fail(OWED + 'a folder with no AGENTS.md answers ' + short(names) + ', its AGENTS.md read as ' + short(bareText));
    fs.writeFileSync(path.join(dir, introSpector.AGENTS_FILE), '# rules\n');
    const dressed = introSpector.family(dir, { declared: ['stat'], prefix: 'fs.', declarations: { 'fs.stat': { request: {}, reply: {} } } });
    const now = Object.keys((dressed && dressed.verbs) || {}).sort();
    const verbFile = dressed.verbs['fs.FS.loadJsonValue'] ? dressed.verbs['fs.FS.loadJsonValue'].handler({ path: 'stat.json' }).value : null;
    const text = dressed.verbs['fs.FS.loadFile'] ? dressed.verbs['fs.FS.loadFile'].handler({ path: introSpector.AGENTS_FILE }).text : null;
    if (text === '# rules\n' && verbFile && /no rules beside it/.test(verbFile.description)) test.check('and with an AGENTS.md FS reads it, and the verb file beside it: ' + short(now));
    else test.fail(OWED + 'with an AGENTS.md the folder answers ' + short(now) + ', AGENTS.md ' + short(text) + ', stat.json ' + short(verbFile));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('6. the world: a loopback caller is allowed everything, so nothing here gates the family');
  // Andy's ruling of 2026-10-09 (quoted in the header): a loopback caller arrives as the node's own key and reaches
  // every verb. This stays as one world line so the next reader knows the hole is a decision and not an oversight.
  const asked = [];
  const servers = { ask: function (ask, who) { asked.push({ ask: ask, who: who }); return { status: 200, body: { ok: true } }; } };
  const owner = await apiDoor.answer(servers, { probe: { 'FS.search': { q: '' } } }, { owner: true, key: 'own', label: 'andy' });
  if (owner.status === 200 && asked.length === 1 && asked[0].who && asked[0].who.owner === true) test.check('the world: the owner\'s own ask reaches the family, the caller riding on as the owner (apiDoor.js answer)');
  else test.fail('the world: the owner was refused FS.search: ' + short(owner));

})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
