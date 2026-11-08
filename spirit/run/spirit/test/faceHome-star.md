# spirit/test/faceHome-star.js

The star, end to end (goal/G41.30; Andy: *"why does no test assert the fix?"*, *"wsl? do it."*).
`spirit/test/faceHome.js` stands in for "did this node set a face" and "is this relay starred"; so the two lines of
`spirit/server.js` that answer them were judged by nothing. Here nothing of the node is stood in: a real scratch node
joins real scratch relays by their mail, sets a face and logs in, and every call is what a page sends, `POST /face/call`
with its cookie, its Origin and json. Only the relay's mailer keeps its mail. A step that cannot run is red.

goal/G43.18, box v29, *A face is whole, or there is none* (Andy: *"we remove ALL the star shit, like this,"*, *"on the home node, NO face is offered (faceForm hides itself) for a relay without star."*): *"The home node answers a face only from a starred relay, one check; a face it answers is a full face."*, *"A star taken off a relay that has a face takes that face away (Q21)."*, *"Starring is never asked from a face (contact.own)"*. The half face of G41.30 and G41.33 is gone: a refusal is judged by its 4xx alone, since v29 names no code.

## Requirements

- **No star, no face.** `node.card`, `fs.FS.path`, `contact.search`, `jobs.create`, `fs.save` and `owner.command` from
  the face are all refused; no job ran, no file was written.
- **The star on, pressed at home: everything is back** (Andy: *"your face on a relay you own gets everything back"*).
  `contact.own` true at the loopback door; `owner.command` reaches the door; `fs.save` writes the file; `jobs.create` of
  an included process runs it; `/bin/sh` is still refused; `contact.own` from the face is refused and the star stays.
- **The star off takes the face away.** The node held a face on the relay; `contact.own` false at home; the node holds
  none there any more (`relay.get`'s `face.name` empty); `node.card` and the rest through it are refused; nothing ran or
  was written; the star put back opens nothing: the face is gone, not hidden.
- **A relay's claim changes nothing.** A relay whose owner mark is this node's key has sent its owner's report; no star
  appears, and `owner.command` from its face is refused.
- **A relay where this node set no face gets nothing.** A dishonest relay makes the member a face the node never asked
  for and logs in to it: `node.card` and `jobs.create` are refused 403 `no-face-here`, and a star does not open it.

The face on the owned relay is set before the owner mark goes in (the relay restarted on its folder, as over ssh):
`relay.face` on a relay that already owns the node answers no text today, a fault of its own.

## What its test must try to break

- `faceOwned` answering true for every relay, or never; `faceSet` answering true for every relay.
- A relay's report putting the star back.

## On the real stream

What a page reads from `/face/stream`, with its cookie. No star: the stream carries nothing of the node, not its file tree
nor presence; a job run and deleted at home and a bundle added never reach the face. The star pressed with the stream open:
none of that comes after it. Starred: the running job, the job deleted, the bundle and the join steps arrive. From the
starred face, `contact.own` of another relay and of its own star are refused and change nothing; `relay.face` through it is
not refused, and the face answers at its new name. The star off: the next job stays home, and the node holds no face on
that relay any more. Relay events are judged in `spirit/test/faceHome.js`, on stand-ins.
