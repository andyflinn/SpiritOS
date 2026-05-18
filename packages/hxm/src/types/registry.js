// packages/hxm/src/types/registry.js

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

  // === Container Types ===
  "object": {
    parenttype: null,
    name: "object",
    members: {},
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
  },

  "nametype": {
    parenttype: "object",
    name: "nametype",
    members: {
        name: { type: "name", required: true },
        type: { type: "name", required: true }
    },
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
  },

  "transform": {
    parenttype: "object",
    name: "transform",
    members: {
        input: { type: "object", required: true },
    },
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
  },

 "createmember": {
    parenttype: "transform",
    name: "createmember",
    members: {
        input: { type: "nametype", required: true },
    },
    default: () => ({ _type: "object" }),
    flags: { readonly: false }
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