'use strict';

// Spawned by publishChecks.js as a real app server (appServer.serve, a --pipe of its own).
// argv[2] says what it publishes once it is up: 'small', 'big' or 'burst'.
const appServer = require('../../run/js/appServer.js');

const mode = process.argv[2] || 'small';
appServer.serve({
  ping: { request: {}, reply: { pong: '' }, handler: function () { return { pong: 'yes' }; } },
});

setTimeout(function () {
  if (mode === 'small') appServer.publish({ hello: 'page', n: 1 });
  if (mode === 'big') appServer.publish({ blob: 'x'.repeat(1024 * 1024) });
  if (mode === 'burst') for (let i = 0; i < 200; i++) appServer.publish({ n: i });
}, 300);
setInterval(function () {}, 1000);
