'use strict';
// spirit/run/spirit/app/desk/: the desk server's family interface, at the top of the desk app's folder (goal/G43.27)
// THE desk SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. WRITTEN BY HAND FROM THE HANDLERS (Andy, 2026-10-22, on the generated
// first cut: "request validation worth a damn?"): an argument is required wherever the door's exact request shape or
// the handler needs it, optional only where the verb's own accepts() lets it be left out; each rule is the tightest
// that every value the handler takes still passes ('text' where '' is a real value, 'id' where it must name something,
// the field rules where the handler applies them). The server checks everything again. A verb added to the server is
// added here, in the same commit. DEBUG is appServer's, not listed here. No rule verb is served (goal/G47.4, box v36).
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../../spirit.js').require('spirit/app/desk/data.js'); else window.spirit.require('spirit/app/desk/data.js');
module.exports = {
  verbs: {
    // Only listening or working; the server refuses any other word.
    'agent.state': { word: 'spirit.type.string.agentWord' },
    block: { id: 'id', blocks: 'id' },
    'block.targets': { id: 'id' },
    'box.release': { id: 'id' },
    'box.take': { id: 'id' },
    // An empty box is a box: text may be ''.
    'box.write': { id: 'id', text: 'text', version: 'spirit.type.number.integer' },
    'chat.add': { id: 'id', text: 'spirit.type.string.paragraph' },
    // Each filter left '' filters nothing; scope is '', goal or items.
    'chat.search': { id: 'id', text: 'spirit.type.string.lineSelect', by: 'text', since: 'spirit.type.number.UTC', before: 'spirit.type.number.UTC', scope: 'text' },
    // kind is C, T, G or Q; words and test may be ''.
    'check.add': { id: 'id', kind: 'spirit.type.string.checkKind', words: 'text', test: 'text' },
    // check is a check's number, or 'all' for his Grant-All.
    'check.set': { id: 'id', check: 'spirit.type.string.word', state: 'spirit.type.string.checkState' },
    // commit may be '' only for a plain item's build claim.
    claim: { id: 'id', phase: 'spirit.type.string.phase', commit: 'text' },
    // The handler trims and refuses an empty title; it applies no label rule to a goal's.
    'goal.add': { title: 'spirit.type.string.description' },
    // The title passes the label rule (fieldWhy); blocks may be left out or '' (the goal).
    'item.add': { goal: 'id', title: 'spirit.type.string.label', blocks: 'text?' },
    'item.box': { id: 'id' },
    'item.chat': { id: 'id' },
    'item.checks': { id: 'id' },
    // goal/G33.7: each table's search, one component (desk.js tableSearch), ranked by text, bounded, more.
    'item.checks.search': { id: 'id', text: 'spirit.type.string.lineSelect' },
    'item.claims.search': { id: 'id', text: 'spirit.type.string.lineSelect' },
    'item.files.search': { id: 'id', text: 'spirit.type.string.lineSelect' },
    'item.delete': { id: 'id' },
    // under '' keeps every path; the door's shape needs it sent.
    'item.files': { id: 'id', under: 'text?' },
    // One row a write (goal/G40.3): one path; no '..'. A path already there (add) or not there (remove) is refused,
    // naming it. goal/G41.11, for the desk only: item.files.add takes
    // path or paths, a list in JSON (goal/G48.4, Q6), cut at one answer (the server answers added and more).
    'item.files.add': { id: 'id', path: 'spirit.type.string.file?', paths: 'spirit.type.string.json?' },
    'item.files.remove': { id: 'id', path: 'spirit.type.string.file' },
    'item.get': { id: 'id' },
    'item.release': { id: 'id' },
    'item.rename': { id: 'id', title: 'spirit.type.string.label' },
    // tone (goal/G33.11): test or code, the deskClient's file report; '' or left out for a plain status word. Missing
    // here, the spirit object refused every report before it left (found on goal/G40.3).
    'item.status': { id: 'id', word: 'text', tone: 'spirit.type.string.statusTone?' },
    'item.take': { id: 'id' },
    'agents.search': { text: 'spirit.type.string.lineSelect' },
    'items.search': { text: 'spirit.type.string.lineSelect', currentGoalOnly: 'spirit.type.boolean', goalsOnly: 'spirit.type.boolean', includeClosed: 'spirit.type.boolean' },
    'line.take': { id: 'id' },
    // pass and why only for a verify; red and build send neither.
    'phase.done': { id: 'id', phase: 'spirit.type.string.phase', pass: 'spirit.type.boolean?', why: 'text?' },
    'phase.may': { id: 'id' },
    'phase.take': { id: 'id', phase: 'spirit.type.string.phase' },
    // id is '' for start-design with nothing open, which starts a new goal.
    press: { id: 'text', what: 'spirit.type.string.deskPress' },
    // goal/G41.22: Andy's alone; the current goal, so no argument.
    // agent '' is the caller.
    'profile.get': { agent: 'text' },
    // His alone. A name or nick left '' is no name or no nick; a name otherwise passes the label rule.
    // owner (goal/G47.5, Q7): the desk owner mark, changed by the owner on his node's loopback alone.
    'profile.set': { agent: 'spirit.type.string.IDNew', name: 'name', nick: 'text', included: 'spirit.type.boolean?', cap: 'spirit.type.boolean?', owner: 'spirit.type.boolean?' },
    // goal/G33.7: seen per item, the arrival time of the newest thing he looked at under it.
    'seen.get': { id: 'id' },
    'seen.set': { id: 'id', at: 'spirit.type.number.UTC' },
    signoff: {},
    // goal/G33.8: appServer's streamPublisher (spirit/appServer.js): the caller's key subscribes to the desk's rows, sent to
    // its family of that name; unsubscribe stops it. Who may is the node's grant.
    // run and since (goal/G41.12): the subscriber's position, the run of the desk and the number of the last row it took
    // in it; the desk's log hands what came after, or the desk pushes in full.
    subscribe: { family: 'spirit.type.string.word', run: 'text?', since: 'spirit.type.number.integer?' },
    unsubscribe: {},
    unblock: { id: 'id', blocks: 'id' },
    // The jobs open to the caller; it takes nothing.
    'work.open': {},
  },
};
