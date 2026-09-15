'use strict';

// spirit/test/verbTable.js
// Who may answer what, on the one loopback client door.
//
//   Andy: "the modules handling various requests, should register then as
//   a group of interfaces to the api dispatch... no longer needs to touch
//   tedious things like matching every post type with who might handle
//   it?"
//   Andy: "claim, not register: i agree."
//
// The claims themselves are made in server.js at boot. What is under test
// here is the thing that makes claiming safer than a table: the two
// mistakes it turns into loud ones, and the one it must not.

const test = require('./testSupport.js');
const { createVerbTable } = require('../run/js/verbTable');

function threw(fn) {
  try { fn(); return ''; }
  catch (e) { return String(e.message || e); }
}

test.startTest('The verb table — a namespace is owned');

// ---------------------------------------------------------------------
test.subHeading('A module answers in its own namespace and nowhere else');
// ---------------------------------------------------------------------

{
  const table = createVerbTable();
  table.claim('fs', 'fsVerbs', {
    'fs.save': function () {},
    'fs.delete': function () {},
  }, { wire: false });

  if (table.verbs().join(',') === 'fs.delete,fs.save') {
    test.check('what was claimed is what can be asked');
  } else {
    test.fail('verbs: ' + JSON.stringify(table.verbs()));
  }

  if (typeof table.handlerFor('fs.save') === 'function') {
    test.check('and the handler that answers it is the one that claimed it');
  } else {
    test.fail('fs.save has no handler');
  }

  // NULL, NOT A REFUSAL. A table says who answers; it does not speak
  // HTTP, so what an unknown verb LOOKS like is the door's decision.
  if (table.handlerFor('fs.nope') === null && table.handlerFor('') === null) {
    test.check('an unclaimed verb has no handler, and the table says so without judging');
  } else {
    test.fail('an unclaimed verb returned something');
  }

  // THE RULE THAT KEEPS THE VERB READABLE. "Which side of this node does
  // this live on" is answerable from the verb itself — `fs.*` and
  // `jobs.*` are this machine, `peer.*` reaches the wire — and that is
  // only true if a module cannot answer outside what it claimed.
  const wrong = threw(function () {
    createVerbTable().claim('fs', 'fsVerbs', { 'peer.post': function () {} }, { wire: false });
  });
  if (/answers in its own namespace/.test(wrong)) {
    test.check('claiming fs and offering peer.post is refused, by name');
  } else {
    test.fail('out-of-namespace verb allowed: ' + JSON.stringify(wrong));
  }
}

// ---------------------------------------------------------------------
test.subHeading('Two modules cannot answer the same thing');
// ---------------------------------------------------------------------

{
  // SILENT SHADOWING IS REAL HERE, which is why this is a crash and not a
  // last-one-wins: `unknownPolicy` appeared twice in one object literal
  // in hub.js and nothing said a word about it for however long.
  const table = createVerbTable();
  table.claim('fs', 'fsVerbs', { 'fs.save': function () {} }, { wire: false });

  const clash = threw(function () {
    table.claim('fs', 'somethingElse', { 'fs.save': function () {} }, { wire: false });
  });
  if (/already claimed by fsVerbs/.test(clash)) {
    test.check('a second claim on a namespace names who holds it');
  } else {
    test.fail('collision message: ' + JSON.stringify(clash));
  }

  // The first claim is untouched — a refused claim must not half-apply,
  // or a boot that crashed would leave a table nobody can reason about.
  if (table.verbs().join(',') === 'fs.save' && table.namespaces().length === 1) {
    test.check('and the refusal changes nothing that was already claimed');
  } else {
    test.fail('after a refused claim: ' + JSON.stringify(table.verbs()));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A malformed claim is refused at boot, not at request time');
// ---------------------------------------------------------------------

{
  // THIS IS THE POINT OF CLAIMING AFTER BOOT. Every one of these throws
  // while the server is starting, where a person is watching — rather
  // than answering a request months later with something strange.
  const bad = [
    ['a namespace with a dot', function (t) { t.claim('fs.x', 'm', { 'fs.save': function () {} }); }],
    ['an empty namespace', function (t) { t.claim('', 'm', {}); }],
    ['a verb with no namespace', function (t) { t.claim('fs', 'm', { save: function () {} }, { wire: false }); }],
    ['a verb that is not a function', function (t) { t.claim('fs', 'm', { 'fs.save': 'nope' }, { wire: false }); }],
    ['claiming nothing at all', function (t) { t.claim('fs', 'm', null); }],
  ];

  let refused = 0;
  bad.forEach(function (pair) {
    const message = threw(function () { pair[1](createVerbTable()); });
    if (message) refused += 1;
    else test.fail('allowed ' + pair[0]);
  });
  if (refused === bad.length) {
    test.check('all ' + refused + ' malformed claims throw where somebody is watching');
  }
}

// ---------------------------------------------------------------------
test.subHeading('A namespace must say whether being offline can fail it');
// ---------------------------------------------------------------------

{
  //   Andy: "wire or not is the most important distingtion, wire requires
  //   that the local box be online, others who knows."
  //
  // It is the client's failure contract, not a maintainer's note — which
  // is what it was mistaken for once, in the conversation that produced
  // this. A wire verb can answer "not reachable right now" and yields a
  // hash; a local one can do neither. A caller handles those differently,
  // so it must be answerable from the verb alone.
  const silent = threw(function () {
    createVerbTable().claim('peer', 'hub.js', { 'peer.post': function () {} });
  });
  if (/must say wire/.test(silent)) {
    test.check('a claim that will not say is refused at boot');
  } else {
    test.fail('a claim with no wire flag was allowed: ' + JSON.stringify(silent));
  }

  // Not truthy-or-falsy: a claim that says `wire: 'yes'` has not answered
  // the question, it has answered a different one.
  const fuzzy = threw(function () {
    createVerbTable().claim('peer', 'hub.js', { 'peer.post': function () {} }, { wire: 'yes' });
  });
  if (/must say wire/.test(fuzzy)) {
    test.check('and so is one that answers with something other than true or false');
  } else {
    test.fail('a non-boolean wire flag was allowed');
  }

  const table = createVerbTable();
  table.claim('peer', 'hub.js', { 'peer.post': function () {} }, { wire: true });
  table.claim('contact', 'hub.js', { 'contact.block': function () {} }, { wire: false });

  // THE WHOLE POINT: a client asks the verb, not a document.
  if (table.needsWire('peer.post') === true && table.needsWire('contact.block') === false) {
    test.check('and a caller can ask any verb whether it needs the box online');
  } else {
    test.fail('needsWire: post=' + table.needsWire('peer.post') +
      ' block=' + table.needsWire('contact.block'));
  }

  // Null, not false, for something nobody claimed — "no such verb" and
  // "a verb that works offline" must not look alike.
  if (table.needsWire('nope.thing') === null) {
    test.check('an unclaimed verb answers null rather than pretending to be local');
  } else {
    test.fail('unclaimed needsWire: ' + table.needsWire('nope.thing'));
  }
}

// ---------------------------------------------------------------------
test.subHeading('The table can say what this node can do');
// ---------------------------------------------------------------------

{
  // Not used yet, and here because it is the beginning of an answer to
  // "what is this node's API" asked of the NODE rather than of a document
  // that goes stale — which is what design/andy/spiritNodeAPI.md had done
  // by three cycles this week.
  const table = createVerbTable();
  table.claim('net', 'server.js', { 'net.fetch': function () {} }, { wire: true });
  table.claim('jobs', 'jobVerbs', { 'jobs.create': function () {}, 'jobs.cancel': function () {} }, { wire: false });

  const owners = table.namespaces();
  if (owners.length === 2 && owners[0].namespace === 'jobs' && owners[0].by === 'jobVerbs') {
    test.check('every namespace names who holds it, sorted');
  } else {
    test.fail('namespaces: ' + JSON.stringify(owners));
  }

  if (table.verbs().join(',') === 'jobs.cancel,jobs.create,net.fetch') {
    test.check('and every verb this node answers can be listed without asking a document');
  } else {
    test.fail('verbs: ' + JSON.stringify(table.verbs()));
  }
}

test.reportSuccessFailureCount();
