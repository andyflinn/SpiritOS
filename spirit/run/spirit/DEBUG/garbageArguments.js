// spirit/run/spirit/DEBUG/garbageArguments.js
// THE WORST ARGUMENTS A SERVER'S API COULD BE SENT (goal/G41.19, ../test/DEBUG.md). Andy: "from the introspections, it
// will generate the most garbage arguments, that could be thrown at the api, and check the responses.", "it can do that
// for any version of a relay as well".
//
// Made from what the server says about itself: its api tree, { <family>: { <verb>: { request, reply } } }, the request a
// prototype of the arguments (each key's value of its type). The family is the module's name: /DEBUG/process/js/
// fileServer/fileServer/garbageArguments.json is the file server's. Each entry is a body for that server's door as it
// is: on a node { call: '<family>.<verb>', args }, on a relay its ask, { body: { <verb>: args } }.
//
// ONLY GARBAGE THE CHECK MUST REFUSE, never arguments a handler could act on: some verbs delete or rotate a key, and an
// argument left out may be an optional one. So no key is only left out; every entry breaks the shape itself.
'use strict';

const DEPTH = 64;

// A value of the wrong type for a key whose prototype is v.
function wrongFor(v) {
  if (typeof v === 'string') return 12345;
  if (typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v)) return 'garbage';
  return 12345;
}
function deep(n) { let o = 'x'; for (let i = 0; i < n; i++) o = { x: o }; return o; }

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
  if (keys.length) {
    const wrong = {}; keys.forEach(function (k) { wrong[k] = wrongFor(request[k]); }); out.push(wrong);
    const nested = {}; keys.forEach(function (k) { nested[k] = typeof request[k] === 'object' && request[k] !== null && !Array.isArray(request[k]) ? 'garbage' : deep(DEPTH); }); out.push(nested);
    const extra = {}; keys.forEach(function (k) { extra[k] = wrongFor(request[k]); }); extra.noSuchArgumentFromDEBUG = 1; out.push(extra);
  }
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
