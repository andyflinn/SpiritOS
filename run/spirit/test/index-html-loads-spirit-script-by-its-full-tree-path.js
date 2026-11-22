'use strict';
// goal/G50.1; Andy, of the page source: "shouldn't the script tag specify spirit/script.js, and no fudging of the namespace???".
// index.html's script tag names the spirit object by its path in the tree, spirit/script.js. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
let html = '';
try { html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'); } catch (e) { html = ''; }
process.exit(/<script[^>]*\bsrc=["']\/?spirit\/script\.js["']/i.test(html) ? 0 : 1);
