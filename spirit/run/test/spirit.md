# spirit.js

What `spirit/run/spirit.js` is for and what it must do. Its tests, `./spirit.js`, exercise this list; its general
rules, `./spirit-child-generalRules.js`, judge it as they judge every module.

## Purpose

`spirit.js` is the spirit object: the one door through which a face app, a page and a server script reach a node.
It sits at the run root, the node's root of its own file scope (goal/G40.1). Every script that is not the node or a
relay server loads it first and from then on uses the **global spirit**; the node and the relay build spirit
themselves and are its embodiments.

## Requirements

1. **One global.** Loaded in a page, it installs `window.spirit`; required in node, it installs the global `spirit`
   and answers that same object.
2. **What scripts took from kernel.js**, under the kernel's own names, so no call in them changes:
   `spirit.core.jobs`, `spirit.core.node`, `spirit.core.util`, `spirit.core.fs`, `spirit.core.const` with its own
   `MIME_TYPES` table, and `spirit.peerPost`. The kernel stays their implementation until it goes.
3. **Its helpers**, answering as the kernel's: `error`, `formatBytes`, `escapeHtml`.
4. **`spirit.require(path, key)`**, the one loader, answering a promise. `path` is from the run root.
   - A path in the node's naming of an interface, `<name>/<name>.family/api.js` (a server's) or
     `spirit/<name>/api.js` (a node family's), binds that family as `spirit.<name>`.
   - `key` null or left out asks the owner's node; a peer's ID key asks that peer.
   - In node an interface is bound from this process's own node, the one `SPIRIT_CALLBACK_URL` names, and refused
     `no-node` without one; never the default port.
   - Any other path is a component: required in node, fetched through the link and run on a face.
5. **Every call checked before it leaves**: no argument its verb does not name, every required one present, each by
   its rule. The node checks everything again.

## What its tests must try to break

- A second spirit: requiring it twice, or after something else set a global spirit.
- An interface path asked with no node of its own.
- A component path that is not there.
- A call with an argument its verb does not name.
