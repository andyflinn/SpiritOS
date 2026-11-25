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
if (typeof require === 'function') require('../../script.js').requireScript('spirit/app/desk/data.js'); else window.spirit.requireScript('spirit/app/desk/data.js');
module.exports = {
  verbs: {
    // An empty box is a box: text may be ''.
    'box.write': { id: 'spirit/type/string/deskId/script.js', text: 'spirit/type/string/box/script.js', version: 'spirit/type/number/integer/script.js' },
    'chat.add': { id: 'spirit/type/string/deskId/script.js', text: 'spirit/type/string/paragraph/script.js' },
    // Each filter left '' filters nothing; scope is '', goal or items.
    'chat.search': { id: 'spirit/type/string/deskId/script.js', text: 'spirit/type/string/descriptionSelect/script.js', by: 'spirit/type/string/wordSelect/script.js', since: 'spirit/type/number/UTC/script.js', before: 'spirit/type/number/UTC/script.js', scope: 'spirit/type/string/chatScope/script.js' },
    // kind is C, T, G or Q; words and test may be ''.
    'check.add': { id: 'spirit/type/string/deskId/script.js', kind: 'spirit/type/string/checkKind/script.js', words: 'spirit/type/string/paragraphSelect/script.js', test: 'spirit/type/string/fileSelect/script.js' },
    // check is a check's number, or 'all' for his Grant-All.
    'check.set': { id: 'spirit/type/string/deskId/script.js', check: 'spirit/type/string/word/script.js', state: 'spirit/type/string/checkState/script.js' },
    // The handler trims and refuses an empty title; it applies no label rule to a goal's.
    'goal.add': { title: 'spirit/type/string/description/script.js' },
    // The title passes the label rule (fieldWhy); blocks (goal/G49) may be left out or '' (the goal).
    'item.add': { goal: 'spirit/type/string/deskId/script.js', title: 'spirit/type/string/label/script.js', blocks: 'spirit/type/string/deskIdSelect/script.js?' },
    'item.box': { id: 'spirit/type/string/deskId/script.js' },
    'item.chat': { id: 'spirit/type/string/deskId/script.js' },
    // Kept (goal/G48.8 Q8): the details dialog's one read of an item's checks.
    'item.checks': { id: 'spirit/type/string/deskId/script.js' },
    'item.delete': { id: 'spirit/type/string/deskId/script.js' },
    'item.get': { id: 'spirit/type/string/deskId/script.js' },
    'item.rename': { id: 'spirit/type/string/deskId/script.js', title: 'spirit/type/string/label/script.js' },
    // tone (goal/G33.11): test or code, the deskClient's file report; '' or left out for a plain status word. Missing
    // here, the spirit object refused every report before it left (found on goal/G40.3).
    'item.status': { id: 'spirit/type/string/deskId/script.js', word: 'spirit/type/string/description/script.js', tone: 'spirit/type/string/statusTone/script.js?' },
    'items.search': { text: 'spirit/type/string/descriptionSelect/script.js', currentGoalOnly: 'spirit/type/boolean/script.js', goalsOnly: 'spirit/type/boolean/script.js', includeClosed: 'spirit/type/boolean/script.js' },
    // id is '' for start-design with nothing open, which starts a new goal.
    press: { id: 'spirit/type/string/deskIdSelect/script.js', what: 'spirit/type/string/deskPress/script.js' },
    // goal/G33.8: appServer's streamPublisher (spirit/server/app/script.js): the caller's key subscribes to the desk's rows, sent to
    // its family of that name; unsubscribe stops it. Who may is the node's grant.
    // run and since (goal/G41.12): the subscriber's position, the run of the desk and the number of the last row it took
    // in it; the desk's log hands what came after, or the desk pushes in full.
    subscribe: { branch: 'spirit/type/string/word/script.js', run: 'spirit/type/string/word/script.js?', since: 'spirit/type/number/integer/script.js?' },
    unsubscribe: {},
  },
};
