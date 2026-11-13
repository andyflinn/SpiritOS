# spirit/relayConfig.js — its own test

The relay's configuration, `spirit/state/config.json`, bounded by the box (cycle 1, cycle 9). Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72). Pure: text and a planted measurement in.

- `parse`: no file gives the measured defaults (`source: 'default'`); a file's figures (`source: 'file'`); an omitted
  key takes its default; a bare number is the box's total. Refused with an owner's sentence: bad JSON, a non-object, a
  figure not a positive number, a RAM or disc figure above the ceiling.
- At boot an overflow clamps to the ceiling and carries `overflow` with what was asked (Andy, 2026-09-22); a figure that
  fits carries none.
- A running relay's raise is judged by its difference against the host's own free memory less the margin (goal/G40.4,
  Andy: *"It needs to asses the difference"*); refused naming the difference; a lowering always passes.
- The answer is a whitelist: only `ramLimitMB`, `discLimitMB`, `source` (no `maxPerTarget`).
- `asked`: the figures asked for, never the boot clamp. `fileText`: the two figures, indented, trailing newline, read
  back by `parse` the same.

## What its test must try to break

A ceiling honoured above the box; a relay kept down at boot by a figure nobody typed; a raise judged by its whole size
against the box the relay already occupies; a clamp written back to the file; a key leaking through the whitelist.
