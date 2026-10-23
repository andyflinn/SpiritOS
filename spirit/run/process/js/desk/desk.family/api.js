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
    // goal/G33.7: each table's search, one component (desk.js tableSearch), ranked by text, bounded, more.
    'item.box.search': { id: 'id', text: 'text' },
    'item.checks.search': { id: 'id', text: 'text' },
    'item.claims.search': { id: 'id', text: 'text' },
    'item.files.search': { id: 'id', text: 'text' },
    'item.suites.search': { id: 'id', text: 'text' },
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
    'agents.search': { text: 'text' },
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
    'rule.version': { key: 'id', text: 'paragraph', status: 'id' },
    'rules.search': { text: 'text', types: 'list', statuses: 'list' },
    // goal/G33.7: seen per item, the arrival time of the newest thing he looked at under it.
    'seen.get': { id: 'id' },
    'seen.set': { id: 'id', at: 'text' },
    signoff: {},
    // goal/G33.8: appServer's streamPublisher (js/appServer.js): the caller's key subscribes to the desk's rows, sent to
    // its family of that name; unsubscribe stops it. Who may is the node's grant.
    subscribe: { family: 'id' },
    unsubscribe: {},
    // goal/G33.7: the door list as a bounded search, and one door's read (stackFrameChecks.doors went).
    'stackFrameChecks.door': { id: 'id' },
    'stackFrameChecks.doors.search': { text: 'text' },
    'stackFrameChecks.make': { gate: 'id', endpoint: 'id', paths: 'list', suites: 'list' },
    'stackFrameChecks.remove': { id: 'id' },
    'stackFrameChecks.run': { id: 'id' },
    'stackFrameChecks.runState': { id: 'id' },
    'stackFrameChecks.update': { id: 'id', gate: 'id', endpoint: 'id', paths: 'list', suites: 'list' },
    unblock: { id: 'id', blocks: 'id' },
    // why may be '': the desk words a rejection without one.
    'work.open': {},
  },
};
