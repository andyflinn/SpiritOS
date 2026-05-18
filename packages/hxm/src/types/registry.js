// packages/hxm/src/types/registry.js

const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy";

const coreTypes = {
  // === Primitive Types ===
  "boolean": {
    parenttype: null,
    name: "boolean",
    default: () => ({ _type: "boolean", value: false }),
    _flags: { readonly: true, immutable: true, serveronly: false, nopersist: true },
    _type: "type",
  },

  "integer": {
    parenttype: null,
    name: "integer",
    default: () => ({ _type: "integer", value: 0 }),
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
    _type: "type",
  },

  "float": {
    parenttype: null,
    name: "float",
    default: () => ({ _type: "float", value: 0.0 }),
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
    _type: "type",
  },

  "string": {
    parenttype: null,
    name: "string",
    default: () => ({ _type: "string", value: "" }),
    _flags: { readonly: false, immutable: false, serveronly: false, nopersist: false },
    _type: "type",
  },

  "name": {
    parenttype: "string",
    name: "name",
    default: () => ({ _type: "name", value: "" }),
    _flags: { readonly: false, immutable: false, serveronly: false, nopersist: false },
    _type: "type",
  },

  // === Container Types ===
  "object": {
    parenttype: null,
    name: "object",
    default: () => ({ _type: "object" }),
    _flags: { readonly: false, immutable: false, serveronly: false, nopersist: false },
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
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
    _type: "type",
  },

  // === Transforms ===
  "transform": {
    parenttype: "object",
    name: "transform",
    default: () => ({ _type: "transform" }),
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
    _type: "type",
  },

  "create": {
    parenttype: "transform",
    name: "create",
    default: () => ({ _type: "create" }),
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
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
    _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
    _type: "type",
  },
  _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true },
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