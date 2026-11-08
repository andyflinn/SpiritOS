'use strict';

// spirit/test/spiritServers.js
// goal/G32.3: the servers on the spirit object. What this suite asserts:
//   - Every server process under process/js reaches the node only through the spirit object, on the node's loopback
//     door; no hand-made call (askNode, kernel.core.ask with the node's url) is left.
//   - The api verb takes an optional family (Andy 2026-10-22: "verb change approved."): api {family} answers that
//     family's interface, the text of its api.js; api with no argument answers the families.
// NAMED HERE: an api.js is `module.exports = { verbs: { <verb>: { <arg>: '<rule>[?]' } }, names(call, tools) }`;
// api {family} answers { family, interface }; over the wire the ask is {api: {family}}, and apiDoor answers a member
// only for a family it holds a grant in. A dotted verb is also on the member in camel case (line.write -> lineWrite).
// rule/11: through testSupport only; nothing reaches a node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const VENDORED_FOLDERS = require('../run/spirit/fileSystem.js').VENDORED_FOLDERS;

const OWED = 'OWED by goal/G32.3: ';
const RUN = path.join(__dirname, '..', 'run');
const PROC = path.join(RUN, 'process', 'js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function raw(full) { try { return fs.readFileSync(full, 'utf8'); } catch (e) { return ''; } }
function jsFiles(dir) {
  const out = [];
  (function walk(d) {
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    names.forEach(function (n) {
      const full = path.join(d, n.name);
      if (VENDORED_FOLDERS.holds(full)) return;
      if (n.isDirectory()) walk(full); else if (/\.js$/.test(n.name)) out.push(full);
    });
  }(dir));
  return out;
}
const rel = function (full) { return path.relative(RUN, full).split(path.sep).join('/'); };

test.startTest('goal/G32.3: the servers on the spirit object, every interface from the node');

const done = (async function () {
  test.subHeading('3. no hand-made node call left in process/js');
  const handMade = jsFiles(PROC).filter(function (f) {
    const s = raw(f);
    return /function askNode\b/.test(s) || /\bcore\.ask\(/.test(s) || /['"`]\/api\/spirit['"`]/.test(s);
  });
  if (!handMade.length) test.check('no askNode, core.ask or /api/spirit of its own in any server');
  else test.fail(OWED + 'hand-made node calls in ' + short(handMade.map(rel)));
  // A verb the node no longer serves is no call at all (relay.status went with puppets/G2: a list is a search).
  const gone = jsFiles(PROC).filter(function (f) { return /['"]relay\.status['"]/.test(raw(f)); });
  if (!gone.length) test.check('no server asks relay.status, which the node no longer serves');
  else test.fail(OWED + 'relay.status still asked in ' + short(gone.map(rel)));

  test.subHeading('4. api {family} answers the interface, and the gate holds');
  const vt = require('../run/spirit/verbTable.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-servers-'));
  const famDir = path.join(dir, 'zzfam');
  fs.mkdirSync(famDir, { recursive: true });
  const IFACE = "module.exports = { verbs: { ping: { text: 'text' } } };\n";
  fs.writeFileSync(path.join(famDir, 'api.js'), IFACE);
  let door = null;
  let byAsk = null;
  let byCall = null;
  let none = null;
  try {
    const table = vt.createVerbTable();
    table.mount('zzfam', famDir, { ping: { request: { text: '' }, reply: {}, handler: function (rq, rs) { rs.writeHead(200); rs.end('{}'); } } }, { wire: false });
    door = table.door({ ask: function () { return Promise.resolve({ status: 200, body: {} }); }, apps: function () { return []; } }, {});
    byAsk = await door.ask({ api: { family: 'zzfam' } }, { owner: true });
    byCall = await door.call('api', { family: 'zzfam' });
    none = await door.call('api', { family: 'zzNobody' });
  } catch (e) { byAsk = { threw: e.message }; }
  const ok = function (r) { return r && r.status === 200 && r.body && r.body.family === 'zzfam' && r.body.interface === IFACE; };
  if (ok(byAsk) && ok(byCall)) test.check('the door answers {family, interface} for {api: {family}} and for the verb api {family}');
  else test.fail(OWED + 'api {family} answered ' + short(byAsk) + ' / ' + short(byCall));
  if (none && none.status >= 400) test.check('a family the node does not serve answers no interface: ' + none.status);
  else test.fail(OWED + 'an unknown family answered ' + short(none));
  const apiDoor = require('../run/spirit/apiDoor.js');
  const servers2 = { ask: function (ask) { return Promise.resolve({ status: 200, body: { family: ask.api && ask.api.family, interface: 'x' } }); } };
  const granted = { key: 'K', auth: { pathsOf: function () { return ['zzfam.ping']; } } };
  const answer = apiDoor.answer || (apiDoor._test && apiDoor._test.answer);
  let mine = null;
  let theirs = null;
  try {
    mine = await answer(servers2, { api: { family: 'zzfam' } }, granted);
    theirs = await answer(servers2, { api: { family: 'other' } }, granted);
  } catch (e) { mine = { threw: e.message }; }
  if (mine && mine.status === 200 && theirs && theirs.status === 403) test.check('apiDoor answers a member the interface of a family it holds a grant in, and refuses another');
  else test.fail(OWED + 'apiDoor answered ' + short(mine) + ' / ' + short(theirs));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* busy */ }

}());

done.catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
