# shell/js/workBench.js

The top-level visual container of an app (goal/G41.1): three panes side by side, left, centre and right, with a
vertical icon strip along the window's left edge and another along its right edge, after goal/G7's vision: clicking the
icon of the pane shown collapses it, another icon shows that tool's content. It loads on
`window.spirit.elements.workBench`.

## API

- `create(container, { left, right })`. `left` and `right` are lists of tools, `{ name, icon, title, mount(box) }`.
  It returns `{ center, press(side, name), shown(side), width(side), destroy() }`.
  - `center` is the centre pane's box, the one the app draws into.
  - `press(side, name)` is what a click on that strip's icon does.
  - `shown(side)` is the name of the tool shown on that side, or `''` while that side is collapsed.
  - `width(side)` is that side pane's width in pixels.

## Requirements

- It draws into `container` alone, these parts in this order, each with an id ending in its name and starting with a
  prefix of its own element: `strip-left`, `pane-left`, `border-left`, `center`, `border-right`, `pane-right`,
  `strip-right`.
- Space is granted top-down (rule/16): its root takes the shell's `fill` class, and it sets no width or height on the
  container it is given.
- Every box from the app to a tool states its size (rule/16; goal/G41.18, Andy, with many model rows: *"the lists
  violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right, agents must as well."*): each
  side pane, the centre and each icon strip are `fill` boxes, each scrolling inside its own height (`overflow: auto`),
  and so is the box a tool is mounted in, given before its mount (Andy: *"fix workBench for all 3 panes AND the icon
  strips"*). A list in a
  tool then stands in its pane's height and scrolls inside it, never growing the pane with its rows.
- Each strip has one button per tool, carrying `data-side`, `data-tool` (the tool's name), the tool's icon and its title.
  A side with no tools draws no strip, no pane and no border.
- At start each side shows its first tool.
- A tool's `mount(box)` is called once, the first time the tool shows, with a box of its own inside its side's pane. The
  box is kept: showing the tool again mounts nothing.
- Pressing the icon of the tool shown collapses that side: its pane is hidden and `shown(side)` is `''`. Pressing
  another tool's icon shows that tool. Pressing any icon while the side is collapsed shows that tool.
- A press on one side never changes the other side. A press naming no tool of that side changes nothing.
- It listens on its container, one listener per event type: a click on a strip button presses it.
- The border between a side pane and the centre is movable, and carries `data-border` with its side. A `pointerdown` on it, then `pointermove`s on the document,
  set that pane's width by the distance moved (to the right widens the left pane, to the left widens the right pane),
  never below 120 pixels. After the `pointerup`, a move changes nothing.
- `destroy()` empties the container and drops its listeners: a click after it does nothing.

### Kept to its container (goal/G41.22)

Andy: *"workBench if, contained, needs to be restreicted by its container, be that the shell app itself or another
container."* Asked of a real browser, since the stubs have no layout: `./workBench-contained.html`, opened at
`/DEBUG/shell/js/test/workBench-contained.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`), puts
one workBench in each container below, a tool on each side and every pane given 5000 pixels of content.

- The containers: a box of 300 pixels that is a plain block; a box of 300 pixels that is a flex column; the shell's app
  area as the home page draws it (`#app-container` > `#app-header`, `#app-content`, under `/shell.css`), the window
  1280 by 800.
- In each, the workBench is no taller than its container, its bottom inside it; the container does not spill, and
  neither the page nor the app area scrolls.
- In each, the left pane, the right pane and the centre scroll inside the container.

## What its test must try to break

- A second mount of a tool shown again.
- A press on one side reaching the other.
- A drag past the minimum, and a move after the pointer is up.
- A click after destroy.
- A side pane, the centre, an icon strip, or a tool's box, that is only as tall as its content.
- A workBench that grows past a container that is no flex column, or past the shell's app area, so the page scrolls.
