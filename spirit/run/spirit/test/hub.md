# hub.js decodes no packet itself

goal/G43.23, item 8. Its test is `./hub.js`: hub.js's code read with its comments left out.

The box: *"hub.js decodes packets itself, against the one decoder (G16.5)."* G16.5, Andy: *"yes. we fix redundant code now."* The one decoder is `arrivals.js` `envelopeOf`; `spirit/test/oneDecoder.js` judges it, and does not see hub.js's `packet.decode` of a relay's answer.

## Requirements

- hub.js's code has no `packet.decode`, nor any other `decode(` of its own (a TextDecoder's `decoder.decode` is bytes and aside).
- The world: hub.js is there and its code, comments left out, still holds `packet.encode`; `arrivals.js` exports `envelopeOf`.

## The route caching goes (goal/G47.1, box v69)

*"A post carries no hints: the node sends none"*. A scratch node that once heard a route for a peer (planted while the
store still takes one): `chooseRoute` for that peer, named by no relay, answers the first relay held and no hints.

## Forgetting a contact revokes all its grants (goal/G47.4, Q3)

Andy: *"When you forget a contact, should the node revoke all of its grants at once?"* *"yes. it should."*

- On a scratch node with an identity of its own, a kept contact holding two grants is forgotten through the hub's
  forget: it answers 200, forgotten.
- Then the node's grants table holds no grant of that key.
- Another key's grant stands.

## 😏 faceable, and the star from ownership alone (goal/G47.4, box v33)

Box: *"the star is shown as before on nodes and relays and is set only by true ownership (the signed card names this node
as owner); no button or verb changes it"*, *"😏 is the row field faceable, set by the new verb contact.faceable {key,
faceable}, for a relay this node holds a seat on only; it does what own did"*, *"contact.own goes"*. On a scratch node with
a seated relay, a relay with no seat, and two nodes whose signed cards name this node and nobody:

- the hub has a handler named for faceable, and no handleOwn;
- the seated relay takes 😏 (200) and its row says faceable;
- the relay with no seat, and a node (even one whose card names this node), are refused 😏 (a 4xx);
- 😏 always comes off;
- the node whose card names this node has the star with no verb asked; the one whose card names nobody has none.
