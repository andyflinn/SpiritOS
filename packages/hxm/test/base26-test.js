// packages/hxm/test/base26-test.js

const { numberToBase26, base26ToNumber } = require('../src/core.js');

console.log("=== Base-26 Conversion Test (z=0, a=1, ..., y=25) ===\n");

const tests = [0, 1, 2, 3, 4, 5, 6, 10, 25, 26, 27, 52, 100, 1000, 10000];

tests.forEach(n => {
  const encoded = numberToBase26(n);
  const decoded = base26ToNumber(encoded);
  const ok = decoded === n;

  console.log(`${n.toString().padStart(5)}  →  ${encoded.padEnd(6)}  →  ${decoded}   ${ok ? '✅' : '❌'}`);
});

console.log("\nTest completed.");