const { exec } = require('child_process');
const spirit = require('../../../js/kernel.js');

// Promise-wrapped, non-blocking — a synchronous execSync call here freezes
// this whole process's event loop for the entire load (7-13+ seconds,
// longer for large models), which caused a real, reproducible ECONNRESET on
// this script's own stdio pipe to its parent (confirmed live: the exact
// same lms load command always succeeds when run standalone, only fails
// from within this nested spawn chain when blocking synchronously).
function execAsync(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (err, stdout, stderr) => {
      if (err) { reject(err); return; }
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  const args = JSON.parse(process.argv[2] || '{}');
  const model = args.model;
  if (!model) throw new Error('model is required');

  await spirit.core.jobs.log('loading ' + model + '...');
  await execAsync('lms load "' + model + '"', { timeout: 300000 });
  await spirit.core.jobs.log('Completed: ' + model + ' loaded');
  await spirit.core.jobs.complete({ model: model });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
