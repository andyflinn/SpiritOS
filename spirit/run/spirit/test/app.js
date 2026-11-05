'use strict';

// spirit/run/spirit/test/app.js
// The tests of spirit/app.js and its family, and of no other module (spec: ./app.md; goal/G43.2). Andy, box: "we build a
// skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called \"app\"". Raw calls over
// http to a scratch node's door; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));
// Up here, before the first result: under the verifier testReport.js loads spirit.js for its records with the global
// put aside, and a server module required after that finds no global spirit.
const { faceRefuses } = require(path.join(RUN, 'spirit', 'faceHome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('app.js: the app family, a core api beside the others (goal/G43.2)');

(async function () {
  const FILE = path.join(RUN, 'spirit', 'app.js');
  const FOLDER = path.join(RUN, 'spirit', 'app');
  ok(fs.existsSync(FILE), 'spirit/app.js is there, the family\'s core module', 'spirit/app.js is not there');
  ['api.js', 'AGENTS.md', 'data.js', 'search.json'].forEach(function (f) {
    ok(fs.existsSync(path.join(FOLDER, f)), 'spirit/app/' + f + ' is there, as in every core family', 'spirit/app/' + f + ' is not there');
  });

  // THE ONE VERB (Andy, box: "the first verb of the app api is app.search", "no filters, just a search string").
  let api = null;
  try { api = require(path.join(FOLDER, 'api.js')); } catch (e) { api = null; }
  const verbs = api && api.verbs;
  ok(!!verbs && Object.keys(verbs).sort().join() === 'active,icon,label,search,shell', 'search, active, icon, label and shell are the family\'s verbs', 'the family\'s verbs are ' + short(verbs ? Object.keys(verbs) : 'not there'));
  ok(!!verbs && !!verbs.search && Object.keys(verbs.search).join() === 'q' && verbs.search.q === 'text?', 'search takes one optional search string, q, and no filters', 'search takes ' + short(verbs && verbs.search));

  // A PLUGIN'S DESCRIPTION (Andy, box: "containing identity:icon and identity:label").
  const SERVER = path.join(FOLDER, 'server');
  let identity = null;
  try { identity = JSON.parse(fs.readFileSync(path.join(SERVER, 'server.json'), 'utf8')).identity; } catch (e) { identity = null; }
  const label = identity && typeof identity.label === 'string' ? identity.label : '';
  const icon = identity && typeof identity.icon === 'string' ? identity.icon : '';
  ok(!!label, 'server.json names identity.label: ' + label, 'server.json has no identity.label: ' + short(identity));
  ok(!!icon, 'server.json names identity.icon: ' + icon, 'server.json has no identity.icon: ' + short(identity));

  // A FACE WITH NO STAR CAN CALL IT (Andy, box: "and yes, a face with no star can call appSearch").
  const said = faceRefuses({ call: 'app.search', args: {} }, { url: 'http://r.example/', key: '', owned: false });
  ok(said === '', 'a face with no star may call app.search', 'a face with no star is refused app.search: ' + short(said));
  ok(faceRefuses({ call: 'fs.save', args: {} }, { url: 'http://r.example/', key: '', owned: false }) !== '', 'the same question refuses fs.save, so it can refuse', 'fs.save is let through as well: the check above judged nothing');

  const node = await scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }

    // IT GIVES THE NODE ITS API (Andy, box: "sit nicely beside all other families").
    const tree = await ask(node.base, 'api', {});
    const inTree = function (name) { const b = tree.body || {}; return !!(b[name] || (b.api && b.api[name]) || (b.families && b.families[name])); };
    ok(inTree('jobs'), 'the node\'s api names jobs, so this question can answer', 'the node\'s api does not name jobs: ' + short(tree.text));
    ok(inTree('app'), 'the node\'s api names the app family beside the others', 'the node\'s api does not name app');

    // THE SEARCH (Andy, box: "styled like other probability searches"; "It is JUST there to be found").
    const all = await ask(node.base, 'app.search', {});
    const items = rows(all);
    ok(!!items, 'app.search answers a list, as other searches do', 'app.search answered ' + all.status + ' ' + short(all.text));
    ok(!!items && items.every(function (i) { return typeof i.key === 'string' && i.key && typeof i.label === 'string'; }), 'each row is a key and a label', 'its rows are ' + short(items));
    ok(!!label && holds(items, label), 'an empty search finds server by its label', 'an empty search does not hold the label: ' + short(items));
    ok(!!icon && holds(items, icon), 'server\'s row carries its icon', 'server\'s row has no icon: ' + short(items));
    const found = await ask(node.base, 'app.search', { q: label });
    ok(!!label && holds(rows(found), label), 'searching its label finds it', 'searching its label answered ' + short(found.text));
    const none = await ask(node.base, 'app.search', { q: 'zzqqxxvvkk' });
    ok(!!rows(none) && !!label && !holds(rows(none), label), 'words that fit nothing do not find it', 'words that fit nothing answered ' + short(none.text));
    const filter = await ask(node.base, 'app.search', { q: '', keep: 'yes' });
    ok(filter.status >= 400 && filter.status < 500, 'a filter is refused at the door: there are none', 'a filter answered ' + filter.status + ' ' + short(filter.text));

    // ONLY A FOLDER WITH ITS OWN <name>/<name>.json IS A PLUGIN (Andy, G43.1 box: "the new \"default\" pattern in that module
    // is: /<name>/<name>.json"), and it comes from the disk, not from a list naming server.
    // The plugins are exactly the folders of spirit/app/ holding their own <name>.json, read from the disk here too, as apps move
    // in one by one (goal/G43.13, G43.14); appSelector and test are not taken for apps.
    const onDisc = fs.readdirSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app'), { withFileTypes: true }).filter(function (d) { return d.isDirectory() && fs.existsSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', d.name, d.name + '.json')); }).map(function (d) { return d.name; }).sort().join();
    const keys = (items || []).map(function (i) { return i.key; }).sort().join();
    ok(keys === onDisc && keys.split(',').indexOf('appSelector') === -1 && keys.split(',').indexOf('test') === -1, 'the plugins are the folders with their own json (' + onDisc + '): appSelector and test are not taken for apps', 'an empty search found ' + short(keys) + ', the disc holds ' + short(onDisc));
    // goal/G43.6; Andy, box: "spirit.app also holds the family's verb, search, so no app may take the name of a verb."
    const verbNamed = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'search');
    fs.mkdirSync(verbNamed, { recursive: true });
    fs.writeFileSync(path.join(verbNamed, 'search.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Verb Named Label' } }));
    const stands = await until(function () { return ask(node.base, 'app.search', {}).then(function (r) { return holds(rows(r), 'Verb Named Label'); }); }, 2500);
    ok(!stands, 'a folder named after the family\'s verb is no app', 'a folder named search was taken for an app');
    fs.rmSync(verbNamed, { recursive: true, force: true });
    const plugin = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'zzplugin');
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(path.join(plugin, 'zzplugin.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Zz Plugin Label' } }));
    const seen = await until(function () { return ask(node.base, 'app.search', {}).then(function (r) { return holds(rows(r), 'Zz Plugin Label'); }); }, 5000);
    ok(seen, 'a second folder with its own .json is found: the list is the disk', 'a second plugin on the disk is never found');
    fs.mkdirSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'zzbare'), { recursive: true });
    const bare = await ask(node.base, 'app.search', { q: 'zzbare' });
    ok(!!rows(bare) && !holds(rows(bare), 'zzbare'), 'a folder without its own .json is not one', 'a folder without its .json was found: ' + short(bare.text));

    // ── app.active (goal/G43.9) ──
    test.subHeading('the box: "spirit.app gains a verb: "active"", "app.active { key, active } sets it; only the owner may."');
    const verbs = require(path.join(RUN, 'spirit', 'app', 'api.js')).verbs || {};
    ok(!!verbs.active && 'key' in verbs.active && 'active' in verbs.active, 'api.js names the verb with key and active', 'api.js verbs: ' + short(verbs));
    ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'active.json')), 'the verb has its file, active.json', 'no spirit/app/active.json');
    ok(faceRefuses({ call: 'app.active', args: { key: 'monitor', active: true } }, { url: 'http://r.example/', key: '', owned: false }) !== '', 'a face with no star is refused it', 'a face with no star may set active');
    ok(Object.keys(verbs.search || {}).join() === 'q', 'the box: app.search stays "just a search string"', 'app.search takes: ' + short(verbs.search));
    const stateFile = function (k) { return path.join(node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };
    const activeIn = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')).active; } catch (e) { return undefined; } };
    test.subHeading('the box: "The user sets active, so Monitor and server start off"');
    // Monitor is intrinsic since Andy's 7f6ebbbe ("intrinsic flag"), so always on: the Agent, intrinsic false, is the app switched here.
    ok(activeIn('agent') !== true && activeIn('server') !== true, 'neither is active before a press', 'active before a press: ' + short([activeIn('agent'), activeIn('server')]));
    const before = rows(await ask(node.base, 'app.search', {})) || [];
    // An intrinsic app is always active (goal/G43.14), so it is no app the user set.
    const intrinsicApp = function (k) { try { return JSON.parse(fs.readFileSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', k, k + '.json'), 'utf8')).identity.intrinsic === true; } catch (e) { return false; } };
    const lit = before.filter(function (i) { return (parsed(i.label) || {}).active === true && !intrinsicApp(i.key); }).map(function (i) { return i.key; });
    ok(before.length > 0 && !lit.length, 'and no row but an intrinsic app\'s says active', before.length ? 'rows that say active before a press: ' + short(lit) : 'app.search answered no rows');
    test.subHeading('the box: "The node writes spirit/state/<key>/node.json"');
    const on = await ask(node.base, 'app.active', { key: 'agent', active: true });
    ok(on.status === 200 && activeIn('agent') === true, 'active true lands in spirit/state/agent/node.json', 'after active true: ' + short({ status: on.status, text: on.text, file: activeIn('agent') }));
    // Andy: "on first activate, spirit/state/<name>/node.json should be initialized with the values from spirit/app/<name>/<name>.json", and on Q7: "it just holds active (boolean), icon (glyph), label(string) and shell (boolean),"
    const firstState = (function () { try { return JSON.parse(fs.readFileSync(stateFile('agent'), 'utf8')); } catch (e) { return {}; } }());
    const agentJson = JSON.parse(fs.readFileSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'agent', 'agent.json'), 'utf8'));
    ok(firstState.label === agentJson.identity.label && firstState.icon === agentJson.identity.icon && firstState.shell === (agentJson.shell || {}).true, 'the first activate copies label, icon and shell from <name>.json', 'node.json after the first activate: ' + short(firstState));
    ok(Object.keys(firstState).sort().join() === 'active,icon,label,shell', 'and it holds those and active, nothing else', 'node.json holds: ' + short(Object.keys(firstState)));
    await ask(node.base, 'app.label', { key: 'server', label: 'Chosen First' });
    await ask(node.base, 'app.active', { key: 'server', active: true });
    const chosen = (function () { try { return JSON.parse(fs.readFileSync(stateFile('server'), 'utf8')); } catch (e) { return {}; } }());
    ok(chosen.label === 'Chosen First' && typeof chosen.icon === 'string' && chosen.icon !== '' && chosen.active === true, 'a label the node chose first stays, and the rest is copied', 'server\'s node.json: ' + short(chosen));
    await ask(node.base, 'app.active', { key: 'server', active: false });
    const off = await ask(node.base, 'app.active', { key: 'agent', active: false });
    ok(off.status === 200 && activeIn('agent') === false, 'active false lands there too', 'after active false: ' + short({ status: off.status, file: activeIn('agent') }));
    await ask(node.base, 'app.active', { key: 'agent', active: true });
    // ── intrinsic (goal/G43.14) ──
    test.subHeading('the box: "intrinsic true: the app is always active", "app.active does not switch it off"');
    const rowFor = async function (k) { const got = rows(await ask(node.base, 'app.search', { q: '' })) || []; const r = got.filter(function (i) { return i.key === k; })[0]; return r ? parsed(r.label) : null; };
    ok(intrinsicApp('contact'), 'the world: contact.json says intrinsic true', 'spirit/app/contact/contact.json does not say intrinsic true');
    const c0 = await rowFor('contact');
    ok(!!c0 && c0.active === true && activeIn('contact') === undefined, 'its row says active with no press, and nothing was written for it', 'its row: ' + short(c0) + ', node.json active ' + short(activeIn('contact')));
    // goal/G43.15, the box: "an app's row carries intrinsic, the row shows no Activate/Deactivate for it, and app.active refuses an
    // intrinsic app by name, writing nothing."
    ok(!!c0 && c0.intrinsic === true, 'its row carries intrinsic true', 'its row: ' + short(c0));
    const a0 = await rowFor('agent');
    ok(!!a0 && a0.intrinsic === false, 'the Agent\'s row carries intrinsic false', 'the Agent\'s row: ' + short(a0));
    const refused = await ask(node.base, 'app.active', { key: 'contact', active: false });
    ok(refused.status !== 200 && !!refused.body && typeof refused.body.code === 'string' && refused.body.code !== '', 'app.active on an intrinsic app is refused, by name', 'app.active on contact: ' + short({ status: refused.status, text: refused.text }));
    ok(activeIn('contact') === undefined, 'and nothing is written for it', 'its node.json says active ' + short(activeIn('contact')));
    const c1 = await rowFor('contact');
    ok(!!c1 && c1.active === true, 'app.active false does not switch it off: its row still says active', 'after app.active false: ' + short(c1));

    test.subHeading('the box: "A key not in spirit/app is refused, so no path can be written through it."');
    for (const bad of ['nosuchapp', '../evil', '..', 'appSelector', 'test', 'monitor/../../evil', '']) {
      const r = await ask(node.base, 'app.active', { key: bad, active: true });
      ok(r.status !== 200, 'refused: ' + JSON.stringify(bad), 'not refused: ' + JSON.stringify(bad) + ' ' + short(r.text));
    }
    ok(!fs.existsSync(path.join(node.root, 'spirit', 'run', 'spirit', 'state', 'nosuchapp')) && !fs.existsSync(path.join(node.root, 'spirit', 'run', 'spirit', 'evil')) && !fs.existsSync(path.join(node.root, 'spirit', 'run', 'evil')), 'and none of them wrote anything', 'a refused key left a file');
    test.subHeading('Q4: "Do a label change and allow-as-shell go in spirit/state/<name>/node.json, through two new verbs app.label and app.shell?", Andy: "yes."');
    ok(!!verbs.label && 'key' in verbs.label && 'label' in verbs.label && fs.existsSync(path.join(RUN, 'spirit', 'app', 'label.json')), 'app.label names key and label, and has its file', 'app.label: ' + short(verbs.label));
    ok(!!verbs.shell && 'key' in verbs.shell && 'shell' in verbs.shell && fs.existsSync(path.join(RUN, 'spirit', 'app', 'shell.json')), 'app.shell names key and shell, and has its file', 'app.shell: ' + short(verbs.shell));
    const sidecar = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'agent', 'agent.json');
    const sidecarBefore = fs.readFileSync(sidecar, 'utf8');
    const stateRead = function (k) { try { return JSON.parse(fs.readFileSync(stateFile(k), 'utf8')); } catch (e) { return {}; } };
    const named = await ask(node.base, 'app.label', { key: 'agent', label: 'Renamed Here' });
    ok(named.status === 200 && stateRead('agent').label === 'Renamed Here', 'app.label writes node.json', 'after app.label: ' + short({ s: named.status, t: named.text, f: stateRead('agent') }));
    ok(stateRead('agent').active === true, 'and keeps what else it holds', 'node.json lost active: ' + short(stateRead('agent')));
    ok(holds(rows(await ask(node.base, 'app.search', { q: 'Renamed Here' })), 'Renamed Here'), 'node.json overrides <name>.json: a search answers the new label', 'a search does not answer the new label');
    ok(!!verbs.icon && 'key' in verbs.icon && 'icon' in verbs.icon && fs.existsSync(path.join(RUN, 'spirit', 'app', 'icon.json')), 'app.icon names key and icon, and has its file', 'app.icon: ' + short(verbs.icon));
    const iconed = await ask(node.base, 'app.icon', { key: 'agent', icon: '🧪' });
    ok(iconed.status === 200 && stateRead('agent').icon === '🧪', 'app.icon writes node.json', 'after app.icon: ' + short({ s: iconed.status, t: iconed.text, f: stateRead('agent') }));
    const allowed = await ask(node.base, 'app.shell', { key: 'agent', shell: true });
    ok(allowed.status === 200 && stateRead('agent').shell === true, 'app.shell writes node.json', 'after app.shell: ' + short({ s: allowed.status, t: allowed.text, f: stateRead('agent') }));
    ok(fs.readFileSync(sidecar, 'utf8') === sidecarBefore, 'neither writes <name>.json', 'agent.json was written');
    for (const verb of ['app.icon', 'app.label', 'app.shell']) {
      ok(faceRefuses({ call: verb, args: { key: 'agent' } }, { url: 'http://r.example/', key: '', owned: false }) !== '', 'a face with no star is refused ' + verb, 'a face with no star may call ' + verb);
      for (const bad of ['nosuchapp', '../evil', '']) {
        const r = await ask(node.base, verb, { key: bad, icon: '🧪', label: 'x', shell: true });
        ok(r.status !== 200, verb + ' refuses ' + JSON.stringify(bad), verb + ' took ' + JSON.stringify(bad) + ': ' + short(r.text));
      }
    }
    test.subHeading('the box: "spirit/state/ is not servable, so a page cannot read other apps\' state through a plain GET."');
    ok(activeIn('agent') === true, 'the file to ask for is there', 'no file to ask for');
    const got = await fetch(node.base + '/spirit/state/agent/node.json');
    const gotText = await got.text();
    ok(got.status !== 200 && gotText.indexOf('active') === -1, 'a plain GET does not hand it over', 'a plain GET answered ' + got.status + ': ' + short(gotText));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
