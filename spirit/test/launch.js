// packages/hxm/client/cli-local.js
// working

spirit = require('../kernel.js');

spirit.core.call.instantiateTypeName.call(spirit,"tuple","testobject");
spirit.core.call.instantiateTableType.call(spirit.value.testobject,"tuples","tuple");
spirit.core.call.instantiateTypeName.call(spirit,"integer","testnumber");

let json = JSON.stringify(spirit,null,2);

console.log(json);
