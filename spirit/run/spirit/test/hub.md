# hub.js decodes no packet itself

goal/G43.23, item 8. Its test is `./hub.js`: hub.js's code read with its comments left out.

The box: *"hub.js decodes packets itself, against the one decoder (G16.5)."* G16.5, Andy: *"yes. we fix redundant code now."* The one decoder is `arrivals.js` `envelopeOf`; `spirit/test/oneDecoder.js` judges it, and does not see hub.js's `packet.decode` of a relay's answer.

## Requirements

- hub.js's code has no `packet.decode`, nor any other `decode(` of its own (a TextDecoder's `decoder.decode` is bytes and aside).
- The world: hub.js is there and its code, comments left out, still holds `packet.encode`; `arrivals.js` exports `envelopeOf`.

## The route caching goes (goal/G47.1, box v69)

*"A post carries no hints: the node sends none"*. A scratch node that once heard a route for a peer (planted while the
store still takes one): `chooseRoute` for that peer, named by no relay, answers the first relay held and no hints.
