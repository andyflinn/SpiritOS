'use strict';
// goal/G50.1; Andy: "in the browser, /spirit/script.js will create an empty global object window.spirit", and "no spirit.name
// nothing, no bells, no whistles." Run as a page runs it, with window and no module, script.js leaves window.spirit an
// object with no keys of its own. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let ok = false;
try {
  const page = {};
  page.window = page;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), page);
  const s = page.window.spirit;
  ok = !!s && typeof s === 'object' && Object.getOwnPropertyNames(s).length === 0 && Object.getOwnPropertySymbols(s).length === 0;
} catch (e) { ok = false; }
process.exit(ok ? 0 : 1);
