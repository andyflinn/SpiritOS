# The one-door suite runs to its end and leaves the model providers alone

goal/G43.23, item 2. Its test is `./oneDoor.js`: `spirit/test/oneDoor.js` run as its own process, by hand, its printed lines read.

The box: *"oneDoor.js crashes on the gone spirit/run/js and counts the model providers as violators."*, and under it, *"not fixed: the model-provider urls"*, Andy: *"we're NOT going to fix some netFence thing for the model-provider urls in "agent""*. Only Andy sets those urls and keys; netFence is for what others make the node fetch.

## Requirements

- `spirit/test/oneDoor.js` reads no missing folder: no ENOENT, no stack.
- It runs to its end: its last section is reached and its completion line printed.
- No failure line counts `spirit/app/agent/provider/anthropic/anthropic.js` or `spirit/app/agent/provider/openai/openai.js` as a violator.
