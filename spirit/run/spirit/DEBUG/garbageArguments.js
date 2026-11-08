// spirit/run/spirit/DEBUG/garbageArguments.js
// THE WORST ARGUMENTS A SERVER'S API COULD BE SENT (goal/G41.19, ../test/DEBUG.md). Andy: "from the introspections, it
// will generate the most garbage arguments, that could be thrown at the api, and check the responses.", "it can do that
// for any version of a relay as well".
//
// Made from what the server says about itself: its api tree, { <family>: { <verb>: { request, reply } } }, the request a
// prototype of the arguments (each key's value of its type). The family is the module's name: /DEBUG/spirit/app/
// desk/desk/garbageArguments.json is the desk server's. Each entry is a body for that server's door as it
// is: on a node { call: '<family>.<verb>', args }, on a relay its ask, { body: { <verb>: args } }.
//
// THE SHAPE BROKEN, BUT FOR THE BAD STRINGS. Every entry breaks the shape itself (at least one argument of a wrong kind,
// left out, or one the verb does not declare), so the shared gate refuses it: an argument left out may be an optional
// one, and some verbs delete or rotate a key. The one exception is the bad strings, each alone in its own argument,
// every other argument as declared: they pass the gate on purpose and reach the verb's own handler (goal/G41.30; Andy:
// "fill this gap, in this item"). They are thrown at a throwaway scratch node only.
//
// THE GARBAGE SCHEME (goal/G41.30, the box): "every argument is filled with every type JSON.parse can make: string,
// number, boolean, null, object, array", "PLUS: \"missing\" and \"extraneous\"", "every string argument is supplied in a
// few sizes, containing bad characters", and "Pairs, not every combination": for any two arguments, every pairing of
// their kinds meets in at least one entry, each entry setting all arguments at once.
'use strict';

const limits = require('../limits.js');

const DEPTH = 64;
const EXTRA = 'noSuchArgumentFromDEBUG';
// The six types JSON.parse makes, and missing: the kinds an argument is given.
const KINDS = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing'];
const VALUE = { string: 'garbage', number: 12345, boolean: true, null: null, object: { x: 'garbage' }, array: [1, 2, 3] };
// A few sizes, up to 3/4 of the payload ("every string argument will be supplied in all sizes, at least up to 3/4 of the
// payload"), and the bad characters: a NUL, a lone surrogate, control characters, a quote and a backslash, a path piece.
const SIZES = [0, 1, 100, Math.floor(limits.PAYLOAD_MAX * 3 / 4)];
// Past this many characters a plain string is garbage by its size alone.
const LONG = 1000;
const BAD = ['nul\u0000nul', 'lone\uD800surrogate', 'ctrl\u0001\u0007\u001B\r\n\t', 'quote"back\\slash', '../../etc/passwd'];

function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
function deep(n) { let o = 'x'; for (let i = 0; i < n; i++) o = { x: o }; return o; }

// THE PAIRS: entries, each a kind per argument, so that for any two arguments every pairing of their kinds appears once
// at least, but for the one pairing of both their own types, which alone would be a call a handler may act on. Greedy:
// each entry starts from a pairing not yet met and fills the other arguments with the kind that meets the most others.
function pairs(keys, own) {
  const left = new Set();
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (const x of KINDS) for (const y of KINDS) {
    if (x === own[i] && y === own[j]) continue;
    left.add(i + ':' + j + ':' + x + ':' + y);
  }
  const rows = [];
  while (left.size) {
    const first = left.values().next().value.split(':');
    const row = new Array(keys.length).fill(null);
    row[Number(first[0])] = first[2];
    row[Number(first[1])] = first[3];
    for (let k = 0; k < keys.length; k++) {
      if (row[k] !== null) continue;
      let best = own[k];
      let bestCount = -1;
      for (const x of KINDS) {
        let count = 0;
        for (let m = 0; m < keys.length; m++) {
          if (row[m] === null || m === k) continue;
          const t = m < k ? m + ':' + k + ':' + row[m] + ':' + x : k + ':' + m + ':' + x + ':' + row[m];
          if (left.has(t)) count++;
        }
        if (count > bestCount) { best = x; bestCount = count; }
      }
      row[k] = best;
    }
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) left.delete(i + ':' + j + ':' + row[i] + ':' + row[j]);
    rows.push(row);
  }
  return rows;
}

// The garbage arguments for one verb's request prototype.
function garbageFor(request) {
  const keys = request && typeof request === 'object' && !Array.isArray(request) ? Object.keys(request) : [];
  const out = [
    'garbage',
    12345,
    [1, 2, 3],
    // a key no verb declares
    { noSuchArgumentFromDEBUG: 1 },
  ];
  if (!keys.length) return out;
  const own = keys.map(function (k) { return kindOf(request[k]); });
  // An entry of one kind per argument, 'missing' leaving the argument out. One with no argument of a wrong kind, only
  // its own or left out, could be a call a verb with optional arguments acts on ({} to a verb of one optional argument):
  // it gets an argument the verb does not declare too, so every entry still breaks the shape.
  const entry = function (row) {
    const a = {};
    keys.forEach(function (k, i) { if (row[i] !== 'missing') a[k] = row[i] === own[i] ? request[k] : VALUE[row[i]]; });
    if (row.every(function (x, i) { return x === own[i] || x === 'missing'; })) a[EXTRA] = 1;
    return a;
  };
  // Every kind for each argument alone, the others as declared (a verb of one argument has no pairs).
  keys.forEach(function (k, i) {
    KINDS.forEach(function (x) { if (x !== own[i]) { const row = own.slice(); row[i] = x; out.push(entry(row)); } });
  });
  pairs(keys, own).forEach(function (row) { out.push(entry(row)); });
  // Extraneous: every argument as declared, and one the verb does not declare.
  const extra = entry(own); extra[EXTRA] = 1; out.push(extra);
  // Deep nesting in every argument.
  const nested = {}; keys.forEach(function (k) { nested[k] = deep(DEPTH); }); out.push(nested);
  // Every string argument in its sizes and with its bad characters. The bad strings and the long one go alone: every
  // other argument as declared and nothing added, so the call passes the gate and the string is what the verb's own
  // handler meets. A short plain string ('x', a hundred x) is a real call, no garbage, so it goes with an argument the
  // verb does not declare and the gate refuses it.
  keys.forEach(function (k, i) {
    if (own[i] !== 'string') return;
    SIZES.map(function (n) { return 'x'.repeat(n); }).concat(BAD).forEach(function (s) {
      // The declared example itself is no garbage: a call exactly as the verb declares it.
      if (s === request[k]) return;
      const a = {}; keys.forEach(function (key) { a[key] = request[key]; }); a[k] = s;
      if (s.length <= LONG && BAD.indexOf(s) === -1) a[EXTRA] = 1;
      out.push(a);
    });
  });
  return out;
}

function make(o) {
  if (o.ext !== 'json' || !o.server || typeof o.server.api !== 'function') return Promise.resolve(null);
  const family = o.module.slice(o.module.lastIndexOf('/') + 1);
  return Promise.resolve(o.server.api()).then(function (tree) {
    const verbs = tree && tree[family] && typeof tree[family] === 'object' ? tree[family] : null;
    if (!verbs || !Object.keys(verbs).length) return null;
    const list = [];
    Object.keys(verbs).forEach(function (verb) {
      const request = verbs[verb] && verbs[verb].request;
      garbageFor(request).forEach(function (args) {
        if (o.server.kind === 'relay') { const body = {}; body[verb] = args; list.push({ body: body }); }
        else list.push({ call: family + '.' + verb, args: args });
      });
      // two verbs in one call, on the node's door
      if (o.server.kind !== 'relay') list.push({ call: family + '.' + verb, args: {}, also: family + '.' + verb });
    });
    return { type: 'application/json; charset=utf-8', body: JSON.stringify(list) };
  });
}

module.exports = { make: make };
