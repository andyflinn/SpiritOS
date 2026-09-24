// spirit/run/app/shared/ask.js
// THE ONE `ask`, AND THE ONLY PLACE A PAGE NAMES THE DOOR.
//
//   G3, PUBLIC-APP-SERVER.md: "`ask` has one home, and the app server
//   uses it. Fourteen lines, not `kernel.js` wholesale. Existing copies
//   are not migrated in this cycle; no fourth is written."
//
// ── WHY ONE FILE AND NOT A COPY PER APP ─────────────────────────────
//
// Four copies of this existed by the end of cycle 2, and the fourth was
// in `app/starter` — the sample every stranger copies. A fork there does
// not add one caller, IT TEACHES THE HABIT. That is the worst place a
// duplicate can sit, and it was written by the agent enforcing the rule.
//
// ── THE SAME DOOR ON BOTH HOSTS, WHICH IS WHY ONE FILE CAN WORK ─────
//
// The node's own server answers `POST /api/spirit` (`server.js:921`) and
// so does the app server (`appServer.js`, the door). An app hosted by the
// shell and the same app served by a public app server therefore speak to
// the same path, and this file needs no idea which one it is on. That is
// the layering claim made good rather than argued: the app contract does
// not change when the host does.
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
    body: JSON.stringify(Object.assign({ verb: String(verb) }, args || {})),
  });
  return r.json().catch(() => ({ ok: false, error: 'unreadable answer' }));
}

export default ask;
