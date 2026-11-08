// spirit/run/shell/shared/ask.js
// THE ONE `ask`, AND THE ONLY PLACE A PAGE NAMES THE DOOR.
//
//   G3, PUBLIC-APP-SERVER.md: "`ask` has one home, and the app server
//   uses it."
//
// An ES module: ask(verb, args) posts { call, args } to the node's door,
// `POST /api/spirit` (server.js), and answers what came back. One file and
// not a copy per app, so the path is named once.
//
// Its one importer was spirit/run/process/js/starter/starter.html, gone with goal/G43.27; nothing imports it now
// (it was `import { ask } from './ask.js'`). No server in the tree names ask.js, so
// nothing serves it at that address today.
//
// THE DOOR IS A NAMED CONSTANT and not a literal at the call. One place
// knows the path, which is the whole point of there being one home.
const DOOR = '/api/spirit';

// A REFUSAL IS AN ANSWER, not a thrown error. It arrives as
// `{ok:false, status, error, code}` — with a CODE, because prose cannot
// be matched against a set, and every refusal the app server can emit is
// a member of a declared one. A caller that only handles success is a
// caller that will show a stranger a blank page.
export async function ask(verb, args) {
  const r = await fetch(DOOR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The name and the arguments apart (goal/G41.15): { call, args }, so an argument named verb is the verb's own.
    body: JSON.stringify({ call: String(verb), args: args || {} }),
  });
  return r.json().catch(() => ({ ok: false, error: 'unreadable answer' }));
}

export default ask;
