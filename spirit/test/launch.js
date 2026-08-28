// packages/hxm/client/cli-local.js
// working

spirit = require('../kernel.js');

spirit.core.call.instantiateTypeName.call(spirit,"tuple","testobject");
spirit.core.call.instantiateTypeName.call(spirit.value.testobject,"object","testobjectagain");
spirit.core.call.instantiateTypeName.call(spirit,"integer","testnumber");

let json = JSON.stringify(spirit,null,2);

console.log(json);
