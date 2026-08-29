// packages/hxm/client/cli-local.js
// working
'use strict';

const spirit = require('../run/js/kernel');

spirit.core.call.instantiateTableType.call(spirit,"crts","create");

let json = JSON.stringify(spirit,null,2);

console.log(json);
