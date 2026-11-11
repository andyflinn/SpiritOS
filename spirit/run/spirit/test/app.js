'use strict';

// spirit/run/spirit/test/app.js
// The tests of spirit/app.js and its family, and of no other module (spec: ./app.md; goal/G43.2). Andy, box: "we build a
// skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called \"app\"". Raw calls over
// http to a scratch node's door; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
// Up here, before the first result: under the verifier testReport.js loads spirit.js for its records with the global
// put aside, and a server module required after that finds no global spirit.
const { faceRefuses } = require(path.join(RUN, 'spirit', 'faceHome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function ask(base, call, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// The rows of a search that answered as every probability search does, or null.
function rows(r) { return r && r.status === 200 && r.body && Array.isArray(r.body.items) ? r.body.items : null; }
function holds(items, words) { return !!items && items.some(function (i) { return JSON.stringify(i).indexOf(words) !== -1; }); }

// What the tests share: the scratch node, the family's api and what the steps before a test found.
const W = {};
const FILE = path.join(RUN, 'spirit', 'app.js');
const FOLDER = path.join(RUN, 'spirit', 'app');
function noNode() { return W.node && W.node.up ? null : 'no scratch node: the world failed'; }
function scratchApp(...p) { return path.join(W.node.root, 'spirit', 'run', 'spirit', 'app', ...p); }
const stateFile = function (k) { return path.join(W.node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };
const activeIn = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')).active; } catch (e) { return undefined; } };
const stateRead = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')); } catch (e) { return {}; } };
// An intrinsic app is always active (goal/G43.14), so it is no app the user set.
const intrinsicApp = function (k) { try { return JSON.parse(fs.readFileSync(scratchApp(k, k + '.json'), 'utf8')).identity.intrinsic === true; } catch (e) { return false; } };

test.run('spirit/app.js is there, the family\'s core module', 0.2, function () { return fs.existsSync(FILE) || 'spirit/app.js is not there'; }, 1000);
test.run('spirit/app/api.js is there, as in every core family', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'api.js')) || 'spirit/app/api.js is not there'; }, 1000);
test.run('spirit/app/AGENTS.md is there, as in every core family', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'AGENTS.md')) || 'spirit/app/AGENTS.md is not there'; }, 1000);
test.run('spirit/app/data.js is there, as in every core family', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'data.js')) || 'spirit/app/data.js is not there'; }, 1000);
test.run('spirit/app/search.json is there, as in every core family', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'search.json')) || 'spirit/app/search.json is not there'; }, 1000);

// THE ONE VERB (Andy, box: "the first verb of the app api is app.search", "no filters, just a search string").
test.run('search, active, icon and label are the family\'s verbs (app.shell went, goal/G43.18, Q10)', 0.2, function () {
  let api = null;
  try { api = require(path.join(FOLDER, 'api.js')); } catch (e) { api = null; }
  const verbs = W.verbs = api && api.verbs;
  return (!!verbs && Object.keys(verbs).sort().join() === 'active,icon,label,search') || 'the family\'s verbs are ' + short(verbs ? Object.keys(verbs) : 'not there');
}, 1000);
test.run('search takes one optional search string, q, and no filters', 0.2, function () {
  const verbs = W.verbs;
  return (!!verbs && !!verbs.search && Object.keys(verbs.search).join() === 'q' && verbs.search.q === 'text?') || 'search takes ' + short(verbs && verbs.search);
}, 1000);

// A PLUGIN'S DESCRIPTION (Andy, box: "containing identity:icon and identity:label").
// That server.json names both is a rule of every app branch, judged in ./spirit-sibling-branchRules.js (goal/G43.32).
const SERVER = path.join(FOLDER, 'server');
let identity = null;
try { identity = JSON.parse(fs.readFileSync(path.join(SERVER, 'server.json'), 'utf8')).identity; } catch (e) { identity = null; }
const label = identity && typeof identity.label === 'string' ? identity.label : '';
const icon = identity && typeof identity.icon === 'string' ? identity.icon : '';

// A FACE CAN CALL IT (Andy, box: "and yes, a face with no star can call appSearch"; since goal/G43.18, box v29, "A face is
// whole, or there is none": the node answers a face only from a starred relay, faceStar.js, and that face calls every verb).
test.run('a face may call app.search', 0.2, function () {
  const said = faceRefuses({ call: 'app.search', args: {} });
  return said === '' || 'a face is refused app.search: ' + short(said);
}, 1000);
test.run('the same question refuses contact.own, so it can refuse', 0.8, function () {
  return faceRefuses({ call: 'contact.own', args: {} }) !== '' || 'contact.own is let through as well: the check above judged nothing';
}, 1000);

test.run('the world: the scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return W.node.up || 'the scratch node did not come up: nothing judged';
}, 4000);
test.after(function () {
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// IT GIVES THE NODE ITS API (Andy, box: "sit nicely beside all other families").
const inTree = function (name) { const b = (W.tree && W.tree.body) || {}; return !!(b[name] || (b.api && b.api[name]) || (b.families && b.families[name])); };
test.run('the node\'s api names jobs, so this question can answer', 0.2, async function () {
  if (noNode()) return noNode();
  W.tree = await ask(W.node.base, 'api', {});
  return inTree('job') || 'the node\'s api does not name jobs: ' + short(W.tree.text);
}, 1000);
test.run('the node\'s api names the app family beside the others', 0.2, function () {
  if (!W.tree) return 'no api asked: the test before it failed';
  return inTree('app') || 'the node\'s api does not name app';
}, 1000);

// THE SEARCH (Andy, box: "styled like other probability searches"; "It is JUST there to be found").
test.run('app.search answers a list, as other searches do', 0.2, async function () {
  if (noNode()) return noNode();
  const all = await ask(W.node.base, 'app.search', {});
  W.items = rows(all);
  return !!W.items || 'app.search answered ' + all.status + ' ' + short(all.text);
}, 1000);
test.run('each row is a key and a label', 0.2, function () {
  const items = W.items;
  return (!!items && items.every(function (i) { return typeof i.key === 'string' && i.key && typeof i.label === 'string'; })) || 'its rows are ' + short(items);
}, 1000);
test.run('an empty search finds server by its label', 0.2, function () {
  return (!!label && holds(W.items, label)) || 'an empty search does not hold the label: ' + short(W.items);
}, 1000);
test.run('server\'s row carries its icon', 0.2, function () {
  return (!!icon && holds(W.items, icon)) || 'server\'s row has no icon: ' + short(W.items);
}, 1000);
test.run('searching its label finds it', 0.2, async function () {
  if (noNode()) return noNode();
  const found = await ask(W.node.base, 'app.search', { q: label });
  return (!!label && holds(rows(found), label)) || 'searching its label answered ' + short(found.text);
}, 1000);
test.run('words that fit nothing do not find it', 0.2, async function () {
  if (noNode()) return noNode();
  const none = await ask(W.node.base, 'app.search', { q: 'zzqqxxvvkk' });
  return (!!rows(none) && !!label && !holds(rows(none), label)) || 'words that fit nothing answered ' + short(none.text);
}, 1000);
test.run('a filter is refused at the door: there are none', 0.2, async function () {
  if (noNode()) return noNode();
  const filter = await ask(W.node.base, 'app.search', { q: '', keep: 'yes' });
  return (filter.status >= 400 && filter.status < 500) || 'a filter answered ' + filter.status + ' ' + short(filter.text);
}, 1000);

// ONLY A FOLDER WITH ITS OWN <name>/<name>.json IS A PLUGIN (Andy, G43.1 box: "the new \"default\" pattern in that module
// is: /<name>/<name>.json"), and it comes from the disk, not from a list naming server.
// The plugins are exactly the folders of spirit/app/ holding their own <name>.json, read from the disk here too, as apps move
// in one by one (goal/G43.13, G43.14); appSelector and test are not taken for apps.
test.run('the plugins are the folders with their own json: appSelector and test are not taken for apps', 0.2, function () {
  if (noNode()) return noNode();
  const onDisc = fs.readdirSync(scratchApp(), { withFileTypes: true }).filter(function (d) { return d.isDirectory() && fs.existsSync(scratchApp(d.name, d.name + '.json')); }).map(function (d) { return d.name; }).sort().join();
  const keys = (W.items || []).map(function (i) { return i.key; }).sort().join();
  return (keys === onDisc && keys.split(',').indexOf('appSelector') === -1 && keys.split(',').indexOf('test') === -1) || 'an empty search found ' + short(keys) + ', the disc holds ' + short(onDisc);
}, 1000);
// goal/G43.6; Andy, box: "spirit.app also holds the family's verb, search, so no app may take the name of a verb."
test.run('a folder named after the family\'s verb is no app', 0.2, async function () {
  if (noNode()) return noNode();
  const verbNamed = scratchApp('search');
  fs.mkdirSync(verbNamed, { recursive: true });
  fs.writeFileSync(path.join(verbNamed, 'search.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Verb Named Label' } }));
  const stands = await until(function () { return ask(W.node.base, 'app.search', {}).then(function (r) { return holds(rows(r), 'Verb Named Label'); }); }, 2500);
  fs.rmSync(verbNamed, { recursive: true, force: true });
  return !stands || 'a folder named search was taken for an app';
}, 8000);
test.run('a second folder with its own .json is found: the list is the disk', 0.2, async function () {
  if (noNode()) return noNode();
  const plugin = scratchApp('zzplugin');
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'zzplugin.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Zz Plugin Label' } }));
  const seen = await until(function () { return ask(W.node.base, 'app.search', {}).then(function (r) { return holds(rows(r), 'Zz Plugin Label'); }); }, 5000);
  return seen || 'a second plugin on the disk is never found';
}, 6000);
test.run('a folder without its own .json is not one', 0.2, async function () {
  if (noNode()) return noNode();
  fs.mkdirSync(scratchApp('zzbare'), { recursive: true });
  const bare = await ask(W.node.base, 'app.search', { q: 'zzbare' });
  return (!!rows(bare) && !holds(rows(bare), 'zzbare')) || 'a folder without its .json was found: ' + short(bare.text);
}, 1000);

// ── app.active (goal/G43.9) ──
// The box: "spirit.app gains a verb: "active"", "app.active { key, active } sets it; only the owner may."
const V = require(path.join(RUN, 'spirit', 'app', 'api.js')).verbs || {};
test.run('api.js names the verb with key and active', 0.2, function () {
  return (!!V.active && 'key' in V.active && 'active' in V.active) || 'api.js verbs: ' + short(V);
}, 1000);
test.run('the verb has its file, active.json', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'app', 'active.json')) || 'no spirit/app/active.json';
}, 1000);
test.run('the box: app.search stays "just a search string"', 0.2, function () {
  return Object.keys(V.search || {}).join() === 'q' || 'app.search takes: ' + short(V.search);
}, 1000);
// The box: "The user sets active, so Monitor and server start off".
// Monitor is intrinsic since Andy's 7f6ebbbe ("intrinsic flag"), so always on: the Agent, intrinsic false, is the app switched here.
test.run('neither is active before a press', 0.2, function () {
  if (noNode()) return noNode();
  return (activeIn('agent') !== true && activeIn('server') !== true) || 'active before a press: ' + short([activeIn('agent'), activeIn('server')]);
}, 1000);
test.run('and no row but an intrinsic app\'s says active', 0.2, async function () {
  if (noNode()) return noNode();
  const before = rows(await ask(W.node.base, 'app.search', {})) || [];
  const lit = before.filter(function (i) { return (parsed(i.label) || {}).active === true && !intrinsicApp(i.key); }).map(function (i) { return i.key; });
  return (before.length > 0 && !lit.length) || (before.length ? 'rows that say active before a press: ' + short(lit) : 'app.search answered no rows');
}, 1000);
// The box: "The node writes spirit/state/<key>/node.json".
test.run('active true lands in spirit/state/agent/node.json', 0.2, async function () {
  if (noNode()) return noNode();
  const on = await ask(W.node.base, 'app.active', { key: 'agent', active: true });
  return (on.status === 200 && activeIn('agent') === true) || 'after active true: ' + short({ status: on.status, text: on.text, file: activeIn('agent') });
}, 1000);
// Andy: "on first activate, spirit/state/<name>/node.json should be initialized with the values from spirit/app/<name>/<name>.json", and on Q7: "it just holds active (boolean), icon (glyph), label(string) and shell (boolean),"
test.run('the first activate copies label and icon from <name>.json (shell no more, goal/G43.18)', 0.2, function () {
  if (noNode()) return noNode();
  const firstState = W.firstState = stateRead('agent');
  const agentJson = JSON.parse(fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8'));
  return (firstState.label === agentJson.identity.label && firstState.icon === agentJson.identity.icon) || 'node.json after the first activate: ' + short(firstState);
}, 1000);
test.run('and it holds those and active, nothing else', 0.2, function () {
  if (!W.firstState) return 'no node.json read: the test before it failed';
  return Object.keys(W.firstState).sort().join() === 'active,icon,label' || 'node.json holds: ' + short(Object.keys(W.firstState));
}, 1000);
test.run('a label the node chose first stays, and the rest is copied', 0.2, async function () {
  if (noNode()) return noNode();
  await ask(W.node.base, 'app.label', { key: 'server', label: 'Chosen First' });
  await ask(W.node.base, 'app.active', { key: 'server', active: true });
  const chosen = stateRead('server');
  await ask(W.node.base, 'app.active', { key: 'server', active: false });
  return (chosen.label === 'Chosen First' && typeof chosen.icon === 'string' && chosen.icon !== '' && chosen.active === true) || 'server\'s node.json: ' + short(chosen);
}, 1000);
test.run('active false lands there too', 0.2, async function () {
  if (noNode()) return noNode();
  const off = await ask(W.node.base, 'app.active', { key: 'agent', active: false });
  const verdict = (off.status === 200 && activeIn('agent') === false) || 'after active false: ' + short({ status: off.status, file: activeIn('agent') });
  await ask(W.node.base, 'app.active', { key: 'agent', active: true });
  return verdict;
}, 1000);
// ── intrinsic (goal/G43.14) ──
// The box: "intrinsic true: the app is always active", "app.active does not switch it off".
const rowFor = async function (k) { const got = rows(await ask(W.node.base, 'app.search', { q: '' })) || []; const r = got.filter(function (i) { return i.key === k; })[0]; return r ? parsed(r.label) : null; };
test.run('the world: contact.json says intrinsic true', 0.2, function () {
  if (noNode()) return noNode();
  return intrinsicApp('contact') || 'spirit/app/contact/contact.json does not say intrinsic true';
}, 1000);
test.run('its row says active with no press, and nothing was written for it', 0.2, async function () {
  if (noNode()) return noNode();
  const c0 = W.c0 = await rowFor('contact');
  return (!!c0 && c0.active === true && activeIn('contact') === undefined) || 'its row: ' + short(c0) + ', node.json active ' + short(activeIn('contact'));
}, 1000);
// goal/G43.15, the box: "an app's row carries intrinsic, the row shows no Activate/Deactivate for it, and app.active refuses an
// intrinsic app by name, writing nothing."
test.run('its row carries intrinsic true', 0.2, function () {
  return (!!W.c0 && W.c0.intrinsic === true) || 'its row: ' + short(W.c0);
}, 1000);
test.run('the Agent\'s row carries intrinsic false', 0.2, async function () {
  if (noNode()) return noNode();
  const a0 = await rowFor('agent');
  return (!!a0 && a0.intrinsic === false) || 'the Agent\'s row: ' + short(a0);
}, 1000);
test.run('app.active on an intrinsic app is refused, by name', 0.2, async function () {
  if (noNode()) return noNode();
  const refused = await ask(W.node.base, 'app.active', { key: 'contact', active: false });
  return (refused.status !== 200 && !!refused.body && typeof refused.body.code === 'string' && refused.body.code !== '') || 'app.active on contact: ' + short({ status: refused.status, text: refused.text });
}, 1000);
test.run('and nothing is written for it', 0.2, function () {
  if (noNode()) return noNode();
  return activeIn('contact') === undefined || 'its node.json says active ' + short(activeIn('contact'));
}, 1000);
test.run('app.active false does not switch it off: its row still says active', 0.2, async function () {
  if (noNode()) return noNode();
  const c1 = await rowFor('contact');
  return (!!c1 && c1.active === true) || 'after app.active false: ' + short(c1);
}, 1000);

// The box: "A key not in spirit/app is refused, so no path can be written through it."
const refuses = async function (bad) {
  if (noNode()) return noNode();
  const r = await ask(W.node.base, 'app.active', { key: bad, active: true });
  return r.status !== 200 || 'not refused: ' + JSON.stringify(bad) + ' ' + short(r.text);
};
test.run('refused: nosuchapp, no app', 0.2, function () { return refuses('nosuchapp'); }, 1000);
test.run('refused: ../evil, a path up', 0.8, function () { return refuses('../evil'); }, 1000);
test.run('refused: .., the folder above', 0.8, function () { return refuses('..'); }, 1000);
test.run('refused: appSelector, no app', 0.2, function () { return refuses('appSelector'); }, 1000);
test.run('refused: test, a test folder', 0.2, function () { return refuses('test'); }, 1000);
test.run('refused: monitor/../../evil, a path out', 0.8, function () { return refuses('monitor/../../evil'); }, 1000);
test.run('refused: an empty key', 0.2, function () { return refuses(''); }, 1000);
test.run('and none of them wrote anything', 0.8, function () {
  if (noNode()) return noNode();
  const root = W.node.root;
  return (!fs.existsSync(path.join(root, 'spirit', 'run', 'spirit', 'state', 'nosuchapp')) && !fs.existsSync(path.join(root, 'spirit', 'run', 'spirit', 'evil')) && !fs.existsSync(path.join(root, 'spirit', 'run', 'evil'))) || 'a refused key left a file';
}, 1000);
// Q4: "Do a label change and allow-as-shell go in spirit/state/<name>/node.json, through two new verbs app.label and app.shell?", Andy: "yes."
test.run('app.label names key and label, and has its file', 0.2, function () {
  return (!!V.label && 'key' in V.label && 'label' in V.label && fs.existsSync(path.join(RUN, 'spirit', 'app', 'label.json'))) || 'app.label: ' + short(V.label);
}, 1000);
test.run('app.label writes node.json', 0.2, async function () {
  if (noNode()) return noNode();
  W.sidecarBefore = fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8');
  const named = await ask(W.node.base, 'app.label', { key: 'agent', label: 'Renamed Here' });
  return (named.status === 200 && stateRead('agent').label === 'Renamed Here') || 'after app.label: ' + short({ s: named.status, t: named.text, f: stateRead('agent') });
}, 1000);
test.run('and keeps what else it holds', 0.2, function () {
  if (noNode()) return noNode();
  return stateRead('agent').active === true || 'node.json lost active: ' + short(stateRead('agent'));
}, 1000);
test.run('node.json overrides <name>.json: a search answers the new label', 0.2, async function () {
  if (noNode()) return noNode();
  return holds(rows(await ask(W.node.base, 'app.search', { q: 'Renamed Here' })), 'Renamed Here') || 'a search does not answer the new label';
}, 1000);
test.run('app.icon names key and icon, and has its file', 0.2, function () {
  return (!!V.icon && 'key' in V.icon && 'icon' in V.icon && fs.existsSync(path.join(RUN, 'spirit', 'app', 'icon.json'))) || 'app.icon: ' + short(V.icon);
}, 1000);
test.run('app.icon writes node.json', 0.2, async function () {
  if (noNode()) return noNode();
  const iconed = await ask(W.node.base, 'app.icon', { key: 'agent', icon: '🧪' });
  return (iconed.status === 200 && stateRead('agent').icon === '🧪') || 'after app.icon: ' + short({ s: iconed.status, t: iconed.text, f: stateRead('agent') });
}, 1000);
// app.shell went (goal/G43.18, Q10): whether an app may be a shell is its <name>.json's alone; spirit/test/nodeShell.js.
test.run('the app family has no verb shell (goal/G43.18, Q10)', 0.2, function () {
  return !V.shell || 'app.shell is still a verb: ' + short(V.shell);
}, 1000);
test.run('neither writes <name>.json', 0.2, function () {
  if (W.sidecarBefore === undefined) return 'agent.json not read before: the test of app.label failed';
  return fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8') === W.sidecarBefore || 'agent.json was written';
}, 1000);
const refusesAs = async function (verb, bad) {
  if (noNode()) return noNode();
  const r = await ask(W.node.base, verb, { key: bad, icon: '🧪', label: 'x' });
  return r.status !== 200 || verb + ' took ' + JSON.stringify(bad) + ': ' + short(r.text);
};
test.run('app.icon refuses nosuchapp, no app', 0.2, function () { return refusesAs('app.icon', 'nosuchapp'); }, 1000);
test.run('app.icon refuses ../evil, a path up', 0.8, function () { return refusesAs('app.icon', '../evil'); }, 1000);
test.run('app.icon refuses an empty key', 0.2, function () { return refusesAs('app.icon', ''); }, 1000);
test.run('app.label refuses nosuchapp, no app', 0.2, function () { return refusesAs('app.label', 'nosuchapp'); }, 1000);
test.run('app.label refuses ../evil, a path up', 0.8, function () { return refusesAs('app.label', '../evil'); }, 1000);
test.run('app.label refuses an empty key', 0.2, function () { return refusesAs('app.label', ''); }, 1000);
// The box: "spirit/state/ is not servable, so a page cannot read other apps' state through a plain GET."
test.run('the file to ask for is there', 0.2, function () {
  if (noNode()) return noNode();
  return activeIn('agent') === true || 'no file to ask for';
}, 1000);
test.run('a plain GET does not hand it over', 0.8, async function () {
  if (noNode()) return noNode();
  const got = await fetch(W.node.base + '/spirit/state/agent/node.json');
  const gotText = await got.text();
  return (got.status !== 200 && gotText.indexOf('active') === -1) || 'a plain GET answered ' + got.status + ': ' + short(gotText);
}, 1000);
