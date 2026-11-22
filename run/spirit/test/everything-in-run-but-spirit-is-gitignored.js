'use strict';
// goal/G50.1, the box: "we make sure that everything inside repo:/run/ is gitignored except repo:/run/spirit/". git counts a
// file and a folder in repo://run/ ignored, and a file in repo://run/spirit/ not. Exit 0 green, 1 red.
const path = require('path');
const { spawnSync } = require('child_process');
const repo = path.join(__dirname, '..', '..', '..');
function ignored(p) { return spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: repo }).status === 0; }
const ok = ignored('run/zzSomeFile.js') && ignored('run/zzSomeFolder/x.js') && !ignored('run/spirit/zzSomeFile.js') && !ignored('run/spirit/test/files/zz.js');
process.exit(ok ? 0 : 1);
