// packages/hxm/src/types/registry.js

const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy";

const HXM_DEFAULT_FLAGS = { readonly: false, immutable: false, serveronly: false, nopersist: false }; 
const HXM_CORE_FLAGS = { readonly: true, immutable: false, serveronly: false, nopersist: true }; 

const coreTypes = {
  
  // === Primitive Types ===
  // All primitive values are wrapped in an object
  // with _type and value properties for consistency and extensibility
  
  "boolean": {
    parenttype: null,
    name: "boolean",
    default: () => ({ _type: "boolean", value: false }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "number": {
    parenttype: null,
    name: "number",
    default: () => ({ _type: "number", value: 0 }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "string": {
    parenttype: null,
    name: "string",
    default: () => ({ _type: "string", value: "" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

"integer": {
    parenttype: "number",
    name: "integer",
    default: () => ({ _type: "integer", value: 0 }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "float": {
    parenttype: "number",
    name: "float",
    default: () => ({ _type: "float", value: 0.0 }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "name": {
    parenttype: "string",
    name: "name",
    default: () => ({ _type: "name", value: "" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  // === Container Types ===
  "object": {
    parenttype: null,
    name: "object",
    default: () => ({ _type: "object" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "field": {
    parenttype: "object",
    name: "field",
    members: {
      "name": { "type": "name", "required": true },
      "type": { "type": "name", "required": true }
    },
    default: () => ({ _type: "field" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  // === Transforms ===
  "transform": {
    parenttype: "object",
    name: "transform",
    default: () => ({ _type: "transform" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  "create": {
    parenttype: "transform",
    name: "create",
    default: () => ({ _type: "create" }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },

  // === List ===
  "list": {
    parenttype: "object",
    name: "list",
    default: () => ({
      _type: "list",
      length: 0,
      _lastIndex: null
    }),
    _flags: HXM_CORE_FLAGS,
    _type: "type",
  },
  _flags: HXM_CORE_FLAGS,
  _type: "object",
};

// Protect core types from accidental modification
Object.freeze(coreTypes);

module.exports = {
  coreTypes,

  /** Get a core type definition by name */
  getType: (typeName) => {
    return coreTypes[typeName] || null;
  },

  /** Check if a type is a core type */
  isCoreType: (typeName) => {
    return !!coreTypes[typeName];
  },

  numberToBase26,
  base26ToNumber
};

// Base-26 helpers (z=0, a=1, ..., y=25)
function numberToBase26(n) {
  if (n < 0) return null;
  if (n === 0) return "z";

  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = BASE26_DIGITS[remainder + 1] + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

function base26ToNumber(str) {
  if (!/^[a-z]+$/.test(str)) return null;

  let num = 0;
  for (let char of str) {
    const digit = BASE26_DIGITS.indexOf(char);
    if (digit === -1) return null;
    num = num * 26 + digit;
  }
  return num;
}