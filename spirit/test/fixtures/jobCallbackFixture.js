'use strict';

// Spawned by jobCallback.js as a real child process (same shape as any
// process/js/<name>/<name>.js script) to exercise the actual
// SPIRIT_JOB_ID / SPIRIT_CALLBACK_URL contract end-to-end, not a mock of it.
const spirit = require('../../run/js/kernel.js');

const args = JSON.parse(process.argv[2] || '{}');

async function main() {
  await spirit.core.jobs.log('fixture running');
  if (args.outcome === 'fail') {
    await spirit.core.jobs.fail(args.message || 'boom');
  } else {
    await spirit.core.jobs.complete(args.data || {});
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
