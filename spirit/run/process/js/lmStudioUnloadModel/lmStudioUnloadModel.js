const { exec } = require('child_process');
const spirit = require('../../../js/kernel.js');

// Promise-wrapped, non-blocking — see lmStudioLoadModel.js for why: a
// synchronous execSync call here would freeze this process's event loop for
// the whole operation, which caused a real, reproducible ECONNRESET on this
// script's own stdio pipe to its parent in this nested-spawn context.
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

  await spirit.core.jobs.log('unloading ' + model + '...');
  await execAsync('lms unload "' + model + '"', { timeout: 60000 });
  await spirit.core.jobs.log('Completed: ' + model + ' unloaded');
  await spirit.core.jobs.complete({ model: model });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
