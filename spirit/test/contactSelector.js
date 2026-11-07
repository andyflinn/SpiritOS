'use strict';

// apiAuth/G1.7: the contact selector, a shell element that picks a contact by label.
//   Andy: "the other dropdown selector uses in the app will be the shell-elements called contactSelector",
//   "these all will be shell-elements invisible to the user on the shell surface."
// What it asserts:
//   - spirit/element/search/contact.js defines createContactSelector and shell.js hands it to apps under
//     api.ui.elements: an element whose root carries .value (the chosen contact's KEY — identity is the key,
//     contacts.js) and fires a bubbling change; each row shows the contact's label.
//   - It finds contacts through the node's bounded search, contact.search, never a list of everybody (Andy:
//     "there are no (complete) lists, only searches"). A caller that already holds its own rows hands them in as
//     options.contacts [{ key, label }].
//   - natterDetails builds no hand-rolled contact <select>.
// STALE: shell.js hands it to apps as api.ui.elements.contactSelector (shellElements.search.contact), not as
// createContactSelector, so the first check fails; and spirit/run/shell/natterDetails/ no longer exists, so the
// last check throws reading it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.7: ';
const RUN = path.join(__dirname, '..', 'run');

test.startTest('apiAuth/G1.7: the contact selector is a shell element, found by search, replacing the hand-rolled select');

const shell = fs.readFileSync(path.join(RUN, 'spirit', 'client', 'shell.js'), 'utf8');
// The factories live in spirit/element/, one file per element (goal/G2.12, G2.14).
const elements = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'contact.js'), 'utf8');

test.subHeading('the shell defines it and hands it to apps');
const at = elements.indexOf('function createContactSelector');
const handed = /elements:\s*\{[^}]*createContactSelector:\s*shellElements\.createContactSelector/.test(shell.replace(/\n/g, ' '));
let body = '';
if (at !== -1) {
  let depth = 0;
  for (let i = elements.indexOf('{', at); i < elements.length; i++) {
    if (elements[i] === '{') depth++;
    if (elements[i] === '}') { depth--; if (depth === 0) { body = elements.slice(at, i + 1); break; } }
  }
}
if (at !== -1 && handed) test.check('spirit/element/search/contact.js defines createContactSelector and shell.js hands it to apps under api.ui.elements');
else test.fail(OWED + 'contactSelector.js: createContactSelector defined ' + (at !== -1) + ', handed under ui.elements ' + handed);

test.subHeading('it searches, carries a value and says when it changed');
if (body && /contact\.search/.test(body) && /\bvalue\b/.test(body) && /change/.test(body)) {
  test.check('it finds contacts through contact.search (the bounded search, never a list) and its root carries value and a change event');
} else test.fail(OWED + 'createContactSelector does not search contact.search with value and a change event');
if (body && /contacts/.test(body)) {
  test.check('a caller that holds its own rows hands them in (options.contacts), as natterDetails\' relay owners need');
} else test.fail(OWED + 'createContactSelector takes no caller-supplied rows, so natterDetails cannot use it');

test.subHeading('the hand-rolled select is gone');
// natterDetails' partner picker went with partnering (goal/G22.6); this asserts no hand-rolled select is there.
const natter = fs.readFileSync(path.join(RUN, 'shell', 'natterDetails', 'natterDetails.js'), 'utf8');
if (natter.indexOf('<select class="nd-partner-pick">') === -1 && !/<select\b/.test(natter)) {
  test.check('natterDetails builds no contact <select> of its own (its partner picker went with partnering, goal/G22.6)');
} else {
  test.fail(OWED + 'natterDetails: a hand-rolled select is there');
}

test.reportSuccessFailureCount();
