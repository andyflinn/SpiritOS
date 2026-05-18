// packages/hxm/src/core.js

const { coreTypes, getType, isCoreType } = require('./types/registry.js');

function isValidHxmName(key) {
  return /^[a-z]+$/.test(key);
}

/** Main transform function - now with basic type awareness */
function applyTransform(current, request, path = '') {
  if (typeof current !== 'object' || current === null) current = {};

  const result = { ...current };

  for (const key in request) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!isValidHxmName(key)) {
      return {
        success: false,
        error: `Invalid key "${key}" at path "${currentPath}" — must be lowercase a-z only`
      };
    }

    const value = request[key];

    // Deletion
    if (value === null) {
      delete result[key];
      continue;
    }

    // Nested object / transform
    if (typeof value === 'object' && value !== null) {
      const nestedResult = applyTransform(result[key] || {}, value, currentPath);
      if (!nestedResult.success) return nestedResult;
      result[key] = nestedResult.state;
      continue;
    }

    // Simple value
    result[key] = value;
  }

  return { success: true, state: result };
}

module.exports = {
  applyTransform
};