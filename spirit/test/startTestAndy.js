// Personal node "andy" — isolated temp copy, normal desktop, port 65431.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { setupRelayFakes } = require('./setupRelayFakes');

const targets = setupRelayFakes();

spawn(
  process.execPath,
  [path.join(targets.andy, 'js', 'server.js'), '--port', '65431'],
  {
    cwd: targets.andy,
    stdio: 'inherit',
  }
);