'use strict';
// goal/G50.1, the box: "repo://run/spirit/script.js gains its first function: spirit.requireScript()", "both in the browser
// and node.js". Required in node, and run as a page runs it (window, no module), the spirit object holds a function
// requireScript. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const file = path.join(__dirname, '..', 'script.js');
let node = false, page = false;
try { node = typeof require(file).requireScript === 'function'; } catch (e) { node = false; }
try {
  const w = {}; w.window = w;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), w);
  page = !!w.window.spirit && typeof w.window.spirit.requireScript === 'function';
} catch (e) { page = false; }
process.exit(node && page ? 0 : 1);
