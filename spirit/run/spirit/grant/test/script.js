'use strict';

// spirit/run/spirit/grant/test/script.js
// THE TESTS OF spirit/grant/script.js, the spirit.grant branch, and of no other script (goal/G49.21, box v24: "the grant table, a new
// branch", "spirit/grant/script.js (the spirit.grant branch, a table interface)", "spirit/grant/client/script.js", "verbs: search,
// get, add, delete"; the auth tables as orthogonal branches of their own, spirit/auth/ "finally deleted").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { scratchNode } = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const SUBJECT = path.join(RUN, 'spirit', 'grant', 'script.js');
const TABLE = 'spirit.grant';

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function ask(base, call, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, body: parsed(text) };
  } catch (e) { return { status: 0, body: null }; }
}

let iface = null;
test.run('spirit/grant/script.js is there and loads', 0.2, function () {
  if (!fs.existsSync(SUBJECT)) return false;
  try { iface = require(SUBJECT); } catch (e) { iface = null; }
  return (!!iface && typeof iface === 'object') || false;
}, test.limit.quick);
test.run('spirit/grant/client/script.js is there', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'grant', 'client', 'script.js')) || false;
}, test.limit.quick);
// "verbs: search, get, add, delete": exactly these, the same four on every table.
test.run('its verbs are exactly add, delete, get and search', 0.2, function () {
  const verbs = iface && iface.verbs;
  return (!!verbs && Object.keys(verbs).sort().join() === 'add,delete,get,search') || false;
}, test.limit.quick);

const W = { node: null, tree: null };
test.after(function () {
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});
test.run('a scratch node comes up, and its api is read', 0.2, async function () {
  W.node = await scratchNode();
  if (!W.node.up) return false;
  W.tree = (await ask(W.node.base, 'api', {})).body;
  return (!!W.tree && typeof W.tree === 'object') || false;
}, test.limit.slow);
test.run('the node serves spirit.grant with its four verbs', 0.2, function () {
  const b = W.tree && W.tree[TABLE];
  return (!!b && ['add', 'delete', 'get', 'search'].every(function (v) { return !!b[v]; })) || false;
}, test.limit.quick);
test.run('the node serves no auth branch any more', 0.2, function () {
  return (!!W.tree && !W.tree.auth && !W.tree['spirit.auth']) || false;
}, test.limit.quick);

// A GRANT, ADDED, FOUND AND DELETED (goal/G49.21: grant becomes spirit.grant.add, revoke spirit.grant.delete, search stays):
// a member's key given one served path, spirit.card (node.card before goal/G49.23, box v22 Part 2), found by search, then
// taken back.
const KEY = 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ=';
const PATH = 'spirit.card';
const holds = function (r) { const items = (r.body && r.body.items) || []; return items.some(function (i) { return JSON.stringify(i).indexOf(KEY) !== -1 && JSON.stringify(i).indexOf(PATH) !== -1; }); };
test.run('spirit.grant.add gives a key a served path', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  return (await ask(W.node.base, 'spirit.grant.add', { key: KEY, path: PATH })).status === 200 || false;
}, test.limit.quick);
test.run('spirit.grant.search finds that grant', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  return holds(await ask(W.node.base, 'spirit.grant.search', { text: PATH })) || false;
}, test.limit.quick);
test.run('spirit.grant.delete takes it back, and search no longer finds it', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const del = await ask(W.node.base, 'spirit.grant.delete', { key: KEY, path: PATH });
  return (del.status === 200 && !holds(await ask(W.node.base, 'spirit.grant.search', { text: PATH }))) || false;
}, test.limit.quick);
test.run('the old auth.grant is no verb of the node any more', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const r = await ask(W.node.base, 'auth.grant', { key: KEY, path: PATH });
  return (r.status >= 400 && r.status < 500) || false;
}, test.limit.quick);

// FACEABLE STAYS THE OWNER'S UNDER ITS NEW NAME (goal/G49.22, box v16: the contact branch in the new shape, "all verbs do the
// fucking same shit they did before"): a scratch node serves spirit.contact with faceable, no branch named contact, and
// refuses to grant spirit.contact.faceable to any key, as it refused contact.faceable.
test.run('the node serves spirit.contact with faceable, and no branch named contact', 0.2, function () {
  const b = W.tree && W.tree['spirit.contact'];
  return (!!b && !!b.faceable && !W.tree.contact) || false;
}, test.limit.quick);
test.run('spirit.grant.add refuses spirit.contact.faceable to a key: it stays the owner\'s', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const r = await ask(W.node.base, 'spirit.grant.add', { key: KEY, path: 'spirit.contact.faceable' });
  return (r.status >= 400 && r.status < 500 && !!r.body && r.body.code === 'owner-only') || false;
}, test.limit.quick);
