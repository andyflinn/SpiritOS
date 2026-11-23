'use strict';

// spirit/run/spirit/type/string/test/URL.js
// The tests of spirit/type/string/URL.js, and of no other module (spec: ./URL.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.URL: a URL, http or https.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/URL.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/URL.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "https://example.com/a", "http://127.0.0.1:45441"', 0.4, function () {
  if (!T) return false;
  try { return ['https://example.com/a', 'http://127.0.0.1:45441'].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "ftp://example.com", "example.com", "", "https://a b", 5', 0.4, function () {
  if (!T) return false;
  return ['ftp://example.com', 'example.com', '', 'https://a b', 5].every(throws) || false;
}, test.limit.quick);
// goal/G48.4, the box v33: "spirit/type/string/URL.js, default: on any face \"the pages own URL\", on a node \"the nodes
// loopback URL with port\"".
test.run('on a node its default is the node\'s loopback URL with its port, http://127.0.0.1:<port>', 0.4, function () {
  if (!T) return false;
  const S = globalThis.spirit; const was = S.nodeFacts && S.nodeFacts.port;
  S.nodeFacts = S.nodeFacts || {}; S.nodeFacts.port = 45678;
  try { return T.defaultValue() === 'http://127.0.0.1:45678' || false; } finally { S.nodeFacts.port = was; }
}, test.limit.quick);
test.run('on a page its default is the page\'s own URL', 0.4, function () {
  if (!T) return false;
  const src = fs.readFileSync(FILE, 'utf8');
  const win = { location: { href: 'https://face.example/spirit/shell/face.html' }, TextEncoder: TextEncoder, spirit: { required: {} } };
  win.window = win;
  require('vm').runInNewContext(src, win);
  const P = win.spirit.required.spirit.type.string.URL;
  return (!!P && P.defaultValue() === 'https://face.example/spirit/shell/face.html') || false;
}, test.limit.quick);
