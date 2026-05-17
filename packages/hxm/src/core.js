// packages/hxm/src/core.js

/**
 * hxm Core - Human × Machine lowest protocol layer
 */

function isValidHxmName(key) {
  return /^[a-z]+$/.test(key);
}

function validateDocument(doc) {
  if (typeof doc !== 'object' || doc === null) {
    console.warn("[hxm] Document must be an object");
    return false;
  }

  for (const key in doc) {
    if (!isValidHxmName(key)) {
      console.warn(`[hxm] Invalid key: "${key}" — must be lowercase a-z only`);
      return false;
    }
  }
  return true;
}

/**
 * Apply transform with special rule: null = delete key
 */
function applyTransform(current, request) {
  if (typeof current !== 'object' || current === null) current = {};

  const result = { ...current };

  for (const key in request) {
    if (!isValidHxmName(key)) continue;

    const value = request[key];

    if (value === null) {
      delete result[key];                    // DELETE
    } else if (typeof value === 'object' && value !== null) {
      // Recursive merge for nested objects
      result[key] = applyTransform(result[key], value);
    } else {
      result[key] = value;                   // Normal set
    }
  }

  return result;
}

module.exports = {
  isValidHxmName,
  validateDocument,
  applyTransform
};