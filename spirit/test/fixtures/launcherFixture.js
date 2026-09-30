'use strict';

// Spawned by oneLauncher.js as a real process, one-shot or server. It reports what it was given, then waits
// until its node goes away (or exits at once in 'once' mode).
const fs = require('fs');
const spirit = require('../../run/js/kernel.js');

const args = JSON.parse(process.argv[2] || '{}');
if (args.pidFile) fs.writeFileSync(args.pidFile, String(process.pid));

spirit.core.jobs.report({ data: {
  sawJobId: process.env.SPIRIT_JOB_ID || '',
  sawCallback: process.env.SPIRIT_CALLBACK_URL || '',
  hasIpc: typeof process.send === 'function',
} }).then(function () {
  if (args.mode === 'once') process.exit(args.code || 0);
}, function () {
  if (args.mode === 'once') process.exit(args.code || 0);
});
setInterval(function () {}, 1000);
