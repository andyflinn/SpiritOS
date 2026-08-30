'use strict';

/**
 * Scan an object tree, remember every object (or array) together with the
 * “dot‑notation” path at which it was found, and stop as soon as a circular
 * reference is discovered.
 *
 * @param {Object} rootObject  the value that starts the walk
 * @returns {Array<{obj: Object, path: string}>}  list of every visited object
 *                                               (including the root)
 *
 * The function prints the first circular reference it meets, e.g.:
 *   Circular reference detected!
 *   → currentPath : rootObject.a.b
 *   → originalPath: rootObject.c
 */
function checkCircularity(rootObject) {
  // -----------------------------------------------------------------
  // 1️⃣  Storage for everything we have seen so far
  // -----------------------------------------------------------------
  // • `seenMap`  –  WeakMap<object, string>   (fast O(1) lookup, does not
  //   prevent garbage collection)
  // • `registry` –  Array of {obj, path}     (the format you asked for)
  // -----------------------------------------------------------------
  const seenMap = new WeakMap();
  const registry = [];

  // -----------------------------------------------------------------
  // 2️⃣  Helper that builds a dot‑notation path
  // -----------------------------------------------------------------
  const makePath = (parentPath, key) =>
    parentPath ? `${parentPath}.${key}` : `rootObject${key ? `.${key}` : ''}`;

  // -----------------------------------------------------------------
  // 3️⃣  Recursive walk
  // -----------------------------------------------------------------
  function walk(value, currentPath) {
    // Only objects (including arrays) can be circular.
    if (value === null || typeof value !== 'object') return false;

    // ---------------------------------------------------------------
    // a) Have we seen *this exact object* before?
    // ---------------------------------------------------------------
    if (seenMap.has(value)) {
      const originalPath = seenMap.get(value);
      console.log('Circular reference detected!');
      console.log(`  → currentPath : ${currentPath}`);
      console.log(`  → originalPath: ${originalPath}`);
      return true; // stop walking – we only want the *first* circular ref
    }

    // ---------------------------------------------------------------
    // b) First time we encounter this object → remember it
    // ---------------------------------------------------------------
    seenMap.set(value, currentPath);
    registry.push({ obj: value, path: currentPath });

    // ---------------------------------------------------------------
    // c) Dive into its enumerable own properties (including array indices)
    // ---------------------------------------------------------------
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const childPath = makePath(currentPath, `[${i}]`);
        if (walk(value[i], childPath)) return true;
      }
    } else {
      for (const key of Object.keys(value)) {
        const childPath = makePath(currentPath, key);
        if (walk(value[key], childPath)) return true;
      }
    }

    // No circular reference found in this branch
    return false;
  }

  // -----------------------------------------------------------------
  // 4️⃣  Kick‑off the traversal
  // -----------------------------------------------------------------
  walk(rootObject, 'rootObject');

  // -----------------------------------------------------------------
  // 5️⃣  Return the full registry (as requested)
  // -----------------------------------------------------------------
  return registry;
}

/* -------------------------------------------------------------

Example usage
const a = { name: 'A' };
const b = { name: 'B', child: a };
a.sibling = b;               // <-- creates a circular reference (a → b → a)

const visited = checkCircularity(a);

console.log('\nVisited objects (path → object):');
visited.forEach(({ path }, idx) => console.log(`${idx + 1}. ${path}`));

   ------------------------------------------------------------- */

const spirit = require('../run/js/kernel');

checkCircularity(spirit);