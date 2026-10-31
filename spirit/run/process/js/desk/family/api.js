// spirit/run/process/js/desk/: the desk server's family interface, where spirit.familyPath('desk') finds it (goal/G41.12)
// THE desk SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. WRITTEN BY HAND FROM THE HANDLERS (Andy, 2026-10-22, on the generated
// first cut: "request validation worth a damn?"): an argument is required wherever the door's exact request shape or
// the handler needs it, optional only where the verb's own accepts() lets it be left out; each rule is the tightest
// that every value the handler takes still passes ('text' where '' is a real value, 'id' where it must name something,
// the field rules where the handler applies them). The server checks everything again. A verb added to the server is
// added here, in the same commit. DEBUG is appServer's, not listed here.
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
    // commit may be '' only for a plain item's build claim. No suites (goal/G40.3): a red claim names the item's suite
    // rows, added with item.suites.add, and is refused while there are none.
    claim: { id: 'id', phase: 'id', commit: 'text' },
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
    // One row a write (goal/G40.3): one path; no '..'. A path already there (add) or not there (remove) is refused,
    // naming it. A suite is a spirit/test/ .js path, the red writer's. goal/G41.11, for the desk only: item.files.add takes
    // path or paths, a list cut at one answer (the server answers added and more).
    'item.files.add': { id: 'id', path: 'text?', paths: 'list?' },
    'item.files.remove': { id: 'id', path: 'text' },
    'item.suites.add': { id: 'id', path: 'text' },
    'item.suites.remove': { id: 'id', path: 'text' },
    'item.get': { id: 'id' },
    'item.release': { id: 'id' },
    'item.rename': { id: 'id', title: 'text' },
    // tone (goal/G33.11): test or code, the deskClient's file report; '' or left out for a plain status word. Missing
    // here, the spirit object refused every report before it left (found on goal/G40.3).
    'item.status': { id: 'id', word: 'text', tone: 'text?' },
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
    // goal/G41.22: Andy's alone; the current goal, so no argument.
    pushgoal: {},
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
    // run and since (goal/G41.12): the subscriber's position, the run of the desk and the number of the last row it took
    // in it; the desk's log hands what came after, or the desk pushes in full.
    subscribe: { family: 'id', run: 'text?', since: 'number?' },
    unsubscribe: {},
    // goal/G33.7: the door list as a bounded search, and one door's read (stackFrameChecks.doors went).
    'stackFrameChecks.door': { id: 'id' },
    'stackFrameChecks.doors.search': { text: 'text' },
    // goal/G40.3: a door from its gate and endpoint; its paths and suites one row a write (path: the request path, or the
    // suite's file name of spirit/test), each its own search.
    'stackFrameChecks.make': { gate: 'id', endpoint: 'id' },
    'stackFrameChecks.paths.add': { id: 'id', path: 'text' },
    'stackFrameChecks.paths.remove': { id: 'id', path: 'text' },
    'stackFrameChecks.paths.search': { id: 'id', text: 'text' },
    'stackFrameChecks.suites.add': { id: 'id', path: 'text' },
    'stackFrameChecks.suites.remove': { id: 'id', path: 'text' },
    'stackFrameChecks.suites.search': { id: 'id', text: 'text' },
    'stackFrameChecks.remove': { id: 'id' },
    'stackFrameChecks.run': { id: 'id' },
    'stackFrameChecks.runState': { id: 'id' },
    'stackFrameChecks.update': { id: 'id', gate: 'id', endpoint: 'id' },
    unblock: { id: 'id', blocks: 'id' },
    // why may be '': the desk words a rejection without one.
    'work.open': {},
  },
};
