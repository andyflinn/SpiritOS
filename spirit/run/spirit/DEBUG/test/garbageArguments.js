'use strict';

// spirit/run/spirit/DEBUG/test/garbageArguments.js
// The tests of spirit/DEBUG/garbageArguments.js, and of no other module (spec: ./garbageArguments.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// The worst arguments a server's api could be sent, made from what the server says about itself (goal/G41.19, G41.30).
// In process: make is handed a planted server whose api() answers a planted tree, as DEBUG.js hands it a real one.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const G = require(path.join(RUN, 'spirit', 'DEBUG', 'garbageArguments.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }

const EXTRA = 'noSuchArgumentFromDEBUG';
const KINDS = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing'];
// The bad characters the scheme names (goal/G41.30, the box: "every string argument is supplied in a few sizes, containing
// bad characters"): a NUL, a lone surrogate, control characters, a quote and a backslash, a path piece.
const BADS = [/\u0000/, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/, /[\u0001-\u001F]/, /"[\s\S]*\\|\\[\s\S]*"/, /\.\.\//];
// A planted verb of three arguments, one of each of three kinds, and one of none.
const REQ = { name: 'abc', count: 3, on: false };
const TREE = { thing: { put: { request: REQ, reply: {} }, ping: { request: {}, reply: {} } } };
const node = { kind: 'node', api: function () { return TREE; } };
const relay = { kind: 'relay', api: function () { return TREE; } };

// What the world makes, for the tests after it.
let N = null, L = null, Rl = null, put = [], ping = [];
const NO_N = 'make made nothing for the planted node: the world failed';

test.run('the world: make is asked for the planted node\'s family, spirit/app/thing/thing, and for the same as a relay', 0.2, async function () {
  N = await G.make({ module: 'spirit/app/thing/thing', ext: 'json', server: node });
  const R = await G.make({ module: 'spirit/app/thing/thing', ext: 'json', server: relay });
  try { L = JSON.parse(N.body); } catch (e) { L = null; }
  try { Rl = JSON.parse(R.body); } catch (e) { Rl = null; }
  if (!Array.isArray(L)) return 'the node\'s list: ' + short(N);
  put = L.filter(function (e) { return e.call === 'thing.put' && !e.also; }).map(function (e) { return e.args; });
  ping = L.filter(function (e) { return e.call === 'thing.ping' && !e.also; }).map(function (e) { return e.args; });
  return (put.length > 0 && ping.length > 0) || 'entries: ' + short(L);
}, test.limit.quick);

// make: what it answers
test.run('make answers JSON, typed application/json; charset=utf-8', 0.2, function () {
  if (!N) return NO_N;
  return (N.type === 'application/json; charset=utf-8' && Array.isArray(L)) || 'answered ' + short(N);
}, test.limit.quick);
test.run('make answers null for an address that is not .json', 0.2, async function () {
  const got = await G.make({ module: 'spirit/app/thing/thing', ext: 'html', server: node });
  return got === null || 'answered ' + short(got);
}, test.limit.quick);
test.run('make answers null for a server that says nothing about itself', 0.2, async function () {
  const a = await G.make({ module: 'spirit/app/thing/thing', ext: 'json', server: {} });
  const b = await G.make({ module: 'spirit/app/thing/thing', ext: 'json' });
  return (a === null && b === null) || 'answered ' + short([a, b]);
}, test.limit.quick);
test.run('the family is the module\'s name: a module of another name, with no verbs of its own in the tree, gets null', 0.2, async function () {
  const got = await G.make({ module: 'spirit/app/thing/other', ext: 'json', server: node });
  const none = await G.make({ module: 'spirit/app/x/thing', ext: 'json', server: { kind: 'node', api: function () { return { thing: {} }; } } });
  return (got === null && none === null) || 'answered ' + short([got, none]);
}, test.limit.quick);

// the door as it is: on a node { call, args }, on a relay { body: { <verb>: args } }
test.run('on a node each entry is { call: \'<family>.<verb>\', args }', 0.2, function () {
  if (!L) return NO_N;
  const bad = L.filter(function (e) { return !/^thing\.(put|ping)$/.test(e.call) || !('args' in e); });
  return !bad.length || 'not a node body: ' + short(bad.slice(0, 3));
}, test.limit.quick);
test.run('on a node each verb also gets a call naming two verbs at once', 0.2, function () {
  if (!L) return NO_N;
  const two = L.filter(function (e) { return e.also; }).map(function (e) { return e.call + '+' + e.also; }).sort();
  return JSON.stringify(two) === JSON.stringify(['thing.ping+thing.ping', 'thing.put+thing.put']) || 'two-verb calls: ' + short(two);
}, test.limit.quick);
test.run('on a relay each entry is its ask, { body: { <verb>: args } }, and none names two verbs', 0.2, function () {
  if (!Array.isArray(Rl)) return 'the relay\'s list: not JSON';
  const bad = Rl.filter(function (e) { return !e.body || Object.keys(e).length !== 1 || Object.keys(e.body).length !== 1 || ['put', 'ping'].indexOf(Object.keys(e.body)[0]) === -1; });
  return (Rl.length > 0 && !bad.length && Rl.length === L.length - 2) || 'relay entries ' + Rl.length + ' (node ' + L.length + '), bad: ' + short(bad.slice(0, 3));
}, test.limit.quick);

// the garbage scheme (goal/G41.30, the box)
test.run('a verb that takes nothing is sent a string, a number, an array and an argument it does not declare', 0.2, function () {
  if (!L) return NO_N;
  const want = JSON.stringify(['garbage', 12345, [1, 2, 3], { noSuchArgumentFromDEBUG: 1 }]);
  return JSON.stringify(ping) === want || 'ping got ' + short(ping);
}, test.limit.quick);
test.run('every argument is given every type JSON.parse makes, and missing, alone with the others as declared', 0.2, function () {
  if (!L) return NO_N;
  const keys = Object.keys(REQ);
  const miss = [];
  keys.forEach(function (k) {
    KINDS.forEach(function (x) {
      if (x === kindOf(REQ[k])) return;
      const hit = put.some(function (a) {
        if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
        const mine = x === 'missing' ? !(k in a) : (k in a) && kindOf(a[k]) === x;
        return mine && keys.every(function (o) { return o === k || (o in a && a[o] === REQ[o]); });
      });
      if (!hit) miss.push(k + ':' + x);
    });
  });
  return !miss.length || 'never alone: ' + short(miss);
}, test.limit.quick);
test.run('pairs, not every combination: any two arguments meet in every pairing of their kinds, but both as declared', 0.2, function () {
  if (!L) return NO_N;
  const keys = Object.keys(REQ);
  const seen = new Set();
  put.forEach(function (a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return;
    const k = keys.map(function (key) { return key in a ? kindOf(a[key]) : 'missing'; });
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) seen.add(i + ':' + j + ':' + k[i] + ':' + k[j]);
  });
  const miss = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (const x of KINDS) for (const y of KINDS) {
    if (x === kindOf(REQ[keys[i]]) && y === kindOf(REQ[keys[j]])) continue;
    if (!seen.has(i + ':' + j + ':' + x + ':' + y)) miss.push(keys[i] + '=' + x + ' with ' + keys[j] + '=' + y);
  }
  return !miss.length || miss.length + ' pairings never met, as ' + short(miss.slice(0, 5));
}, test.limit.quick);
test.run('pairs are fewer than every combination', 0.2, function () {
  if (!L) return NO_N;
  return put.length < Math.pow(KINDS.length, Object.keys(REQ).length) || put.length + ' entries for ' + Math.pow(KINDS.length, 3) + ' combinations';
}, test.limit.quick);
test.run('every argument as declared and one the verb does not declare: the extraneous entry is there', 0.2, function () {
  if (!L) return NO_N;
  const hit = put.some(function (a) { return a && Object.keys(a).length === 4 && a[EXTRA] === 1 && Object.keys(REQ).every(function (k) { return a[k] === REQ[k]; }); });
  return hit || 'no extraneous entry';
}, test.limit.quick);
test.run('deep nesting: an entry with every argument nested 64 deep', 0.2, function () {
  if (!L) return NO_N;
  const depth = function (v) { let n = 0; while (v && typeof v === 'object' && 'x' in v) { v = v.x; n++; } return n; };
  const hit = put.some(function (a) { return a && Object.keys(REQ).every(function (k) { return depth(a[k]) === 64; }); });
  return hit || 'no entry nested 64 deep';
}, test.limit.quick);
test.run('a string argument comes in the sizes 0, 1, 100 and 3/4 of the payload', 0.2, function () {
  if (!L) return NO_N;
  const sizes = [0, 1, 100, Math.floor(limits.PAYLOAD_MAX * 3 / 4)];
  const miss = sizes.filter(function (n) { return !put.some(function (a) { return a && a.name === 'x'.repeat(n); }); });
  return !miss.length || 'sizes never sent: ' + short(miss);
}, test.limit.quick);
test.run('a string argument comes with every bad character: a NUL, a lone surrogate, control characters, a quote and a backslash, a path piece', 0.2, function () {
  if (!L) return NO_N;
  const miss = BADS.filter(function (re) { return !put.some(function (a) { return a && typeof a.name === 'string' && re.test(a.name); }); });
  return !miss.length || 'never sent: ' + short(miss.map(String));
}, test.limit.quick);

// goal/G41.30, Andy: "fill this gap, in this item": the bad strings pass the gate and reach the handler
test.run('the bad strings and the long one go alone: every other argument as declared, nothing added', 0.2, function () {
  if (!L) return NO_N;
  const alone = function (a) { return !!a && typeof a === 'object' && !Array.isArray(a) && !(EXTRA in a) && Object.keys(a).length === 3 && a.count === REQ.count && a.on === REQ.on; };
  const bad = BADS.filter(function (re) { return !put.some(function (a) { return alone(a) && typeof a.name === 'string' && re.test(a.name); }); });
  const long = put.some(function (a) { return alone(a) && typeof a.name === 'string' && a.name.length > 1000; });
  return (!bad.length && long) || 'not alone: ' + short(bad.map(String)) + (long ? '' : ', the long string');
}, test.limit.quick);
test.run('every other entry breaks the shape: an argument of a wrong kind, left out, or one the verb does not declare', 0.2, function () {
  if (!L) return NO_N;
  const keys = Object.keys(REQ);
  const passes = put.filter(function (a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
    if (EXTRA in a) return false;
    if (!keys.every(function (k) { return k in a && kindOf(a[k]) === kindOf(REQ[k]); })) return false;
    // the shape kept: only a bad or a long string may
    return !(typeof a.name === 'string' && (a.name.length > 1000 || BADS.some(function (re) { return re.test(a.name); })));
  });
  return !passes.length || 'entries that keep the shape: ' + short(passes);
}, test.limit.quick);
test.run('no entry is the call exactly as the verb declares it', 0.2, function () {
  if (!L) return NO_N;
  return !put.some(function (a) { return JSON.stringify(a) === JSON.stringify(REQ); }) || 'the declared call itself is sent';
}, test.limit.quick);
test.run('a short plain string goes with an argument the verb does not declare', 0.2, function () {
  if (!L) return NO_N;
  const shorts = put.filter(function (a) { return a && (a.name === '' || a.name === 'x' || a.name === 'x'.repeat(100)) && a.count === REQ.count && a.on === REQ.on; });
  return (shorts.length >= 3 && shorts.every(function (a) { return a[EXTRA] === 1; })) || 'short plain strings: ' + short(shorts);
}, test.limit.quick);
