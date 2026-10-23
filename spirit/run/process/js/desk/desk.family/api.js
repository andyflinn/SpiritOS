// spirit/run/process/js/desk/desk.family/api.js
// THE desk SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (face/spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. WRITTEN BY HAND FROM THE HANDLERS (Andy, 2026-10-22, on the generated
// first cut: "request validation worth a damn?"): an argument is required wherever the door's exact request shape or
// the handler needs it, optional only where the verb's own accepts() lets it be left out; each rule is the tightest
// that every value the handler takes still passes ('text' where '' is a real value, 'id' where it must name something,
// the field rules where the handler applies them). The server checks everything again. A verb added to the server is
// added here, in the same commit. DEBUG and DEPENDENCIES are appServer's, not listed here.
module.exports = {
  verbs: {
    // Only listening or working; the server refuses any other word.
    'agent.state': { word: 'id' },
    block: { id: 'id', blocks: 'id' },
    'block.targets': { id: 'id' },
    'box.release': { id: 'id' },
    'box.take': { id: 'id' },
    // An empty box is a box: text may be ''.
    'box.write': { id: 'id', text: 'text', version: 'number' },
    'chat.add': { id: 'id', text: 'text' },
    // Each filter left '' filters nothing; scope is '', goal or items.
    'chat.search': { id: 'id', text: 'text', by: 'text', since: 'text', before: 'text', scope: 'text' },
    // kind is C, T, G or Q; words and test may be '' (commitCheck sends test '').
    'check.add': { id: 'id', kind: 'id', words: 'text', test: 'text' },
    // check is a check's number, or 'all' for his Grant-All.
    'check.set': { id: 'id', check: 'id', state: 'id' },
    // commit may be '' only for a plain item's build claim. suites (goal/G33.4, box v44-45): the red claim's spirit/test/
    // paths, the item's suites table; a build claim takes none.
    claim: { id: 'id', phase: 'id', commit: 'text', suites: 'list?' },
    // The handler trims and refuses an empty title; it applies no label rule to a goal's.
    'goal.add': { title: 'id' },
    // The title passes the label rule (fieldWhy); blocks may be left out or '' (the goal).
    'item.add': { goal: 'id', title: 'name', blocks: 'text?' },
    'item.box': { id: 'id' },
    'item.chat': { id: 'id' },
    'item.checks': { id: 'id' },
    'item.delete': { id: 'id' },
    // under '' keeps every path; the door's shape needs it sent.
    'item.files': { id: 'id', under: 'text?' },
    // Each path a non-empty string without '..'; the server checks the entries.
    'item.files.add': { id: 'id', paths: 'list' },
    'item.get': { id: 'id' },
    'item.release': { id: 'id' },
    'item.rename': { id: 'id', title: 'text' },
    'item.status': { id: 'id', word: 'text' },
    'item.take': { id: 'id' },
    'items.find': { text: 'text', by: 'text', since: 'text', before: 'text' },
    'items.search': { text: 'text', currentGoalOnly: 'bool', goalsOnly: 'bool', includeClosed: 'bool' },
    'line.take': { id: 'id' },
    // pass and why only for a verify; red and build send neither.
    'phase.done': { id: 'id', phase: 'id', pass: 'bool?', why: 'text?' },
    'phase.may': { id: 'id' },
    'phase.take': { id: 'id', phase: 'id' },
    // id is '' for start-design with nothing open, which starts a new goal.
    press: { id: 'text', what: 'id' },
    // agent '' is the caller.
    'profile.get': { agent: 'text' },
    // His alone. A name or nick left '' is no name or no nick; a name otherwise passes the label rule.
    'profile.set': { agent: 'id', name: 'name', nick: 'text', included: 'bool?', cap: 'bool?' },
    'rule.add': { type: 'id', label: 'name', text: 'paragraph' },
    'rule.draft': { key: 'id', text: 'paragraph' },
    'rule.get': { key: 'id' },
    'rule.history': { key: 'id' },
    'rule.version': { key: 'id', text: 'paragraph', status: 'id' },
    'rules.search': { text: 'text', types: 'list', statuses: 'list' },
    'seen.get': {},
    // A JSON object, as text.
    'seen.set': { json: 'id' },
    'session.set': { json: 'id' },
    signoff: {},
    'stackFrameChecks.doors': {},
    'stackFrameChecks.make': { gate: 'id', endpoint: 'id', paths: 'list', suites: 'list' },
    'stackFrameChecks.remove': { id: 'id' },
    'stackFrameChecks.run': { id: 'id' },
    'stackFrameChecks.runState': { id: 'id' },
    'stackFrameChecks.update': { id: 'id', gate: 'id', endpoint: 'id', paths: 'list', suites: 'list' },
    'state.get': {},
    'state.set': { json: 'id' },
    unblock: { id: 'id', blocks: 'id' },
    // why may be '': the desk words a rejection without one.
    'work.open': {},
  },
};
