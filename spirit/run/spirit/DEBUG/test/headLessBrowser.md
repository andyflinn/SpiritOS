# spirit/DEBUG/headLessBrowser.js — its own test

The bare mount page of one module (goal/G41.19, `../../test/DEBUG.md`), replacing shell/mount.html. Andy: *"the response
will be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit.js"> and the most minimal
mount"*. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). In process: the page is
read as text, and its one inline script is run on a window of its own with a planted spirit.

- `make`: HTML typed `text/html; charset=utf-8`; null for an address that is not `.html`.
- The page: `<script src="/spirit.js">` and one inline script, nothing more, `/spirit.js` first; no comments; `/shell.css`
  linked; `#mount-box`; the module's name as its title.
- The module is loaded through `spirit.require` after `spirit.start`, alone (rule/26).
- An element: the one at `spirit.element.<its path>`, created with the box alone, no options (box v23); `window.spiritMount`
  says `mounted`, holds the box, and its `destroy` is the element's.
- An app (`spirit.shell.activateApp`): mounted into the box with an api, rendered, said mounted; the api's `verb` asks the
  spirit object's family and refuses a verb that is not there with `no-such-verb`.
- A file that places nothing: `failed`, the error naming where it looked.

## What its test must try to break

Options handed to an element; a comment or a second script in the page; an app mounted and never rendered; a file that
places nothing said mounted.
