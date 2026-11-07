'use strict';

// apiAuth/G1.7: the contact selector, a shell element that picks a contact by label.
//   Andy: "the other dropdown selector uses in the app will be the shell-elements called contactSelector",
//   "these all will be shell-elements invisible to the user on the shell surface."
// What it asserts:
//   - spirit/element/search/contact.js defines createContactSelector: an element whose root carries .value (the chosen contact's KEY — identity is the key,
//     contacts.js) and fires a bubbling change; each row shows the contact's label.
//   - It finds contacts through the node's bounded search, contact.search, never a list of everybody (Andy:
//     "there are no (complete) lists, only searches"). A caller that already holds its own rows hands them in as
//     options.contacts [{ key, label }].

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.7: ';
const RUN = path.join(__dirname, '..', 'run');

test.startTest('apiAuth/G1.7: the contact selector is a shell element, found by search, replacing the hand-rolled select');

// The factories live in spirit/element/, one file per element (goal/G2.12, G2.14).
const elements = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'contact.js'), 'utf8');

const at = elements.indexOf('function createContactSelector');
let body = '';
if (at !== -1) {
  let depth = 0;
  for (let i = elements.indexOf('{', at); i < elements.length; i++) {
    if (elements[i] === '{') depth++;
    if (elements[i] === '}') { depth--; if (depth === 0) { body = elements.slice(at, i + 1); break; } }
  }
}

test.subHeading('it searches, carries a value and says when it changed');
if (body && /contact\.search/.test(body) && /\bvalue\b/.test(body) && /change/.test(body)) {
  test.check('it finds contacts through contact.search (the bounded search, never a list) and its root carries value and a change event');
} else test.fail(OWED + 'createContactSelector does not search contact.search with value and a change event');
if (body && /contacts/.test(body)) {
  test.check('a caller that holds its own rows hands them in (options.contacts), as natterDetails\' relay owners need');
} else test.fail(OWED + 'createContactSelector takes no caller-supplied rows, so natterDetails cannot use it');

test.reportSuccessFailureCount();
