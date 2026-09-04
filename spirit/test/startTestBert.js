// Personal node "bert" — isolated temp copy, normal desktop, port 65432.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { setupRelayFakes } = require('./setupRelayFakes');

const targets = setupRelayFakes();

spawn(
  process.execPath,
  [path.join(targets.bert, 'js', 'server.js'), '--port', '65432'],
  {
    cwd: targets.bert,
    stdio: 'inherit',
  }
);