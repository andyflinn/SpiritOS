'use strict';

// Exercises the compiled-type-module walker template (Type Designer,
// app/typeDesigner/walkerTemplate.js) — the one generic, hand-written
// validate/serialize/deserialize/createEmpty interpreter every compiled
// type module reuses, driven by embedded SHAPE data rather than per-type
// generated code. Loads the real template file as text, substitutes a
// representative SHAPE the same way Type Designer's own Save step would,
// and runs the substituted module in a sandbox to exercise it directly —
// this is the actual code every future type module reuses verbatim, so a
// bug here would affect every generated app that uses any type.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

test.startTest('Compiled type-module walker template (Type Designer)');

const TEMPLATE_PATH = path.join(__dirname, '..', 'run', 'app', 'typeDesigner', 'walkerTemplate.js');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const SHAPE = {
  name: 'string',
  age: 'number',
  active: 'boolean',
  birthday: 'date',
  tags: ['string'],
  address: { street: 'string', city: 'string' },
  contacts: [{ label: 'string', phone: 'string' }],
};

const substituted = template
  .replace(/__TYPE_NAME__/g, 'Contact')
  .replace('"__SHAPE_JSON__"', JSON.stringify(SHAPE));

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(substituted, sandbox);
const ContactType = sandbox.ContactType;

if (ContactType && typeof ContactType.validate === 'function' && typeof ContactType.serialize === 'function' &&
    typeof ContactType.deserialize === 'function' && typeof ContactType.createEmpty === 'function') {
  test.check('the substituted template evaluates to a module exposing validate/serialize/deserialize/createEmpty');
} else {
  test.fail('the substituted template did not produce a usable ContactType module: ' + JSON.stringify(ContactType));
}

// ---- validate: well-formed record passes ----
const goodRecord = {
  name: 'Jane',
  age: 30,
  active: true,
  birthday: new Date('1990-04-12'),
  tags: ['friend', 'work'],
  address: { street: '1 Main St', city: 'Springfield' },
  contacts: [{ label: 'mobile', phone: '555-1234' }],
};
const goodResult = ContactType.validate(goodRecord);
if (goodResult.ok && goodResult.errors.length === 0) {
  test.check('validate accepts a well-formed record');
} else {
  test.fail('validate should accept a well-formed record but returned ' + JSON.stringify(goodResult));
}

// ---- validate: wrong primitive type, wrong array-item type, missing nested/array-object fields ----
const badRecord = {
  name: 123, // wrong type
  age: 30,
  active: true,
  birthday: new Date(),
  tags: ['ok', 42], // wrong item type
  address: { street: '1 Main St' }, // missing city
  contacts: [{ label: 'mobile' }], // missing phone
};
const badResult = ContactType.validate(badRecord);
if (!badResult.ok && badResult.errors.length >= 4) {
  test.check('validate rejects a malformed record with one error per violation (' + badResult.errors.length + ' found)');
} else {
  test.fail('validate should have rejected the malformed record with multiple errors but returned ' + JSON.stringify(badResult));
}

// ---- serialize: Date -> ISO string, everything else passes through, including nested/array shapes ----
const serialized = ContactType.serialize(goodRecord);
if (typeof serialized.birthday === 'string' && serialized.birthday === goodRecord.birthday.toISOString()) {
  test.check('serialize converts a Date field to its ISO string');
} else {
  test.fail('serialize should have produced an ISO string for birthday but got ' + JSON.stringify(serialized.birthday));
}
if (serialized.name === 'Jane' && serialized.address.city === 'Springfield' && serialized.contacts[0].phone === '555-1234') {
  test.check('serialize passes non-date fields through unchanged, including nested objects and arrays');
} else {
  test.fail('serialize should have passed non-date fields through unchanged but got ' + JSON.stringify(serialized));
}

// ---- deserialize: ISO string -> Date instance, round-tripping the original value ----
// Object.prototype.toString, not instanceof: the Date instance was
// constructed inside the vm sandbox's own realm, so it fails instanceof
// Date against this file's Date constructor even though it's a real date
// — the same realm-crossing reason the walker template itself uses this
// check instead of instanceof.
const deserialized = ContactType.deserialize(serialized);
const deserializedIsDate = Object.prototype.toString.call(deserialized.birthday) === '[object Date]';
if (deserializedIsDate && deserialized.birthday.getTime() === goodRecord.birthday.getTime()) {
  test.check('deserialize restores a Date instance from an ISO string, round-tripping the original value');
} else {
  test.fail('deserialize should have restored a Date instance but got ' + JSON.stringify(deserialized.birthday));
}

// ---- createEmpty: correct defaults at every leaf shape ----
const empty = ContactType.createEmpty();
const emptyOk =
  empty.name === '' &&
  empty.age === 0 &&
  empty.active === false &&
  empty.birthday === null &&
  Array.isArray(empty.tags) && empty.tags.length === 0 &&
  empty.address && empty.address.street === '' && empty.address.city === '' &&
  Array.isArray(empty.contacts) && empty.contacts.length === 0;
if (emptyOk) {
  test.check('createEmpty produces correct defaults for every leaf shape (string/number/boolean/date/array/nested object)');
} else {
  test.fail('createEmpty should have produced the documented defaults but returned ' + JSON.stringify(empty));
}

test.reportSuccessFailureCount();
