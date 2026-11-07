'use strict';

// spirit/test/plantIdentity.js
// An identity in a scratch root, made the way a node makes its own.
//
// relayAuth.js does not export ensureIdentity (goal/G22.5): it ensures the
// identity of the root it sits in on its FIRST LOAD, and nothing else may
// make one. So a suite that wants a scratch root with an identity in it
// plants the code that makes one: relayAuth.js and the two modules it
// requires (fieldRules.js, shellMove.js) are copied into <root>/spirit/,
// and requiring that copy runs its first load, which ensures
// <root>/spirit/state/identity.json (keys, seal key, the machine name) and
// keeps whatever whole identity is already there. A name, if given, is then
// set through the one public naming call, relayAuth.nameIdentity, which
// never touches a key.
//
// Planted fresh each call (the require cache dropped for that copy), so a
// second call over the same root is a second first load: a restart.

const fs = require('fs');
const path = require('path');

const RUN_JS = path.join(__dirname, '..', 'run', 'spirit');
const FILES = ['relayAuth.js', 'fieldRules.js', 'shellMove.js'];

function ensureAt(root, name) {
  const js = path.join(root, 'spirit');
  fs.mkdirSync(js, { recursive: true });
  FILES.forEach(function (f) { fs.copyFileSync(path.join(RUN_JS, f), path.join(js, f)); });
  FILES.forEach(function (f) { delete require.cache[require.resolve(path.join(js, f))]; });
  const planted = require(path.join(js, 'relayAuth.js'));
  if (name) planted.nameIdentity(root, name);
  return planted.loadIdentity(root);
}

module.exports = { ensureAt: ensureAt };
