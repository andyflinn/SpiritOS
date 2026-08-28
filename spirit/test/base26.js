// packages/hxm/test/base26-test.js
'use strict';

let spirit = require('../kernel.js');



console.log("=== Base-26 Conversion Test (z=0, a=1, ..., y=25...Number.MAX_SAFE_INTEGER) ===\n");

const tests = [0, 1, 2, 3, 4, 5, 6, 10, 25, 26, 27, 52, 100, 1000, 10000,26**4,26**5,26**6,Number.MAX_SAFE_INTEGER];

tests.forEach(n => {
  const encoded = spirit.core.util.numberToBase26(n);
  const decoded = spirit.core.util.base26ToNumber(encoded);
  const ok = decoded === n;

  console.log(`${n.toString().padStart(5)}  →  ${encoded.padEnd(6)}  →  ${decoded}   ${ok ? '✅' : '❌'}`);
});

console.log("\nTest completed.");