'use strict';
// run/spirit/testicle/run/all/script.js              node spirit/testicle/run/all/script.js   (from repo://run/)
// EVERYTHING (goal/G50.1, box v24): the classifier, then the node side, then the browser side, each its own process, as
// run/classify, run/node and run/browser are run by hand. Exit 0 when every side is green.
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = require('../../script.js').RUN;
let worst = 0;
['classify', 'node', 'browser'].forEach(function (step) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', step, 'script.js')], { cwd: RUN, stdio: 'inherit' });
  if (r.status !== 0) worst = 1;
});
process.exit(worst);
