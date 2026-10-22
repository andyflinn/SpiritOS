'use strict';

// spirit/test/spiritServers.js
// goal/G32.3: the servers move onto the spirit object. Red on today's tree; claude-windows writes it and builds it (one
// agent). The box (v8), in short:
//   - Every server process under process/js reaches the node only through the spirit object, on the node's loopback
//     door; no hand-made call (askNode, kernel.core.ask with the node's url) is left.
//   - Every server with verbs ships an api.js in its family folder, process/js/<name>/<name>.family/api.js, delivered
//     by the node to the caller without the server hearing of it.
//   - An api.js names no namespace of its own: the node maps it. The node families' api.js (goal/G32.1) follow the
//     same rule: none names its family or registers itself on the spirit object.
//   - The api verb takes an optional family (approved verb change, Andy 2026-10-22: "verb change approved."):
//     api {family} answers that family's interface, the text of its api.js, read by the node from js/<family>/ or
//     <server>.family/; api with no argument is unchanged. The page and the servers get every interface this way.
// NAMED HERE: an api.js is `module.exports = { verbs: { <verb>: { <arg>: '<rule>[?]' } }, names(call, tools) }`, run
// by the spirit object as a module; api {family} answers { family, interface }; over the wire the ask is
// {api: {family}}, and apiDoor answers a member only for a family it holds a grant in. A dotted verb is also on the
// member in camel case (line.write -> lineWrite), as the box names spirit.chatClerver.lineWrite.
// rule/11: through testSupport only; nothing reaches a node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

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
      if (n.name === 'node_modules') return;
      const full = path.join(d, n.name);
      if (n.isDirectory()) walk(full); else if (/\.js$/.test(n.name)) out.push(full);
    });
  }(dir));
  return out;
}
const rel = function (full) { return path.relative(RUN, full).split(path.sep).join('/'); };

test.startTest('goal/G32.3: the servers on the spirit object, every interface from the node');

const done = (async function () {
  test.subHeading('1. no api.js names its own family');
  const apis = fs.readdirSync(path.join(RUN, 'js'), { withFileTypes: true }).filter(function (d) { return d.isDirectory(); })
    .map(function (d) { return path.join(RUN, 'js', d.name, 'api.js'); })
    .concat(fs.readdirSync(PROC).map(function (n) { return path.join(PROC, n, n + '.family', 'api.js'); }))
    .filter(function (f) { return fs.existsSync(f); });
  const claiming = apis.filter(function (f) { const s = raw(f); return /\bfamily\s*:/.test(s) || /\.families\b/.test(s) || /\broot\.spirit\b|\bwindow\.spirit\b/.test(s); });
  if (apis.length >= 10 && !claiming.length) test.check(apis.length + ' api.js files, none naming its family or registering itself');
  else test.fail(OWED + 'api.js files naming their family or registering: ' + short(claiming.map(rel)));

  test.subHeading('2. every server with verbs ships its api.js');
  const servers = fs.readdirSync(PROC).filter(function (n) { return /appServer\.serve\(/.test(raw(path.join(PROC, n, n + '.js'))); });
  const lacking = servers.filter(function (n) {
    const f = path.join(PROC, n, n + '.family', 'api.js');
    if (!fs.existsSync(f)) return true;
    const m = { exports: {} };
    try { new Function('module', 'exports', raw(f))(m, m.exports); } catch (e) { return true; }
    return !m.exports || !m.exports.verbs || !Object.keys(m.exports.verbs).length;
  });
  if (servers.length >= 5 && !lacking.length) test.check('the ' + servers.length + ' servers with verbs each ship <name>.family/api.js with their verbs: ' + servers.join(', '));
  else test.fail(OWED + 'servers without an api.js of their verbs: ' + short(lacking));

  test.subHeading('3. no hand-made node call left in process/js');
  const handMade = jsFiles(PROC).filter(function (f) {
    const s = raw(f);
    return /function askNode\b/.test(s) || /\bcore\.ask\(/.test(s) || /['"`]\/api\/spirit['"`]/.test(s);
  });
  if (!handMade.length) test.check('no askNode, core.ask or /api/spirit of its own in any server');
  else test.fail(OWED + 'hand-made node calls in ' + short(handMade.map(rel)));

  test.subHeading('4. api {family} answers the interface, and the gate holds');
  const vt = require('../run/js/verbTable.js');
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
  const apiDoor = require('../run/js/apiDoor.js');
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

  test.subHeading('5. the spirit object takes every interface through api {family}, under the node\'s name');
  const S = require('../run/face/spirit.js');
  const asked = [];
  const transport = {
    ask: function (verb, args) {
      asked.push(verb + (args && args.family ? ' ' + args.family : ''));
      if (verb === 'api' && args && args.family) return Promise.resolve({ status: 200, body: { family: args.family, interface: "module.exports = { verbs: { 'line.write': { to: 'text', text: 'text' } } };" } });
      if (verb === 'api') return Promise.resolve({ status: 200, body: { chatClerver: { 'line.write': {} } } });
      return Promise.resolve({ status: 200, body: { seq: 1 } });
    },
    file: function () { asked.push('file'); return Promise.resolve({ status: 404, bytes: new Uint8Array(0) }); },
  };
  let made = null;
  let wrote = null;
  try {
    made = await S.createSpirit(transport);
    wrote = await made.chatClerver.lineWrite({ to: 'k', text: 'hi' });
  } catch (e) { made = made || { threw: e.message }; wrote = { threw: e.message }; }
  if (made && made.chatClerver && typeof made.chatClerver.lineWrite === 'function' && wrote && wrote.seq === 1 && asked.indexOf('api chatClerver') !== -1 && asked.indexOf('file') === -1) {
    test.check('spirit.chatClerver.lineWrite from the interface api {family} answered, no file path of its own');
  } else test.fail(OWED + 'the object asked ' + short(asked) + ', made ' + short(made && Object.keys(made)) + ', wrote ' + short(wrote));
}());

done.catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
