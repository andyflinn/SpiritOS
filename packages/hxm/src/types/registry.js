// packages/hxm/src/types/registry.js

const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy";

const coreTypes = {
  // === Primitive Types ===
  "boolean": {
    parenttype: null,
    name: "boolean",
    default: () => ({ _type: "boolean", value: false }),
    flags: { readonly: false }
  },

  "integer": {
    parenttype: null,
    name: "integer",
    default: () => ({ _type: "integer", value: 0 }),
    flags: { readonly: false }
  },

  "float": {
    parenttype: null,
    name: "float",
    default: () => ({ _type: "float", value: 0.0 }),
    flags: { readonly: false }
  },

  "string": {
    parenttype: null,
    name: "string",
    default: () => ({ _type: "string", value: "" }),
    flags: { readonly: false }
  },

  "name": {
    parenttype: "string",
    name: "name",
    default: () => ({ _type: "name", value: "" }),
    flags: { readonly: false }
  },

  // === Containers ===
  "object": {
    parenttype: null,
    name: "object",
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
  },

  "field": {
    parenttype: "object",
    name: "field",
    members: {
      "name": { "type": "name", "required": true },
      "type": { "type": "name", "required": true }
    },
    default: () => ({ _type: "field" }),
    flags: { readonly: false }
  },

  // === Transforms ===
  "transform": {
    parenttype: "object",
    name: "transform",
    default: () => ({ _type: "transform" }),
    flags: { readonly: true }
  },

  "create": {
    parenttype: "transform",
    name: "create",
    default: () => ({ _type: "create" }),
    flags: { readonly: true }
  },

  "list": {
    parenttype: "object",
    name: "list",
    default: () => ({
      _type: "list",
      length: 0,
      _lastIndex: null
    }),
    flags: { readonly: false }
  }
};

Object.freeze(coreTypes);

module.exports = {
  coreTypes,
  getType: (typeName) => coreTypes[typeName] || null,
  isCoreType: (typeName) => !!coreTypes[typeName],
  numberToBase26,
  base26ToNumber
};