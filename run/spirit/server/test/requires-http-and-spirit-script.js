'use strict';
// goal/G50.1, the box: "server requires http and spirit/script.js". Its code, comments left out, requires both. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
let code = '';
try { code = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { code = ''; }
const http = /require\(\s*['"]http['"]\s*\)/.test(code);
const spirit = /require\(\s*[^)]*['"](\.\.\/script\.js|\.\.\/script|[^'"]*spirit\/script\.js)['"]/.test(code) || /require\(\s*path\.join\([^)]*['"]script\.js['"]/.test(code);
process.exit(http && spirit ? 0 : 1);
