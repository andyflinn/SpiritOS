# spirit/element/tabContainer.js

An element with one row of tabs at the top, showing the selected tab's content in the vertical space left below it
(goal/G41.1). Other apps with tabs catch up with it later. It loads on `window.spirit.element.tabContainer`.

## API

- `create(container, { tabs, selected })`. `tabs` is a list of `{ name, label, mount(box), closable, italic }`; `selected`
  names the tab shown first, and defaults to the first tab.
  It returns `{ select(name), selected(), add(tab), close(name), rename(name, { name, label, italic }), destroy() }`.
  `rename` (goal/G41.31) changes a tab's name or header and keeps what it holds; an italic tab's label is drawn in
  italics. This test does not reach `rename` or `italic`.

## Requirements

- It draws into `container` alone: the row of tabs first, then the content area, each with an id ending in `tabs` and
  `content` and starting with a prefix of its own element.
- Space is granted top-down (rule/16): its root takes the shell's `fill` class, the content area takes `fill` too, so it
  gets the height the row leaves, and it sets no width or height on the container it is given.
- The row has one button per tab, carrying `data-tab` (the tab's name) and its label. The selected tab's button carries
  `aria-selected="true"`, every other one `aria-selected="false"`.
- At start the tab `selected` names is selected, or the first tab when `selected` names none.
- A tab's `mount(box)` is called once, the first time it is selected, with a box of its own inside the content area. The
  box is kept: selecting the tab again mounts nothing. Only the selected tab's box shows; every other box is hidden.
- `select(name)` with a name that is no tab changes nothing.
- It listens on its container, one listener per event type: a click on a tab button selects that tab.
- `destroy()` empties the container and drops its listeners: a click after it does nothing.

## What its test must try to break

- A second mount of a tab selected again.
- Two boxes showing at once.
- An unknown name, and a click after destroy.

## Closable tabs (goal/G41.32)

The box: *"the tabContainer will allow to add "closable" tabs, which have a little close button on the right side of the tab,
like browser tabs."* The contract: `add({ name, label, mount, closable })`, `close(name)`, and a closable tab's close button
carries `data-tab-close="<name>"`.

- An added tab is selected and mounted. A closable one has its close button, right of its label; a fixed tab has none.
- Adding a tab that is there makes it active: no second tab, no second mount.
- A press on the close button takes that tab away, and the tab shown stays shown when another closes. The selected tab closed,
  a neighbour is selected; its box leaves the page. Closing a tab that is not there does nothing.
