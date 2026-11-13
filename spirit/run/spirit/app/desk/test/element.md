# spirit/app/desk/element.js — its own test

The desk on a page (goal/G43.27, requirement 23): the page half of `./desk.js`, as `spirit/app/agent/element.js` is the
agent's (Andy: *"look at agent.js, that's how it's done..."*, *"NO FUCKING HACKS."*). The shell's app selector launches
it; it draws the Desk page, `./element/desk/desk.js`, which it requires itself. Owed since the rule *"every production
script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its own; the Desk page is a stand-in,
placed by the real `installSpiritElement` as its own file places it.

- Before it runs there is no `spirit.element.spirit.app.desk.element`; once it has, it stands there with `create`.
- It asks for `spirit/app/desk/element/desk/desk.js` itself, and the Desk page keeps its own place beside it,
  `spirit.element.spirit.app.desk.element.desk.desk`.
- `create(container, { title, open })` draws the Desk page in that container, handing it the same title and open (a
  dialog the page opens goes in the mounter's stack through open), and answers what the Desk page answers, its
  `destroy` with it; handed no options, the Desk page is handed `{}`.

## What its test must try to break

The Desk page drawn in another container, or without the mounter's `open`; the element placed over the Desk page's own
place; a destroy that does not reach the Desk page.
