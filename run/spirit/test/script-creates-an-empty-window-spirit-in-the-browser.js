'use strict';
// goal/G50.1; Andy: "in the browser, /spirit/script.js will create an empty global object window.spirit", and "no spirit.name
// nothing, no bells, no whistles." Since the box's next step ("script.js gains its first function: spirit.requireScript()")
// that one key is all it holds: run as a page runs it, with window and no module, script.js leaves window.spirit an object
// whose only own key is requireScript. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let ok = false;
try {
  const page = {};
  page.window = page;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), page);
  const s = page.window.spirit;
  ok = !!s && typeof s === 'object' && Object.getOwnPropertyNames(s).join() === 'requireScript' && Object.getOwnPropertySymbols(s).length === 0;
} catch (e) { ok = false; }
process.exit(ok ? 0 : 1);
