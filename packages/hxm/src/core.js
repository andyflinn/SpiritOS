// packages/hxm/src/core.js

const { coreTypes, getType } = require('./types/registry.js');

function isValidHxmName(key) {
  return /^[a-z]+$/.test(key);
}

function createFlagSet(readonly = false, immutable = false, serveronly = false, nopersist = false) {
   return new Object({readonly: readonly, immutable: immutable, serveronly: serveronly, nopersist: nopersist});
}

/** Wrap primitive values into typed objects */
function wrapPrimitive(value, suggestedType = null) {
  if (value === null || value === undefined) {
    return { _type: "string", value: "" };
  }

  if (typeof value === 'boolean') {
    return { _type: "boolean", value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { _type: "integer", value };
    } else {
      return { _type: "float", value };
    }
  }

  if (typeof value === 'string') {
    if (/^[a-z]+$/.test(value)) {
      return { _type: "name", value };
    }
    return { _type: "string", value };
  }

  // Fallback
  return { _type: "string", value: String(value) };
}

/** Main transform function with primitive wrapping */
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

    if (value === null) {
      delete result[key];
      continue;
    }

    // Nested object
    if (typeof value === 'object' && value !== null) {
      const nestedResult = applyTransform(result[key] || {}, value, currentPath);
      if (!nestedResult.success) return nestedResult;
      result[key] = nestedResult.state;
      continue;
    }

    // Primitive value → wrap it
    result[key] = wrapPrimitive(value);
  }

  return { success: true, state: result };
}

function saveSpirit() {
  spiritState.core.info.modifiedat = new Date().toISOString();
  fs.writeFileSync(SPIRIT_FILE, JSON.stringify(spiritState, null, 2));
}

module.exports = {
  saveSpirit,
  isValidHxmName,
  createFlagSet,
  wrapPrimitive,
  applyTransform
};