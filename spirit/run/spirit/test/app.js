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
  ['api.js', 'AGENTS.md', 'clientCacheManager.js', 'search.json'].forEach(function (f) {
    ok(fs.existsSync(path.join(FOLDER, f)), 'spirit/app/' + f + ' is there, as in every core family', 'spirit/app/' + f + ' is not there');
  });

  // THE ONE VERB (Andy, box: "the first verb of the app api is app.search", "no filters, just a search string").
  let api = null;
  try { api = require(path.join(FOLDER, 'api.js')); } catch (e) { api = null; }
  const verbs = api && api.verbs;
  ok(!!verbs && Object.keys(verbs).join() === 'search', 'search is the family\'s only verb', 'the family\'s verbs are ' + short(verbs ? Object.keys(verbs) : 'not there'));
  ok(!!verbs && !!verbs.search && Object.keys(verbs.search).join() === 'q' && verbs.search.q === 'text?', 'search takes one optional search string, q, and no filters', 'search takes ' + short(verbs && verbs.search));

  // THE ONE PLUGIN (Andy, box: "server will be blank, inactive, and only have the required file: ... server.json,
  // containing identity:icon and identity:label").
  const SERVER = path.join(FOLDER, 'server');
  let identity = null;
  try { identity = JSON.parse(fs.readFileSync(path.join(SERVER, 'server.json'), 'utf8')).identity; } catch (e) { identity = null; }
  const label = identity && typeof identity.label === 'string' ? identity.label : '';
  const icon = identity && typeof identity.icon === 'string' ? identity.icon : '';
  ok(!!label, 'server.json names identity.label: ' + label, 'server.json has no identity.label: ' + short(identity));
  ok(!!icon, 'server.json names identity.icon: ' + icon, 'server.json has no identity.icon: ' + short(identity));
  const beside = fs.existsSync(SERVER) ? fs.readdirSync(SERVER) : [];
  ok(beside.join() === 'server.json', 'server.json is the only thing in spirit/app/server/', 'spirit/app/server/ holds ' + short(beside));

  // A FACE WITH NO STAR CAN CALL IT (Andy, box: "and yes, a face with no star can call appSearch").
  const { faceRefuses } = require(path.join(RUN, 'spirit', 'faceHome.js'));
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
    ok(!!items && items.length === 1, 'server is the one plugin: appSelector and test are not taken for apps', 'an empty search found ' + short(items));
    const plugin = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'zzplugin');
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(path.join(plugin, 'zzplugin.json'), JSON.stringify({ identity: { icon: '🧩', label: 'Zz Plugin Label' } }));
    const seen = await until(function () { return ask(node.base, 'app.search', {}).then(function (r) { return holds(rows(r), 'Zz Plugin Label'); }); }, 5000);
    ok(seen, 'a second folder with its own .json is found: the list is the disk', 'a second plugin on the disk is never found');
    fs.mkdirSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'zzbare'), { recursive: true });
    const bare = await ask(node.base, 'app.search', { q: 'zzbare' });
    ok(!!rows(bare) && !holds(rows(bare), 'zzbare'), 'a folder without its own .json is not one', 'a folder without its .json was found: ' + short(bare.text));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
