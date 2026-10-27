# shell/shared/js/deskElement.js

The element that carries its own stream (goal/G27.9, slice D; Desk rule 8, Andy: "Shell and application elements,
should bring their subscriptions with them, so that they're automatically subscribed to the events that update
them."). Read from the module's code (goal/G41.11).

## API

`window.spirit.elements.createDeskElement({ subscribe, wants, paint })` answers `{ destroy }`.

- `subscribe(handler)` the stream; it answers its unsubscribe. Called once, when the element is made.
- `wants(obj, from)` whether a published object concerns this element.
- `paint(obj, from)` repaints this element from that object.

## Requirements

- It adds itself to `window.spirit.elements`, making `spirit` and `elements` when absent and keeping what is there.
- `subscribe` is called once, at make; the element keeps no copy of the state.
- An object is painted only when `wants` says so; `paint` is handed the object and its sender.
- A `wants` that throws counts as not wanted: nothing painted, nothing thrown to the stream.
- Without `wants` every object is painted; without `paint` a wanted object is heard harmlessly.
- `destroy()` calls the unsubscribe once; a second destroy is harmless; a handler called after destroy paints nothing.
- Without `subscribe` (or with no options) it is made and destroyed harmlessly; an unsubscribe that is not a function
  is not called.

## What its test must try to break

- A subscribe made twice, or not at make.
- A paint of an unwanted object; a throwing `wants` escaping into the stream.
- A paint after destroy; an unsubscribe called twice.
