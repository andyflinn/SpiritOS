# spirit/test/faceStar.js

The star, end to end (goal/G41.30; Andy: *"why does no test assert the fix?"*, *"wsl? do it."*).
`spirit/test/faceHome.js` stands in for "did this node set a face" and "is this relay starred"; so the two lines of
`spirit/server.js` that answer them were judged by nothing. Here nothing of the node is stood in: a real scratch node
joins real scratch relays by their mail, sets a face and logs in, and every call is what a page sends, `POST /face/call`
with its cookie, its Origin and json. Only the relay's mailer keeps its mail. A step that cannot run is red.

## Requirements

- **No star: the limits stand** (Andy: *"On a relay you do not own, the limits stay until G42."*). `node.card` from the
  face answers; `jobs.create`, `fs.save` and `owner.command` are refused 403 `not-from-the-face`; no job ran, no file
  was written.
- **The star on, pressed at home: everything is back** (Andy: *"your face on a relay you own gets everything back"*).
  `contact.own` true at the loopback door; `owner.command` reaches the door; `fs.save` writes the file; `jobs.create` of
  an included process runs it; `/bin/sh` is still refused; `contact.own` from the face is refused and the star stays.
- **The star off again: the limits are back.** `contact.own` false at home; refused again; nothing ran or was written.
- **A relay's claim changes nothing.** A relay whose owner mark is this node's key has sent its owner's report; no star
  appears, and `owner.command` from its face is refused.
- **A relay where this node set no face gets nothing.** A dishonest relay makes the member a face the node never asked
  for and logs in to it: `node.card` and `jobs.create` are refused 403 `no-face-here`, and a star does not open it.

The face on the owned relay is set before the owner mark goes in (the relay restarted on its folder, as over ssh):
`relay.face` on a relay that already owns the node answers no text today, a fault of its own.

## What its test must try to break

- `faceOwned` answering true for every relay, or never; `faceSet` answering true for every relay.
- A relay's report putting the star back.

## goal/G41.33, on the real stream

What a page reads from `/face/stream`, with its cookie. No star: a job run and deleted at home and a bundle added never reach
the face. The star pressed with the stream open: none of that comes after it. Starred: the running job, the job deleted, the
bundle and the join steps arrive. From the starred face, `contact.own` of another relay and of its own star are refused and
change nothing. The star off: the next job stays home. Starred again: `relay.face` through the face is not refused, and the
face answers at its new name. Relay events are judged in `spirit/test/faceHome.js`, on stand-ins.
