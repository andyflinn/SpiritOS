'use strict';

// spirit/test/plantIdentity.js
// An identity in a scratch root, made the way a node makes its own.
//
// Since goal/G22.5 relayAuth.js does not export ensureIdentity (Andy,
// 2026-10-13): it ensures the identity of the spirit/run it sits in on its
// FIRST LOAD, and nothing else may make one. So a suite that wants a
// scratch root with an identity in it plants the code that makes one:
// relayAuth.js and the one module it requires are copied into
// <root>/js/, and requiring that copy runs its first load, which ensures
// <root>/relay-state/identity.json (keys, seal key, the machine name) and
// keeps whatever whole identity is already there. A name, if given, is then
// set through the one public naming call, relayAuth.nameIdentity, which
// never touches a key.
//
// Planted fresh each call (the require cache dropped for that copy), so a
// second call over the same root is a second first load: a restart.

const fs = require('fs');
const path = require('path');

const RUN_JS = path.join(__dirname, '..', 'run', 'js');
const FILES = ['relayAuth.js', 'fieldRules.js'];

function ensureAt(root, name) {
  const js = path.join(root, 'js');
  fs.mkdirSync(js, { recursive: true });
  FILES.forEach(function (f) { fs.copyFileSync(path.join(RUN_JS, f), path.join(js, f)); });
  FILES.forEach(function (f) { delete require.cache[require.resolve(path.join(js, f))]; });
  const planted = require(path.join(js, 'relayAuth.js'));
  if (name) planted.nameIdentity(root, name);
  return planted.loadIdentity(root);
}

module.exports = { ensureAt: ensureAt };
