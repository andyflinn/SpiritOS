// Same as startTestRelay.js, but the "buddy" fake node in normal
// (non-relay) mode on a different port — a genuinely separate second
// SpiritOS to test the relay against.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { setupRelayFakes } = require('./setupRelayFakes');

const targets = setupRelayFakes();

spawn(
  process.execPath,
  [path.join(targets.buddy, 'js', 'server.js'), '--port', '65431'],
  {
    cwd: targets.buddy,
    stdio: 'inherit',
  }
);
