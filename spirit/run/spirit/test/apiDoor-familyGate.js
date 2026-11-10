'use strict';

// spirit/run/spirit/test/apiDoor-familyGate.js
// THE NODE'S OWN FAMILIES HAVE A GATE AT THE DOOR (goal/G41.30; Andy, of "only the spirit object checks those rules, on
// the caller's side. A raw call to /api/spirit, the attacker's way, reaches the handler unchecked": "this needs fixing in
// this item."; spirit.js says it already: "The node stays the gate and checks everything again."). Each family's
// spirit/<family>/api.js declares every verb's arguments and each one's rule. From that declaration, a raw call over
// http, no spirit object, breaks the verb's arguments three ways: an argument of the wrong type, a required one left
// out, one no verb names. Each must be refused at the door, a 4xx with a code, before the handler runs. A scratch node;
// neither Andy's nor an agent's is touched, and a handler that does run does its harm there.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..','..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const ASK_MS = 8000;
const BATCH = 10;
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }

// The node's own families: every spirit/<family>/api.js that declares verbs.
function families() {
  return fs.readdirSync(path.join(RUN, 'spirit'), { withFileTypes: true }).filter(function (d) { return d.isDirectory() && fs.existsSync(path.join(RUN, 'spirit', d.name, 'api.js')); }).map(function (d) {
    let verbs = null;
    try { verbs = require(path.join(RUN, 'spirit', d.name, 'api.js')).verbs; } catch (e) { verbs = null; }
    return { name: d.name, verbs: verbs };
  }).filter(function (f) { return f.verbs && typeof f.verbs === 'object'; });
}
// A value no rule of this kind takes, on the wire (spirit.js, THE RULES).
function wrongFor(rule) {
  const r = String(rule).replace(/\?$/, '');
  if (r === 'number') return 'not a number';
  if (r === 'bool') return 'not a bool';
  if (r === 'object') return 12345;
  if (r === 'list') return 12345;
  return true; // every string rule: text, flag, name, description, paragraph, key, path, url, id
}
// A valid-looking value, so that only the argument under test is wrong.
function goodFor(rule) {
  const r = String(rule).replace(/\?$/, '');
  if (r === 'number') return 1;
  if (r === 'bool') return true;
  if (r === 'object') return {};
  if (r === 'list') return [];
  if (r === 'flag') return 'yes';
  if (r === 'url') return 'http://192.0.2.1:9/';
  if (r === 'path') return 'zz-no-such-file';
  return 'x';
}
function asksFor(fam, verb, decl) {
  const out = [];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return out;
  const keys = Object.keys(decl);
  const base = {};
  keys.forEach(function (k) { if (!/\?$/.test(String(decl[k]))) base[k] = goodFor(decl[k]); });
  keys.forEach(function (k) {
    if (typeof decl[k] !== 'string') return;
    const wrong = Object.assign({}, base); wrong[k] = wrongFor(decl[k]);
    out.push({ fam: fam, verb: verb, why: k + ' of the wrong type', args: wrong });
    if (!/\?$/.test(decl[k])) { const miss = Object.assign({}, base); delete miss[k]; out.push({ fam: fam, verb: verb, why: k + ' left out', args: miss }); }
  });
  out.push({ fam: fam, verb: verb, why: 'an argument it does not name', args: Object.assign({}, base, { zzNoSuchArgument: 1 }) });
  return out;
}

async function ask(base, a) {
  const c = new AbortController();
  const timer = setTimeout(function () { c.abort(); }, ASK_MS);
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: a.fam + '.' + a.verb, args: a.args }), signal: c.signal });
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
    return { status: r.status, code: body && body.code, text: text };
  } catch (e) { return { status: 0, text: c.signal.aborted ? 'no answer in ' + (ASK_MS / 1000) + ' s' : String(e && e.message) }; } finally { clearTimeout(timer); }
}

test.startTest('apiDoor-familyGate.js: the node\'s own families have a gate at the door (goal/G41.30)');

(async function () {
  const fams = families();
  const asks = [];
  fams.forEach(function (f) { Object.keys(f.verbs).forEach(function (v) { asksFor(f.name, v, f.verbs[v]).forEach(function (a) { asks.push(a); }); }); });
  test.comment(fams.length + ' families, ' + asks.length + ' raw calls');
  ok(fams.length > 5 && asks.length > 100, 'it reads ' + fams.length + ' families\' declarations, ' + asks.length + ' raw calls to throw', 'only ' + fams.length + ' families and ' + asks.length + ' calls: it judges nothing');
  const node = await scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const wrong = {};
    let seen = 0;
    for (let i = 0; i < asks.length; i += BATCH) {
      const batch = asks.slice(i, i + BATCH);
      const got = await Promise.all(batch.map(function (a) { return ask(node.base, a); }));
      got.forEach(function (r, j) {
        const a = batch[j]; seen += 1;
        if (!(r.status >= 400 && r.status < 500 && typeof r.code === 'string' && r.code && r.code !== 'handler-failed')) (wrong[a.fam] = wrong[a.fam] || []).push(a.verb + ': ' + a.why + ' answered ' + r.status + ' ' + short(r.text));
      });
    }
    ok(seen === asks.length, 'all ' + seen + ' calls were answered or timed', 'only ' + seen + ' of ' + asks.length + ' were thrown');
    fams.forEach(function (f) {
      const mine = asks.filter(function (a) { return a.fam === f.name; }).length;
      if (!mine) return;
      const bad = wrong[f.name] || [];
      ok(!bad.length, '/api/spirit ' + f.name + ': all ' + mine + ' broken calls refused at the door, a 4xx with a code', '/api/spirit ' + f.name + ': ' + bad.length + ' of ' + mine + ' broken calls not refused; first: ' + bad.slice(0, 3).join(' | '));
    });
    await sleep(0);
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
