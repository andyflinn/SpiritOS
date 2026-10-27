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

## What its test must try to break

- A second mount of a tool shown again.
- A press on one side reaching the other.
- A drag past the minimum, and a move after the pointer is up.
- A click after destroy.
