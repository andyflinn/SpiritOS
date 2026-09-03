// GENERATED SOURCE TEMPLATE — never hand-edit a compiled type module, edit
// the type in Type Designer instead. This file itself is never executed
// directly: Type Designer loads it as text and substitutes the two
// placeholder tokens below before writing
// app/shared/types/<Name>.compiled.js. Kept as syntactically valid JS on
// its own (placeholder *values*, not placeholder syntax) purely so it
// stays lint/check-able. IMPORTANT: this comment block must never contain
// a literal quoted copy of the SHAPE placeholder token itself — the
// substitution below is a plain (non-global) string replace and would
// match the first occurrence, wherever it is, not necessarily the real
// one on the SHAPE line.
//
// validate/createEmpty operate on the in-memory form of a record (date
// fields are real Date instances). Only serialize/deserialize cross the
// on-disk JSON boundary (Date <-> ISO string) — that's the whole reason
// this exists as a shared idiom rather than every generated app inventing
// its own date-parsing convention.
//
// One generic recursive walker, driven entirely by SHAPE (embedded data),
// not per-type generated code — SHAPE is one of: a primitive token string
// ('string'|'number'|'boolean'|'date'), a plain object (recurse into each
// key), or a single-element array (recurse into spec[0] for every item).
var __TYPE_NAME__Type = (function () {
  var SHAPE = "__SHAPE_JSON__";

  // Object.prototype.toString, not instanceof — a Date crossing a realm
  // boundary (an iframe, a Node vm sandbox in tests) fails instanceof
  // Date even though it's a real date, since instanceof compares against
  // the calling realm's own Date constructor identity.
  function isDate(value) { return Object.prototype.toString.call(value) === '[object Date]'; }

  function walkValidate(spec, value, path, errors) {
    if (Array.isArray(spec)) {
      if (!Array.isArray(value)) { errors.push(path + ': expected array'); return; }
      value.forEach(function (item, i) { walkValidate(spec[0], item, path + '[' + i + ']', errors); });
      return;
    }
    if (spec && typeof spec === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(path + ': expected object'); return; }
      Object.keys(spec).forEach(function (key) { walkValidate(spec[key], value[key], path + '.' + key, errors); });
      return;
    }
    if (spec === 'string' && typeof value !== 'string') errors.push(path + ': expected string');
    else if (spec === 'number' && typeof value !== 'number') errors.push(path + ': expected number');
    else if (spec === 'boolean' && typeof value !== 'boolean') errors.push(path + ': expected boolean');
    else if (spec === 'date' && !isDate(value) && !(typeof value === 'string' && !isNaN(Date.parse(value)))) errors.push(path + ': expected date');
  }

  function validate(obj) {
    var errors = [];
    walkValidate(SHAPE, obj, '(root)', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  function walkSerialize(spec, value) {
    if (Array.isArray(spec)) return (value || []).map(function (item) { return walkSerialize(spec[0], item); });
    if (spec && typeof spec === 'object') {
      var out = {};
      Object.keys(spec).forEach(function (key) { out[key] = walkSerialize(spec[key], value ? value[key] : undefined); });
      return out;
    }
    if (spec === 'date' && isDate(value)) return value.toISOString();
    return value;
  }

  function serialize(obj) { return walkSerialize(SHAPE, obj); }

  function walkDeserialize(spec, value) {
    if (Array.isArray(spec)) return (value || []).map(function (item) { return walkDeserialize(spec[0], item); });
    if (spec && typeof spec === 'object') {
      var out = {};
      Object.keys(spec).forEach(function (key) { out[key] = walkDeserialize(spec[key], value ? value[key] : undefined); });
      return out;
    }
    if (spec === 'date' && typeof value === 'string') return new Date(value);
    return value;
  }

  function deserialize(raw) { return walkDeserialize(SHAPE, raw); }

  function walkEmpty(spec) {
    if (Array.isArray(spec)) return [];
    if (spec && typeof spec === 'object') {
      var out = {};
      Object.keys(spec).forEach(function (key) { out[key] = walkEmpty(spec[key]); });
      return out;
    }
    if (spec === 'string') return '';
    if (spec === 'number') return 0;
    if (spec === 'boolean') return false;
    return null; // 'date' and anything unrecognized
  }

  function createEmpty() { return walkEmpty(SHAPE); }

  return { validate: validate, serialize: serialize, deserialize: deserialize, createEmpty: createEmpty };
})();
