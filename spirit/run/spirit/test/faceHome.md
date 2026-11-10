# spirit/faceHome.js

How a home node answers its face. This test holds goal/G41.30, the review's RC1: *"any relay a node is connected to can
run every owner verb on that node by sending a face event, including jobs.create with any command."* The verbs G41.30
took off the face went with the half face (goal/G43.18, box v29, below). `createFaceHome` runs on stand-ins that keep what reached them.

## The option it needs

**`faceSet(url)`: true when this node set a face on that relay**, and **`faceOwned(url)`: true when that relay is starred**.
`spirit/server.js` gives both from the relay's row (`relayKeys.faceOf`, and the row's `mine`). Each counts only when it
answers `true`. With no `faceSet` given it refuses: closed, not open.

## Requirements

- **A relay where this node set no face gets nothing** (the review: *"accept face* events only from a relay where this
  node set a face"*): a call, allowed or not, unsealed, sealed or in pieces, never reaches the door and is answered a
  refusal, a 4xx with a `code`; a file is not served; the keys are not answered; face-open starts no stream.
- **The relay where this node set a face, and starred, works as before**: `node.card` reaches the door, sealed too; a file
  is served; the keys are answered; face-open starts the stream.
- **A face is whole, or there is none** (goal/G43.18, box v29; Andy: *"we remove ALL the star shit, like this,"*, *"on the
  home node, NO face is offered (faceForm hides itself) for a relay without star."*): *"The home node answers a face only
  from a starred relay, one check; a face it answers is a full face."* On a relay with this node's face and no star,
  `node.card`, `fs.stat`, `owner.command`, `job.create`, a file, the keys and a save in parts are each refused, sealed
  or in pieces, and none reaches the door; no file is served or written. The half face of goal/G41.30 and G41.33, its
  lists of verbs off the face, is gone.
- **Starring takes the node's own word, and a face there**: only `true` is a star; a starred relay where this node set no
  face gets nothing.
- **`contact.own` never comes through a face** (Andy: *"so this button will put the star on relays and puppets. AND take it
  away."*, at home): refused with a code on any relay, one this node owns too, sealed or not.
- **The owner family goes with the star** (Andy, pasting the review: *"owner.command still passes. A face on a relay that
  isn't starred can send any signed verb to your puppets, and they run it"*): `owner.command` is refused
  from a face on a relay that is not starred, with everything else above, and every verb reaches the door on a starred one.

## What its test must try to break

- A shell run from a relay holding no face of this node's, by any form of request.
- A call from a relay with no star reached the door, sealed or in pieces.
- A fix so wide that the face stops working on its own relay.

## goal/G41.33: a starred face gets what the loopback gets

The box: *"anything andy gets on his loopback screen, he can get on his face, if he "stars" any relay he's a member of or
owns"*, including bundles, branches and grants, a job deleted, running jobs, join steps, relay events. *"for a face(relay) with star, NO RESTRICTIONS AT ALL, except changing
stars."* Here `o.events` is a stand-in, and a relay event comes as `server.js` sends it.

- **A starred face hears each of those whole and once**, a job of a type nobody has listed too, and a server's job with its
  log. Packets are not judged: the box reduced this item to its five kinds, *"for now"*.
- **A face with no star hears nothing** (box v29): not a job, not the file tree, not the one table's rows, not a contact
  renamed, not a relay event.
- **An owner's relay event is one line**: it reaches a face by the node's dispatcher alone (`ownerEvent` went with the half
  face).
- **Only `true` is a star, and it counts at each event**: pressed with the face open, the next event arrives; taken off, the
  next stays home. *"Pressing the star sends no catch-up."*
- **A starred face that opens gets the jobs a loopback page gets on connect** (line 1 of the box; `event.js`, the
  snapshot). The envelope is the builder's: only that each job is on the stream is judged.
- **The queue does not change**: its levels are as they were, one write at a time, and nothing new is lost while it waits.
- **No restrictions on a star**: every verb of every family reaches the door, sealed and not, `relay.face` on the relay it
  is called through and a `peer.post` carrying a face name to it among them, both still refused with no star. `contact.own` stays refused, on and off.
