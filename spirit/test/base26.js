// packages/hxm/test/base26-test.js
'use strict';

const spirit = require('../run/js/kernel');
const test = require('./testSupport.js');

test.startTest("Base-26 Conversion Test (z=0, a=1, ..., y=25...Number.MAX_SAFE_INTEGER)");
test.comment("[0, 1, 2, 3, 4, 5, 6, 10, 25, 26, 27, 52, 100, 1000, 10000,26**4,26**5,26**6,Number.MAX_SAFE_INTEGER]");
test.lineFeed();

const tests = [0, 1, 2, 3, 4, 5, 6, 10, 25, 26, 27, 52, 100, 1000, 10000,26**4,26**5,26**6,Number.MAX_SAFE_INTEGER];

let successCount = 0;
let failureCount = 0;
tests.forEach(n => {
  const encoded = spirit.core.util.numberToBase26(n);
  const decoded = spirit.core.util.base26ToNumber(encoded);
  const ok = decoded === n;

  if (ok) {
    successCount++;
  } else {
    failureCount++;
  }
  console.log(`${n.toString().padStart(5)}  →  ${encoded.padEnd(6)}  →  ${decoded}   ${ok ? '✅' : '❌'}`);
});

test.reportSuccessFailureCount(successCount, failureCount);

// generate a loop that generates 1000 random integers between 0 and Number.MAX_SAFE_INTEGER, converts them to base-26, and then back to integers, checking for correctness
test.startTest("Randomized Base-26 Conversion Test on 1000 Random Integers");  

successCount = 0;
failureCount = 0;
for (let i = 0; i < 1000; i++) {
  const randomInt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const encoded = spirit.core.util.numberToBase26(randomInt);
  const decoded = spirit.core.util.base26ToNumber(encoded);
  const ok = decoded === randomInt;

  if (ok) {
    successCount++;
  } else {
    console.log(`${randomInt.toString().padStart(5)}  →  ${encoded.padEnd(6)}  →  ${decoded}   ${ok ? '✅' : '❌'}`);
    failureCount++;
  }

}

test.reportSuccessFailureCount(successCount, failureCount);

