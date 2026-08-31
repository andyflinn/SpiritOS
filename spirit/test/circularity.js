'use strict';

/**
 * Scans an object graph, records every visited object + its dot‑notation path,
 * and tells you whether a circular reference exists.
 *
 * @param {Object} rootObject  the value to start walking from
 * @returns {{
 *   visited: Array<{obj: Object, path: string}>,
 *   hasCircular: boolean
 * }}  an object containing the full registry and a flag that is true
 *      if a circular reference was detected.
 */
function checkCircularity(rootObject) {
  const seenMap = new WeakMap();                 // object → first‑seen path
  const registry = [];                           // [{obj, path}, …]
  let circularFound = false;                     // will become true on first cycle

  const makePath = (parentPath, key) =>
    parentPath ? `${parentPath}.${key}` : `rootObject${key ? `.${key}` : ''}`;

  function walk(value, currentPath) {
    // Primitive values cannot be part of a cycle.
    if (value === null || typeof value !== 'object') return false;

    // ----- a)  Have we already seen THIS exact object? -----
    if (seenMap.has(value)) {
      const originalPath = seenMap.get(value);
      console.log('Circular reference detected!');
      console.log(`  → currentPath : ${currentPath}`);
      console.log(`  → originalPath: ${originalPath}`);

      circularFound = true;          // remember that a cycle exists
      return true;                    // stop the walk – we only need the *first* one
    }

    // ----- b)  First time we encounter this object – remember it -----
    seenMap.set(value, currentPath);
    registry.push({ obj: value, path: currentPath });

    // ----- c)  Recurse into children (arrays or plain objects) -----
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const childPath = makePath(currentPath, `[${i}]`);
        if (walk(value[i], childPath)) return true;   // propagate stop‑signal
      }
    } else {
      for (const key of Object.keys(value)) {
        const childPath = makePath(currentPath, key);
        if (walk(value[key], childPath)) return true;
      }
    }

    return false;   // no circular reference found in this branch
  }

  // ----- start the traversal -----
  walk(rootObject, 'rootObject');

  // ----- return both the registry and the flag -----
  return {
    visited: registry,
    hasCircular: circularFound
  };
}

/* -------------------------------------------------------------
   Example usage
const a = { name: 'A' };
const b = { name: 'B', child: a };
a.sibling = b;               // creates a circular reference (a → b → a)

const result = checkCircularity(a);

console.log('\n--- Result summary ---');
console.log('Was a circular reference found?', result.hasCircular); // true
console.log('Number of distinct objects visited:', result.visited.length);
   ------------------------------------------------------------- */

const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

test.startTest('testing if the spirit object has circular')
let result = checkCircularity(spirit);

if (!result.hasCircular)
{
  test.check('the spirit object has no circular reference! Yay!');
} else {
  test.fail('the spirit object has at least one circula reference! see above.');
}

test.reportSuccessFailureCount();