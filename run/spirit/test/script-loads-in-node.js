'use strict';
// goal/G50.1, the box: "repo://run/spirit/script.js", which the server requires. It loads in a node process without throwing.
// Exit 0 green, 1 red.
const path = require('path');
try { require(path.join(__dirname, '..', 'script.js')); } catch (e) { process.exit(1); }
process.exit(0);
