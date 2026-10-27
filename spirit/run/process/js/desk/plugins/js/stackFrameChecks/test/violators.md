# process/js/desk/plugins/js/stackFrameChecks/violators.js

A door's run as one line per violator (goal/G22.3), for the Stacks tab's run dialog. Andy, 2026-10-13: "much better,
gimme that when i press run:". Loaded by the stackFrameChecks plugin's server half; not a plugin of its own.

## API

`violators(door, paths, options)` -> lines. `door` is `{ gate, endpoint }`; `paths` the runner's raw paths around the
gate, each `"<what it reached> from <frame> < <frame> ..."`; `options.root` the repo a frame's file is read from,
`options.readLine(file, line)` a read in its place.

A frame is `spirit/run/<file>.js:<line>[:<function>][ in <outer>]...`; its function is its own name, else the first
function it is written inside.

## Requirements

- **The violator** is the first frame, walking up, outside the request library (`spirit/run/spirit/relayRequest.js`)
  and, for a module endpoint, outside the endpoint's own file.
- **Its entry** is the highest frame further up in the violator's file with the violator's function; frames of other
  files between the two are a **via** (`<file base> <function>`).
- **from** is the function of the frame right above the entry, when it is in the same file, has a name, and is not the
  violator's own: a caller in another file or top-level code is not said.
- **What reached**: a node: endpoint's `METHOD /path`; a module endpoint's `<file>.js <exported function>`.
- **bypassing** the gate's function (the part after `::`, else the gate whole); a node: endpoint reached with no frame
  of the library below the violator also bypassed `relayRequest`, and is `by plain fetch` when the violator's own source
  line calls `fetch(` (not a method `.fetch(`).
- A violator with no function is `(top level)`.
- **One line per caller** (Andy, 2026-10-13: "list them separately"); the same path twice is one line; lines keep the
  order their first path came in.
- A path that does not read as one (no frames, or only the library's or the endpoint's) is kept as it came; a frame
  that does not parse is passed over; paths that are no list give no lines.

## What its test must try to break

- The library's frame or the endpoint's own frame taken as the violator.
- A caller from another file said as "from".
- Two callers folded into one line, or one path said twice.
- "by plain fetch" said of a line without fetch(, of a method .fetch(, or with nothing read.
- A file missing under root that throws.
