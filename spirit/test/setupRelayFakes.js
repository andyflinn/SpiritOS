// Copies every tracked spirit/ file (test/ and anything gitignored already
// excluded, same as install/microscopic/create.js) into each fake node's
// own folder under the OS temp dir — never inside OneDrive (this repo
// lives under OneDrive\repo\SpiritOS), so the nodes here are genuinely
// separate disks, not secretly shared by cloud sync. Only ever writes
// tracked paths, so a target's own accumulated local state (relays.json,
// preferences.json, ...) is never touched on rerun — each call refreshes
// the product code, nothing else.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FAKES_ROOT = path.join(os.tmpdir(), 'spiritos-relay-fakes');
const NODE_NAMES = ['relay', 'andy', 'bert'];

function setupRelayFakes() {
  const relativePaths = execSync('git ls-files -- spirit ":!spirit/test"', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  const targets = {};
  NODE_NAMES.forEach((name) => {
    const targetRoot = path.join(FAKES_ROOT, name);
    relativePaths.forEach((relPath) => {
      const dest = path.join(targetRoot, relPath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, relPath), dest);
    });
    targets[name] = path.join(targetRoot, 'spirit', 'run');
  });
  return targets; // { relay, andy, bert } → each '.../spiritos-relay-fakes/<name>/spirit/run'
}

module.exports = { setupRelayFakes, FAKES_ROOT };

if (require.main === module) {
  const targets = setupRelayFakes();
  console.log('Relay fakes ready:');
  Object.keys(targets).forEach((name) => console.log('  ' + name + ': ' + targets[name]));
}