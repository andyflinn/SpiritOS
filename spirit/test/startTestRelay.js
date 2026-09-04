// Convenience launcher for manual testing: refreshes the "relay" fake
// node's code (see setupRelayFakes.js — a genuinely separate copy under
// the OS temp dir, not the live OneDrive-synced repo tree) and starts it
// in relay mode on a fixed port. Spawns js/server.js as a child process
// (inherited stdio, so console output and Ctrl+C behave normally) rather
// than requiring it as a module — it's written as a top-level script that
// starts listening immediately, not something designed to be imported.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { setupRelayFakes } = require('./setupRelayFakes');

const targets = setupRelayFakes();

spawn(
  process.execPath,
  [path.join(targets.relay, 'js', 'server.js'), '--port', '65430', '--relay'],
  {
    cwd: targets.relay, // verifyStartupCwd() needs this to be spirit/run itself
    stdio: 'inherit',
  }
);
