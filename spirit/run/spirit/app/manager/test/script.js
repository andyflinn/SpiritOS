'use strict';

// spirit/run/spirit/app/manager/test/script.js
// The tests of spirit/app/manager/script.js and its family, and of no other module (spec: ./script.md; goal/G43.2). Andy, box: "we build a
// skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called \"app\"". Raw calls over
// http to a scratch node's door; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { scratchNode, until } = SPIRIT.requireScript('spirit/test/headLessChrome.js');
// Up here, before the first result: under the verifier testReport.js loads spirit.js for its records with the global
// put aside, and a server module required after that finds no global spirit.
const { faceRefuses } = SPIRIT.requireScript('spirit/faceHome/script.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function ask(base, call, args) {
  const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// The rows of a search that answered as every probability search does, or null.
function rows(r) { return r && r.status === 200 && r.body && Array.isArray(r.body.items) ? r.body.items : null; }
function holds(items, words) { return !!items && items.some(function (i) { return JSON.stringify(i).indexOf(words) !== -1; }); }

// What the tests share: the scratch node, the family's api and what the steps before a test found.
const W = {};
const FILE = path.join(RUN, 'spirit', 'app', 'manager', 'script.js');
const FOLDER = path.join(RUN, 'spirit', 'app');
function noNode() { return !(W.node && W.node.up); }
function scratchApp(...p) { return path.join(W.node.root, 'spirit', 'run', 'spirit', 'app', ...p); }
const stateFile = function (k) { return path.join(W.node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };
const activeIn = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')).active; } catch (e) { return undefined; } };
const stateRead = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')); } catch (e) { return {}; } };
// AN APP IS KNOWN BY ITS ID (goal/G49.19): its folder's path in dots, spirit.app.agent for spirit/app/agent; every key app.search
// answers and app.active, app.label and app.icon take is one.
const idOf = function (n) { return 'spirit.app.' + n; };
// An intrinsic app is always active (goal/G43.14), so it is no app the user set. id: the app's id, its manifest in its folder.
const intrinsicApp = function (id) { const dir = SPIRIT.slashedPath(id).split('/'); try { return JSON.parse(fs.readFileSync(path.join(W.node.root, 'spirit', 'run', ...dir, dir[dir.length - 1] + '.json'), 'utf8')).identity.intrinsic === true; } catch (e) { return false; } };

test.run('spirit/app/manager/script.js is there, the branch\'s core module', 0.2, function () { return fs.existsSync(FILE) || false; }, test.limit.quick);
test.run('spirit/app/script.js is there, as in every core branch', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'script.js')) || false; }, test.limit.quick);
test.run('spirit/app/AGENTS.md is there, as in every core branch', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'AGENTS.md')) || false; }, test.limit.quick);
test.run('spirit/app/client/script.js is there, as in every core branch', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'client', 'script.js')) || false; }, test.limit.quick);
test.run('spirit/app/search.json is there, as in every core branch', 0.2, function () { return fs.existsSync(path.join(FOLDER, 'search.json')) || false; }, test.limit.quick);

// THE ONE VERB (Andy, box: "the first verb of the app api is app.search", "no filters, just a search string").
test.run('search, active, icon and label are the branch\'s verbs, and app.shell is gone', 0.2, function () {
  let api = null;
  // The branch's interface is spirit/app/script.js since goal/G49.20.
  try { api = require(path.join(FOLDER, 'script.js')); } catch (e) { api = null; }
  const verbs = W.verbs = api && api.verbs;
  return (!!verbs && Object.keys(verbs).sort().join() === 'active,icon,label,search') || false;
}, test.limit.quick);
test.run('search takes one optional search string, q, and no filters', 0.2, function () {
  const verbs = W.verbs;
  return (!!verbs && !!verbs.search && Object.keys(verbs.search).join() === 'q' && verbs.search.q === 'text?') || false;
}, test.limit.quick);

// A PLUGIN'S DESCRIPTION (Andy, box: "containing identity:icon and identity:label").
// That <name>.json names both is a rule of every app branch, judged in ./script-sibling-general.js (branchRules) (goal/G43.32).
// THE APP JUDGED HERE IS THE TEXT EDITOR: the dummy server app these checks were written on is gone (25a95142, "delete dummy
// app"); the text editor is not intrinsic (goal/G43.17), so it starts off and takes a label of the node's, and it mounts no
// server on the node.
const SERVER = path.join(FOLDER, 'text');
let identity = null;
try { identity = JSON.parse(fs.readFileSync(path.join(SERVER, 'text.json'), 'utf8')).identity; } catch (e) { identity = null; }
const label = identity && typeof identity.label === 'string' ? identity.label : '';
const icon = identity && typeof identity.icon === 'string' ? identity.icon : '';

// A FACE CAN CALL IT (Andy, box: "and yes, a face with no star can call appSearch"; since goal/G43.18, box v29, "A face is
// whole, or there is none": the node answers a face only from a starred relay, faceStar.js, and that face calls every verb).
test.run('a face may call app.search', 0.2, function () {
  const said = faceRefuses({ call: 'spirit.app.search', args: {} });
  return said === '' || false;
}, test.limit.quick);
test.run('the same question refuses contact.faceable, so it can refuse', 0.8, function () {
  return faceRefuses({ call: 'contact.faceable', args: {} }) !== '' || false;
}, test.limit.quick);

test.run('the scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return W.node.up || false;
}, test.limit.slow);
test.after(function () {
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});

// IT GIVES THE NODE ITS API (Andy, box: "sit nicely beside all other families").
const inTree = function (name) { const b = (W.tree && W.tree.body) || {}; return !!(b[name] || (b.api && b.api[name]) || (b.families && b.families[name])); };
test.run('the node\'s api names jobs, so this question can answer', 0.2, async function () {
  if (noNode()) return false;
  W.tree = await ask(W.node.base, 'api', {});
  return inTree('job') || false;
}, test.limit.quick);
test.run('the node\'s api names the app branch beside the others', 0.2, function () {
  if (!W.tree) return false;
  // The app branch by its path since goal/G49.20, as spirit.job and spirit.fs.
  return inTree('spirit.app') || false;
}, test.limit.quick);

// THE SEARCH (Andy, box: "styled like other probability searches"; "It is JUST there to be found").
test.run('app.search answers a list, as other searches do', 0.2, async function () {
  if (noNode()) return false;
  const all = await ask(W.node.base, 'spirit.app.search', {});
  W.items = rows(all);
  return !!W.items || false;
}, test.limit.quick);
test.run('each row is a key and a label', 0.2, function () {
  const items = W.items;
  return (!!items && items.every(function (i) { return typeof i.key === 'string' && i.key && typeof i.label === 'string'; })) || false;
}, test.limit.quick);
test.run('an empty search finds the text editor by its label', 0.2, function () {
  return (!!label && holds(W.items, label)) || false;
}, test.limit.quick);
test.run('the text editor\'s row carries its icon', 0.2, function () {
  return (!!icon && holds(W.items, icon)) || false;
}, test.limit.quick);
test.run('searching its label finds it', 0.2, async function () {
  if (noNode()) return false;
  const found = await ask(W.node.base, 'spirit.app.search', { q: label });
  return (!!label && holds(rows(found), label)) || false;
}, test.limit.quick);
test.run('words that fit nothing do not find it', 0.2, async function () {
  if (noNode()) return false;
  const none = await ask(W.node.base, 'spirit.app.search', { q: 'zzqqxxvvkk' });
  return (!!rows(none) && !!label && !holds(rows(none), label)) || false;
}, test.limit.quick);
test.run('a filter is refused at the door: there are none', 0.2, async function () {
  if (noNode()) return false;
  const filter = await ask(W.node.base, 'spirit.app.search', { q: '', keep: 'yes' });
  return (filter.status >= 400 && filter.status < 500) || false;
}, test.limit.quick);

// ONLY A FOLDER WITH ITS OWN <name>/<name>.json IS A PLUGIN (Andy, G43.1 box: "the new \"default\" pattern in that module
// is: /<name>/<name>.json"), and it comes from the disk, not from a list naming server.
// The plugins are exactly the folders of spirit/app/ holding their own <name>.json, read from the disk here too, as apps move
// in one by one (goal/G43.13, G43.14); appSelector and test are not taken for apps.
test.run('the plugins are the folders with their own json: appSelector and test are not taken for apps', 0.2, function () {
  if (noNode()) return false;
  const onDisc = fs.readdirSync(scratchApp(), { withFileTypes: true }).filter(function (d) { return d.isDirectory() && fs.existsSync(scratchApp(d.name, d.name + '.json')); }).map(function (d) { return idOf(d.name); }).sort().join();
  const keys = (W.items || []).map(function (i) { return i.key; }).sort().join();
  return (keys === onDisc && keys.split(',').indexOf(idOf('appSelector')) === -1 && keys.split(',').indexOf(idOf('test')) === -1) || false;
}, test.limit.quick);
// goal/G43.6; Andy, box: "spirit.app also holds the family's verb, search, so no app may take the name of a verb."
test.run('a folder named after the branch\'s verb is no app', 0.2, async function () {
  if (noNode()) return false;
  const verbNamed = scratchApp('search');
  fs.mkdirSync(verbNamed, { recursive: true });
  fs.writeFileSync(path.join(verbNamed, 'search.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Verb Named Label' } }));
  const stands = await until(function () { return ask(W.node.base, 'spirit.app.search', {}).then(function (r) { return holds(rows(r), 'Verb Named Label'); }); }, 2500);
  fs.rmSync(verbNamed, { recursive: true, force: true });
  return !stands || false;
}, test.limit.slow);
test.run('a second folder with its own .json is found: the list follows the tree', 0.2, async function () {
  if (noNode()) return false;
  const plugin = scratchApp('zzplugin');
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'zzplugin.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Zz Plugin Label' } }));
  const seen = await until(function () { return ask(W.node.base, 'spirit.app.search', {}).then(function (r) { return holds(rows(r), 'Zz Plugin Label'); }); }, 5000);
  return seen || false;
}, test.limit.slow);
test.run('a folder without its own .json is not one', 0.2, async function () {
  if (noNode()) return false;
  fs.mkdirSync(scratchApp('zzbare'), { recursive: true });
  const bare = await ask(W.node.base, 'spirit.app.search', { q: 'zzbare' });
  return (!!rows(bare) && !holds(rows(bare), 'zzbare')) || false;
}, test.limit.quick);
// THE APP LIST COMES FROM THE COMMON FILE/FOLDER CACHE (goal/G49.2; Andy: "portion to use the common file/folder cache?",
// "fix spirit/app/manager/script.js, NOW"; G49.1's box: "the modules that scan folder data (apps, api folders, plugins) move onto
// spirit/fs/dataset/script.js one at a time", "each disc scan goes in the same commit that moves its client onto spirit/fs/dataset/script.js"). app.js's
// code, comments left out, reaches the dataset through its one entry, and scans no folder on disc any more: its readdirSync
// of spirit/app/ and its existsSync of each api.js go. A manifest's content is no row of the cache, so its read stays.
function appCode() { let t = ''; try { t = fs.readFileSync(FILE, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
test.run('spirit/app/manager/script.js reaches the file/folder cache through spirit/fs/dataset/script.js', 0.2, function () {
  return /require(?:Script)?\(\s*['"][^'"]*spirit\/fs\/dataset\/script\.js['"]\s*\)/.test(appCode()) || false;
}, test.limit.quick);
test.run('spirit/app/manager/script.js scans no folder on disc: no readdirSync and no existsSync', 0.2, function () {
  const c = appCode();
  return (c.length > 0 && !/\breaddirSync\b|\breaddir\b|\bexistsSync\b/.test(c)) || false;
}, test.limit.quick);
// AN APP ROW'S api IS THE CACHE'S FLAG (goal/G49.2, Q1: "may an app row's api become the cache's flag (api.js AND data.js),
// where today it is api.js alone?"; Andy: "sure, retrofit that where we would have put the flag in 49.1"). On the scratch
// node an app folder with its <name>.json and an api.js but no data.js has a row with api false; once data.js comes, true.
async function apiOf(key) {
  const row = (rows(await ask(W.node.base, 'spirit.app.search', { q: '' })) || []).filter(function (i) { return i.key === key; })[0];
  return row ? (parsed(row.label) || {}).api : undefined;
}
test.run('an app with api.js and no data.js has a row with api false', 0.2, async function () {
  if (noNode()) return false;
  const dir = scratchApp('zzapiflag');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'zzapiflag.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Zz Api Flag' } }));
  fs.writeFileSync(path.join(dir, 'api.js'), "'use strict';\nmodule.exports = { verbs: {} };\n");
  const listed = await until(function () { return apiOf(idOf('zzapiflag')).then(function (a) { return a !== undefined; }); }, 5000);
  return (listed && (await apiOf(idOf('zzapiflag'))) === false) || false;
}, test.limit.slow);
test.run('once its data.js comes, the same row says api true', 0.2, async function () {
  if (noNode()) return false;
  fs.writeFileSync(path.join(scratchApp('zzapiflag'), 'data.js'), "'use strict';\n");
  const flipped = await until(function () { return apiOf(idOf('zzapiflag')).then(function (a) { return a === true; }); }, 5000);
  fs.rmSync(scratchApp('zzapiflag'), { recursive: true, force: true });
  return flipped || false;
}, test.limit.slow);

// ── app.active (goal/G43.9) ──
// The box: "spirit.app gains a verb: "active"", "app.active { key, active } sets it; only the owner may."
const V = require(path.join(RUN, 'spirit', 'app', 'script.js')).verbs || {};
test.run('api.js names the verb with key and active', 0.2, function () {
  return (!!V.active && 'key' in V.active && 'active' in V.active) || false;
}, test.limit.quick);
test.run('the verb has its file, active.json', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'app', 'active.json')) || false;
}, test.limit.quick);
test.run('app.search stays "just a search string"', 0.2, function () {
  return Object.keys(V.search || {}).join() === 'q' || false;
}, test.limit.quick);
// The box: "The user sets active, so Monitor and server start off" (the server app is gone; the text editor stands for it).
// Monitor is intrinsic since Andy's 7f6ebbbe ("intrinsic flag"), so always on: the Agent, intrinsic false, is the app switched here.
test.run('neither is active before a press', 0.2, function () {
  if (noNode()) return false;
  return (activeIn('agent') !== true && activeIn('text') !== true) || false;
}, test.limit.quick);
test.run('no row but an intrinsic app\'s says active before a press', 0.2, async function () {
  if (noNode()) return false;
  const before = rows(await ask(W.node.base, 'spirit.app.search', {})) || [];
  const lit = before.filter(function (i) { return (parsed(i.label) || {}).active === true && !intrinsicApp(i.key); }).map(function (i) { return i.key; });
  return (before.length > 0 && !lit.length) || false;
}, test.limit.quick);
// The box: "The node writes spirit/state/<key>/node.json".
test.run('active true lands in spirit/state/app/agent/node.json', 0.2, async function () {
  if (noNode()) return false;
  const on = await ask(W.node.base, 'spirit.app.active', { key: idOf('agent'), active: true });
  return (on.status === 200 && activeIn('agent') === true) || false;
}, test.limit.quick);
// Andy: "on first activate, spirit/state/<name>/node.json should be initialized with the values from spirit/app/<name>/<name>.json", and on Q7: "it just holds active (boolean), icon (glyph), label(string) and shell (boolean),"
test.run('the first activate copies label and icon from <name>.json, and no shell', 0.2, function () {
  if (noNode()) return false;
  const firstState = W.firstState = stateRead('agent');
  const agentJson = JSON.parse(fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8'));
  return (firstState.label === agentJson.identity.label && firstState.icon === agentJson.identity.icon) || false;
}, test.limit.quick);
test.run('after the first activate node.json holds label, icon and active, nothing else', 0.2, function () {
  if (!W.firstState) return false;
  return Object.keys(W.firstState).sort().join() === 'active,icon,label' || false;
}, test.limit.quick);
test.run('a label the node chose first stays, and the rest is copied', 0.2, async function () {
  if (noNode()) return false;
  await ask(W.node.base, 'spirit.app.label', { key: idOf('text'), label: 'Chosen First' });
  await ask(W.node.base, 'spirit.app.active', { key: idOf('text'), active: true });
  const chosen = stateRead('text');
  await ask(W.node.base, 'spirit.app.active', { key: idOf('text'), active: false });
  return (chosen.label === 'Chosen First' && typeof chosen.icon === 'string' && chosen.icon !== '' && chosen.active === true) || false;
}, test.limit.quick);
test.run('active false lands in node.json too', 0.2, async function () {
  if (noNode()) return false;
  const off = await ask(W.node.base, 'spirit.app.active', { key: idOf('agent'), active: false });
  const verdict = (off.status === 200 && activeIn('agent') === false) || false;
  await ask(W.node.base, 'spirit.app.active', { key: idOf('agent'), active: true });
  return verdict;
}, test.limit.quick);
// ── intrinsic (goal/G43.14) ──
// The box: "intrinsic true: the app is always active", "app.active does not switch it off".
const rowFor = async function (k) { const got = rows(await ask(W.node.base, 'spirit.app.search', { q: '' })) || []; const r = got.filter(function (i) { return i.key === k; })[0]; return r ? parsed(r.label) : null; };
test.run('contact.json says intrinsic true', 0.2, function () {
  if (noNode()) return false;
  return intrinsicApp(idOf('contact')) || false;
}, test.limit.quick);
test.run('its row says active with no press, and nothing was written for it', 0.2, async function () {
  if (noNode()) return false;
  const c0 = W.c0 = await rowFor(idOf('contact'));
  return (!!c0 && c0.active === true && activeIn('contact') === undefined) || false;
}, test.limit.quick);
// goal/G43.15, the box: "an app's row carries intrinsic, the row shows no Activate/Deactivate for it, and app.active refuses an
// intrinsic app by name, writing nothing."
test.run('its row carries intrinsic true', 0.2, function () {
  return (!!W.c0 && W.c0.intrinsic === true) || false;
}, test.limit.quick);
test.run('the Agent\'s row carries intrinsic false', 0.2, async function () {
  if (noNode()) return false;
  const a0 = await rowFor(idOf('agent'));
  return (!!a0 && a0.intrinsic === false) || false;
}, test.limit.quick);
test.run('app.active on an intrinsic app is refused, by name', 0.2, async function () {
  if (noNode()) return false;
  const refused = await ask(W.node.base, 'spirit.app.active', { key: idOf('contact'), active: false });
  return (refused.status !== 200 && !!refused.body && typeof refused.body.code === 'string' && refused.body.code !== '') || false;
}, test.limit.quick);
test.run('the refused app.active writes nothing for the intrinsic app', 0.2, function () {
  if (noNode()) return false;
  return activeIn('contact') === undefined || false;
}, test.limit.quick);
test.run('app.active false does not switch it off: its row still says active', 0.2, async function () {
  if (noNode()) return false;
  const c1 = await rowFor(idOf('contact'));
  return (!!c1 && c1.active === true) || false;
}, test.limit.quick);

// The box: "A key not in spirit/app is refused, so no path can be written through it."
const refuses = async function (bad) {
  if (noNode()) return false;
  const r = await ask(W.node.base, 'spirit.app.active', { key: bad, active: true });
  return r.status !== 200 || false;
};
test.run('app.active refuses nosuchapp, no app', 0.2, function () { return refuses('nosuchapp'); }, test.limit.quick);
test.run('app.active refuses ../evil, a path up', 0.8, function () { return refuses('../evil'); }, test.limit.quick);
test.run('app.active refuses .., the folder above', 0.8, function () { return refuses('..'); }, test.limit.quick);
test.run('app.active refuses appSelector, no app', 0.2, function () { return refuses('appSelector'); }, test.limit.quick);
test.run('app.active refuses test, a test folder', 0.2, function () { return refuses('test'); }, test.limit.quick);
test.run('app.active refuses monitor/../../evil, a path out', 0.8, function () { return refuses('monitor/../../evil'); }, test.limit.quick);
test.run('app.active refuses an empty key', 0.2, function () { return refuses(''); }, test.limit.quick);
test.run('none of the refused keys wrote anything', 0.8, function () {
  if (noNode()) return false;
  const root = W.node.root;
  return (!fs.existsSync(path.join(root, 'spirit', 'run', 'spirit', 'state', 'nosuchapp')) && !fs.existsSync(path.join(root, 'spirit', 'run', 'spirit', 'evil')) && !fs.existsSync(path.join(root, 'spirit', 'run', 'evil'))) || false;
}, test.limit.quick);
// Q4: "Do a label change and allow-as-shell go in spirit/state/<name>/node.json, through two new verbs app.label and app.shell?", Andy: "yes."
test.run('app.label names key and label, and has its file', 0.2, function () {
  return (!!V.label && 'key' in V.label && 'label' in V.label && fs.existsSync(path.join(RUN, 'spirit', 'app', 'label.json'))) || false;
}, test.limit.quick);
test.run('app.label writes node.json', 0.2, async function () {
  if (noNode()) return false;
  W.sidecarBefore = fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8');
  const named = await ask(W.node.base, 'spirit.app.label', { key: idOf('agent'), label: 'Renamed Here' });
  return (named.status === 200 && stateRead('agent').label === 'Renamed Here') || false;
}, test.limit.quick);
test.run('app.label keeps what else node.json holds', 0.2, function () {
  if (noNode()) return false;
  return stateRead('agent').active === true || false;
}, test.limit.quick);
test.run('node.json overrides <name>.json: a search answers the new label', 0.2, async function () {
  if (noNode()) return false;
  return holds(rows(await ask(W.node.base, 'spirit.app.search', { q: 'Renamed Here' })), 'Renamed Here') || false;
}, test.limit.quick);
test.run('app.icon names key and icon, and has its file', 0.2, function () {
  return (!!V.icon && 'key' in V.icon && 'icon' in V.icon && fs.existsSync(path.join(RUN, 'spirit', 'app', 'icon.json'))) || false;
}, test.limit.quick);
test.run('app.icon writes node.json', 0.2, async function () {
  if (noNode()) return false;
  const iconed = await ask(W.node.base, 'spirit.app.icon', { key: idOf('agent'), icon: '🧪' });
  return (iconed.status === 200 && stateRead('agent').icon === '🧪') || false;
}, test.limit.quick);
// app.shell went (goal/G43.18, Q10): whether an app may be a shell is its <name>.json's alone; spirit/test/nodeShell.js.
test.run('the app branch has no verb shell', 0.2, function () {
  return !V.shell || false;
}, test.limit.quick);
test.run('neither app.label nor app.icon writes <name>.json', 0.2, function () {
  if (W.sidecarBefore === undefined) return false;
  return fs.readFileSync(scratchApp('agent', 'agent.json'), 'utf8') === W.sidecarBefore || false;
}, test.limit.quick);
const refusesAs = async function (verb, bad) {
  if (noNode()) return false;
  const r = await ask(W.node.base, verb, { key: bad, icon: '🧪', label: 'x' });
  return r.status !== 200 || false;
};
test.run('app.icon refuses nosuchapp, no app', 0.2, function () { return refusesAs('spirit.app.icon', 'nosuchapp'); }, test.limit.quick);
test.run('app.icon refuses ../evil, a path up', 0.8, function () { return refusesAs('spirit.app.icon', '../evil'); }, test.limit.quick);
test.run('app.icon refuses an empty key', 0.2, function () { return refusesAs('spirit.app.icon', ''); }, test.limit.quick);
test.run('app.label refuses nosuchapp, no app', 0.2, function () { return refusesAs('spirit.app.label', 'nosuchapp'); }, test.limit.quick);
test.run('app.label refuses ../evil, a path up', 0.8, function () { return refusesAs('spirit.app.label', '../evil'); }, test.limit.quick);
test.run('app.label refuses an empty key', 0.2, function () { return refusesAs('spirit.app.label', ''); }, test.limit.quick);
// The box: "spirit/state/ is not servable, so a page cannot read other apps' state through a plain GET."
test.run('the file to ask for is there', 0.2, function () {
  if (noNode()) return false;
  return activeIn('agent') === true || false;
}, test.limit.quick);
test.run('a plain GET does not hand it over', 0.8, async function () {
  if (noNode()) return false;
  const got = await fetch(W.node.base + '/spirit/state/app/agent/node.json');
  const gotText = await got.text();
  return (got.status !== 200 && gotText.indexOf('active') === -1) || false;
}, test.limit.quick);

// AN APP THAT IS RUN, NOT MOUNTED, IS NEVER SWITCHED ON (goal/G43.21; Andy: "and the node should know it, too."; moved here from
// spirit/app/app/test/element.js's nodeRun part, goal/G47.1: it judges this family's app.active). Each app of the tree whose
// <name>.json says node.run alone, publishData and pushOrigin, refused app.active, and its row stays inactive.
const RUN_ONLY = ['publishData', 'pushOrigin'];
async function nodeRefuses(key) {
  if (noNode()) return false;
  let own = null;
  try { own = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', key, key + '.json'), 'utf8')); } catch (e) { own = null; }
  if (!own || !own.node || own.node.run !== true || own.node.mount === true) return false;
  const r = await ask(W.node.base, 'spirit.app.active', { key: idOf(key), active: true });
  const row = (rows(await ask(W.node.base, 'spirit.app.search', { q: '' })) || []).filter(function (i) { return i.key === idOf(key); })[0];
  const now = row ? (parsed(row.label) || {}).active : undefined;
  return (r.status >= 400 && now !== true) || false;
}
test.run('the node refuses app.active for publishData, and it stays inactive', 0.2, function () { return nodeRefuses(RUN_ONLY[0]); }, test.limit.quick);
test.run('the node refuses app.active for pushOrigin, and it stays inactive', 0.2, function () { return nodeRefuses(RUN_ONLY[1]); }, test.limit.quick);

