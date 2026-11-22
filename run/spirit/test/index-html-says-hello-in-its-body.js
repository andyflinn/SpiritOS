'use strict';
// goal/G50.1, the box: "index.html prints hello in the <body>". The file's <body> holds hello. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
let html = '';
try { html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'); } catch (e) { html = ''; }
process.exit(/<body[^>]*>[\s\S]*hello[\s\S]*<\/body>/i.test(html) ? 0 : 1);
