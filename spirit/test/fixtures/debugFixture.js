'use strict';

// Spawned by debugSwitch.js as a real app server. Its one verb prints through the kernel's print(),
// which writes only while this process's DEBUG is on.
const spirit = require('../../run/js/kernel.js');
const appServer = require('../../run/js/appServer.js');

appServer.serve({
  ping: { request: {}, reply: { pong: '' }, handler: function () { spirit.core.util.print('pinged'); return { pong: 'yes' }; } },
});
