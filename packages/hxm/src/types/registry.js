// packages/hxm/src/types/registry.js

const coreTypes = {
  // === Primitive Types ===
  "boolean": {
    name: "boolean",
    default: () => ({ _type: "boolean", value: false }),
    flags: { readonly: false }
  },

  "integer": {
    name: "integer",
    default: () => ({ _type: "integer", value: 0 }),
    flags: { readonly: false }
  },

  "float": {
    name: "float",
    default: () => ({ _type: "float", value: 0.0 }),
    flags: { readonly: false }
  },

  "string": {
    name: "string",
    default: () => ({ _type: "string", value: "" }),
    flags: { readonly: false }
  },

  "name": {
    name: "name",
    default: () => ({ _type: "name", value: "" }),
    flags: { readonly: false }
  },

  // === Container Types ===
  "object": {
    name: "object",
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
  },

  "list": {
    name: "list",
    default: () => ({
      _type: "list",
      length: 0,
      _lastIndex: null
    }),
    flags: { readonly: false }
  }
};

// Protect the core types from accidental modification
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
  }
};