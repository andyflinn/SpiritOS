'use strict';

// goal/G10.5: the AGENTS family on the node's own door, and who may ask it. Red on today's code; wsl-claude wrote it
// from the item's box at d6e9df7d and does not build it.
//   Andy, 2026-10-09: "the module in core like hub.js could have a corresponding folder spirit/run/js/hub/ where the
//   AGENTS.md and the verb descriptions are"; ".. and if there's no AGENTS.md the verb is closed for the agent,
//   period."; "so the introSpector could still insist on lower-case verbs to be registered, and then STILL add the
//   uppercase set"; "that is a decision. make it so."; and "those verbs and descriptions will be provided for
//   loopback clients the local-node-public-key only".
//
// WHAT IS TRUE TODAY (read in the tree at d6e9df7d): spirit/run/js/introSpector.js does not exist. The node's
// loopback verbs are claimed in verbTable as bare functions behind a lowercase name rule (verbTable.js:92, claim),
// eleven namespaces in server.js; no namespace has a folder, no AGENTS.md, no verb files, and the node answers no
// AGENTS verb of its own. apiDoor lets a member call any verb of an app its grants name (apiDoor.js:101-107), so the
// family, once it exists, would be granted along with the namespace.
//
// WHAT IS ASSERTED:
//   1. the world: a namespace is claimed with bare handlers, lowercase, in its own namespace.
//   2. the world: a module cannot claim an uppercase verb, so the family can only ever be the system's.
//   3. introSpector takes the declaration form {request, reply, handler, accepts?} for a namespace.
//   4. a claimed namespace carries the family: fs.AGENTS, fs.AGENTS.introspect, fs.AGENTS.<verb>, added by
//      introSpector and not by the module.
//   5. a verb with no file is not listed to an agent, and the owner keeps it.
//   6. (withdrawn) who may ask the family is NOT this item's. Andy, 2026-10-09, answering the red question this
//      suite raised: point 6 of the box "is indeed stale wording, it is already the case that when an appServer is
//      called via loopback, the appClient inserts the public key of the local node as 'caller', and thus as
//      \"allowed\" everything. now because the agent is gated by deskUnsloth, it's deskUnsloth.js that configures
//      access to endpoints by configuration, which is not supposed to be in this item." So the gating belongs to
//      deskUnsloth and the tools goal; one world line stands here in its place and nothing is owed.
//
// THE ONE THING DELIBERATELY NOT GUESSED: the item's box names the family twice and not alike - point 2 as named
// verbs (AGENTS.introspect), point 6 as the asks {introspect} and {verb}, which is the older argument shape from the
// chat. This suite follows point 2, Andy's "plus one verb AGENTS.introspect", and the difference is a red question
// on the item rather than a shape invented here.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G10.5: ';
const REPO = path.join(__dirname, '..', '..');
const INTROSPECTOR_REL = 'spirit/run/js/introSpector.js';
const INTROSPECTOR = path.join(REPO, INTROSPECTOR_REL);

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function threw(fn) { try { fn(); return null; } catch (e) { return e; } }

const verbTable = require('../run/js/verbTable.js');
const apiDoor = require('../run/js/apiDoor.js');

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

  test.subHeading('3. introSpector takes the declaration form for a namespace');
  if (!fs.existsSync(INTROSPECTOR)) {
    test.fail(OWED + INTROSPECTOR_REL + ' is not in the tree, so the declaration form has no home');
    test.fail(OWED + 'and with it absent, the family cannot be added to a namespace (assertion 4)');
    test.fail(OWED + 'nor can a verb without a file be hidden from an agent while the owner keeps it (assertion 5)');
  } else {
    let mod = null;
    const bad = threw(function () { mod = require(INTROSPECTOR); });
    if (mod) test.check(INTROSPECTOR_REL + ' loads');
    else { test.fail(OWED + INTROSPECTOR_REL + ' does not load: ' + short(bad && bad.message)); }
    if (mod && typeof mod.claim === 'function') test.check('introSpector offers a claim of its own');
    else if (mod) test.fail(OWED + 'introSpector exports ' + short(Object.keys(mod)) + ', with no claim to take declarations');

    test.subHeading('4. a claimed namespace carries the family');
    if (mod && typeof mod.claim === 'function') {
      const table = verbTable.createVerbTable();
      const taken = threw(function () {
        mod.claim(table, 'fs', 'fs', {
          'fs.stat': { request: { path: '' }, reply: { there: false }, handler: function () { return { there: true }; } },
        }, { wire: false });
      });
      if (taken) test.fail(OWED + 'introSpector refused the declaration form: ' + short(taken.message));
      const verbs = table.verbs();
      ['fs.AGENTS', 'fs.AGENTS.introspect', 'fs.AGENTS.stat'].forEach(function (v) {
        if (verbs.indexOf(v) !== -1) test.check(v + ' is on the node, added by introSpector');
        else test.fail(OWED + v + ' is not on the node; it answers ' + short(verbs));
      });
    }
  }

  test.subHeading('5. no AGENTS.md, no family at all');
  // The folder rule, the half the mutation test caught as unasserted on 2026-10-10: Andy, 2026-10-09, ".. and if
  // there's no AGENTS.md the verb is closed for the agent, period." A folder with a verb file and no AGENTS.md hands
  // out nothing: not the file, not the list, not even AGENTS itself.
  if (fs.existsSync(INTROSPECTOR)) {
    const introSpector = require(INTROSPECTOR);
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-introspectornode-'));
    fs.writeFileSync(path.join(dir, 'stat.json'), JSON.stringify({ description: 'A verb file with no rules beside it.' }));
    const bare = introSpector.family(dir, { declared: ['stat'], prefix: 'fs.', declarations: { 'fs.stat': { request: {}, reply: {} } } });
    const names = Object.keys((bare && bare.verbs) || {});
    if (!names.length) test.check('a folder without an AGENTS.md carries no verb of the family, its verb file notwithstanding');
    else test.fail(OWED + 'a folder with no AGENTS.md still answers ' + short(names));
    fs.writeFileSync(path.join(dir, introSpector.AGENTS_FILE), '# rules\n');
    const dressed = introSpector.family(dir, { declared: ['stat'], prefix: 'fs.', declarations: { 'fs.stat': { request: {}, reply: {} } } });
    const now = Object.keys((dressed && dressed.verbs) || {}).sort();
    if (now.indexOf('fs.AGENTS') !== -1 && now.indexOf('fs.AGENTS.stat') !== -1) test.check('and the same folder with an AGENTS.md carries it: ' + short(now));
    else test.fail(OWED + 'with an AGENTS.md the folder answers ' + short(now));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('6. the world: a loopback caller is allowed everything, so nothing here gates the family');
  // Andy's ruling of 2026-10-09 (quoted in the header) took the gating out of this item: a loopback caller arrives
  // as the node's own key and reaches every verb, and what an agent may call is deskUnsloth's configuration, a later
  // goal's. This stays as one world line so the next reader knows the hole is a decision and not an oversight.
  const asked = [];
  const servers = { ask: function (ask, who) { asked.push({ ask: ask, who: who }); return { status: 200, body: { ok: true } }; } };
  const owner = await apiDoor.answer(servers, { probe: { 'AGENTS.introspect': {} } }, { owner: true, key: 'own', label: 'andy' });
  if (owner.status === 200 && asked.length === 1 && asked[0].who && asked[0].who.owner === true) test.check('the world: the owner\'s own ask reaches the family, the caller riding on as the owner (apiDoor.js answer)');
  else test.fail('the world: the owner was refused AGENTS.introspect: ' + short(owner));

})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
