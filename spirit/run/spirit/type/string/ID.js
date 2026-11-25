'use strict';
// spirit/run/spirit/type/string/ID.js
// THE TYPE spirit.type.string.ID (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): an ID, a public key (the box: "spirit/type/string/ID.js (public keys)"): an Ed25519 key in its SPKI form, base64, as every key on this network is written, always 60 characters.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.ID.
// Its test: ./test/ID.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../script.js');
(function (root) {
  var KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
  function no(why) { throw new Error(why); }
  // A KEY THIS NODE KNOWS, READ FROM DISC ON THE NODE SIDE (goal/G48.4; Andy: "the validity check for an ID must either check
  // in the browser data, or node side the shadow roll and the own ID", Q14: "Why can't the ID type not just get it from disc
  // itself?", and Q12: a new key is IDNew's): in a process of a tree that holds a node, its own key (spirit.nodeFacts.key, or
  // the public key of its identity file), a key in its shadow roll (the seen table of its node.db, opened read-only once and
  // kept); a tree with no node checks the form only. A store busy for a moment lets the key through rather than stop the
  // call. ON A PAGE, ITS CACHE (Andy: "the shadow roll is in the browser cache as soon as the contact api is loaded"): the
  // page's own node key, or a contact spirit.required.spirit.data.contact.data holds; until the contact api is loaded, the form decides.
  var knows;
  var ownOnDisc = '';
  function onPage() {
    var C = root && root.spirit && root.spirit.required.spirit.data && root.spirit.required.spirit.data.contact && root.spirit.required.spirit.data.contact.data;
    if (!C || typeof C.contact !== 'function') return null;
    return function (k) { var N = root.spirit.nodeFacts; return (N && N.key === k) || !!C.contact(k); };
  }
  function nodeKnows() {
    if (knows !== undefined) return knows;
    if (typeof module !== 'object' || !module || typeof require !== 'function' || typeof __dirname !== 'string') return onPage();
    knows = null;
    try {
      var fs = require('fs'), path = require('path');
      var state = path.join(__dirname, '..', '..', 'state');
      var dbFile = path.join(state, 'node.db');
      if (!fs.existsSync(dbFile)) return knows;
      var own = ownOnDisc = '';
      try { own = ownOnDisc = String(JSON.parse(fs.readFileSync(path.join(state, 'identity.json'), 'utf8')).publicKey || ''); } catch (e) { own = ownOnDisc = ''; }
      var db = new (require('node:sqlite').DatabaseSync)(dbFile, { readOnly: true });
      var q = db.prepare('SELECT 1 AS k FROM seen WHERE publicKey = ?');
      // A key holding a grant is one the node knows too, its row in the shadow roll or not (a grant with no label writes none).
      var g = db.prepare('SELECT 1 AS k FROM grants WHERE peer_id = ? LIMIT 1');
      knows = function (k) {
        var N = root && root.spirit && root.spirit.nodeFacts;
        if (k === own || (N && N.key === k)) return true;
        try { return !!q.get(k) || !!g.get(k); } catch (e) { return true; }
      };
    } catch (e) { knows = null; }
    return knows;
  }
  // Its limit in bytes, as every limited string's (Andy: "ALL LIMITED STRING MUST BE LIMITED BY BYTES"): a key is 60.
  var MAX_BYTES = 60;
  var T = {
    MAX_BYTES: MAX_BYTES,
    // ITS FORM, the one place it is written: IDNew takes a key of this form that nobody here knows yet.
    FORM: KEY,
    // ITS DEFAULT (goal/G48.4, the box v33: "default: \"the nodes own public key\""): spirit.nodeFacts.key, the node's own on the
    // node and the key of the node a page came from once it has answered; until then the key of all zero bytes, which passes
    // the check and is nobody's (Andy, of that first moment: fine as long as nothing sends it).
    defaultValue: function () {
      var N = root && root.spirit && root.spirit.nodeFacts;
      var own = N && typeof N.key === 'string' ? N.key : '';
      if (!KEY.test(own)) { nodeKnows(); own = ownOnDisc; }
      return KEY.test(own) ? own : 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
    },
    ruleDescription: function () { return 'an ID: a public key, MCowBQYDK2VwAyEA then 43 base64 characters and ='; },
    isValid: function (v) {
      if (typeof v !== 'string') no('an ID is a string');
      if (!KEY.test(v)) no('an ID is a public key: MCowBQYDK2VwAyEA, 43 more base64 characters, then =');
      var known = nodeKnows();
      if (known && !known(v)) no('an ID is a key this node knows: its own, or one in its shadow roll');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
