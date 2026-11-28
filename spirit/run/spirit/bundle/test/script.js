'use strict';

// spirit/run/spirit/bundle/test/script.js
// THE TESTS OF spirit/bundle/script.js, the spirit.bundle branch, and of no other script (goal/G49.21, box v24: "the bundle table, a new
// branch", "spirit/bundle/script.js (the spirit.bundle branch, a table interface)", "spirit/bundle/client/script.js", "verbs: search,
// get, add, delete"; the auth tables as orthogonal branches of their own, spirit/auth/ "finally deleted").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const SUBJECT = path.join(RUN, 'spirit', 'bundle', 'script.js');
const TABLE = 'spirit.bundle';

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function ask(base, call, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, body: parsed(text) };
  } catch (e) { return { status: 0, body: null }; }
}

let iface = null;
test.run('spirit/bundle/script.js is there and loads', 0.2, function () {
  if (!fs.existsSync(SUBJECT)) return false;
  try { iface = require(SUBJECT); } catch (e) { iface = null; }
  return (!!iface && typeof iface === 'object') || false;
}, test.limit.quick);
test.run('spirit/bundle/client/script.js is there', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'bundle', 'client', 'script.js')) || false;
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
  try { if (node.root) SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* scratch */ }
});
test.run('a scratch node comes up, and its api is read', 0.2, async function () {
  W.node = await scratchNode();
  if (!W.node.up) return false;
  W.tree = (await ask(W.node.base, 'api', {})).body;
  return (!!W.tree && typeof W.tree === 'object') || false;
}, test.limit.slow);
test.run('the node serves spirit.bundle with its four verbs', 0.2, function () {
  const b = W.tree && W.tree[TABLE];
  return (!!b && ['add', 'delete', 'get', 'search'].every(function (v) { return !!b[v]; })) || false;
}, test.limit.quick);
test.run('the node serves no auth branch any more', 0.2, function () {
  return (!!W.tree && !W.tree.auth && !W.tree['spirit.auth']) || false;
}, test.limit.quick);
