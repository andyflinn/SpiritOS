# spirit/contact/faceHome/script.js

How a home node answers its face. This test holds goal/G41.30, the review's RC1: *"any relay a node is connected to can
run every owner verb on that node by sending a face event, including jobs.create with any command."* The verbs G41.30
took off the face went with the half face (goal/G43.18, box v29, below). `createFaceHome` runs on stand-ins that keep what reached them.

## The option it needs

**`faceSet(url)`: true when this node set a face on that relay**, and **`faceOwned(url)`: true when that relay is starred**.
`spirit/server/script.js` gives both from the relay's row (`relayKeys.faceOf`, and the row's `mine`). Each counts only when it
answers `true`. With no `faceSet` given it refuses: closed, not open.

## Requirements

- **A relay where this node set no face gets nothing** (the review: *"accept face* events only from a relay where this
  node set a face"*): a call, allowed or not, unsealed, sealed or in pieces, never reaches the door and is answered a
  refusal, a 4xx with a `code`; a file is not served; the keys are not answered; face-open starts no stream.
- **The relay where this node set a face, and starred, works as before**: `node.card` reaches the door, sealed too; a file
  is served; the keys are answered; face-open starts the stream.
- **A face is whole, or there is none** (goal/G43.18, box v29; Andy: *"we remove ALL the star shit, like this,"*, *"on the
  home node, NO face is offered (faceForm hides itself) for a relay without star."*): *"The home node answers a face only
  from a starred relay, one check; a face it answers is a full face."* One check, so one call judges it: on a relay
  with this node's face and no star, a call is refused and never reaches the door. The half face of goal/G41.30 and
  G41.33, its lists of verbs off the face, is gone, and so are its tests (Andy, Q18: *"WHATEVER IS HALF-FACE-GARBAGE
  GETS KILLED"*).
- **Starring takes the node's own word, and a face there**: only `true` is a star; a starred relay where this node set no
  face gets nothing.
- **`contact.faceable` never comes through a face** (Andy: *"so this button will put the star on relays and puppets. AND take it
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
- **A relay with no faceable mark gets no stream** (Q19; Andy: *"absolutely. either there is a face, or there is not. NO
  inbetween."*): face-open there starts none, as on a relay where this node set no face.
- **An owner's relay event is one line**: it reaches a face by the node's dispatcher alone (`ownerEvent` went with the half
  face).
- **A starred face that opens gets the jobs a loopback page gets on connect** (line 1 of the box; `event.js`, the
  snapshot). The envelope is the builder's: only that each job is on the stream is judged.
- **The queue does not change**: its levels are as they were, one write at a time, and nothing new is lost while it waits.
- **No restrictions on a star**: every verb of every family reaches the door, sealed and not, `relay.face` on the relay it
  is called through and a `peer.post` carrying a face name to it among them, both still refused with no star. `contact.faceable` stays refused, on and off.

## The star part: the star, end to end

Once `./faceHome-star.js`, now a section of `./script.js`. The star, end to end (goal/G41.30; Andy: *"why does no test assert the fix?"*, *"wsl? do it."*).
`spirit/contact/faceHome/test/script.js` stands in for "did this node set a face" and "is this relay starred"; so the two lines of
`spirit/server/script.js` that answer them were judged by nothing. Here nothing of the node is stood in: a real scratch node
joins real scratch relays by their mail, sets a face and logs in, and every call is what a page sends, `spirit.relay.faceCall` (its login, `faceState` and `faceLogin`) at the relay's one door,
`POST /spirit` (goal/G49.25; `/face/call` and `/face/api` are gone), with its cookie, its Origin and json. Only the relay's mailer keeps its mail. A step that cannot run is red.

goal/G43.18, box v29, *A face is whole, or there is none* (Andy: *"we remove ALL the star shit, like this,"*, *"on the home node, NO face is offered (faceForm hides itself) for a relay without star."*): *"The home node answers a face only from a starred relay, one check; a face it answers is a full face."*, *"A star taken off a relay that has a face takes that face away (Q21)."*, *"Starring is never asked from a face (contact.faceable)"*. The half face of G41.30 and G41.33 is gone: a refusal is judged by its 4xx alone, since v29 names no code.

### Requirements

- **No star, no face.** `node.card`, `fs.stat`, `contact.search`, `spirit.job.create`, `fs.save` and `owner.command` from
  the face are all refused; no job ran, no file was written.
- **The star on, pressed at home: everything is back** (Andy: *"your face on a relay you own gets everything back"*).
  `contact.faceable` true at the loopback door; `owner.command` reaches the door; `fs.save` writes the file; `spirit.job.create` of
  an included process runs it; `/bin/sh` is still refused; `contact.faceable` from the face is refused and the star stays.
- **The star off takes the face away.** The node held a face on the relay; `contact.faceable` false at home; the node holds
  none there any more (`relay.get`'s `face.name` empty); `node.card` and the rest through it are refused; nothing ran or
  was written; the star put back opens nothing: the face is gone, not hidden.
- **A relay's claim changes nothing.** A relay whose owner mark is this node's key has sent its owner's report; no star
  appears, and `owner.command` from its face is refused.
- **A relay where this node set no face gets nothing.** A dishonest relay makes the member a face the node never asked
  for and logs in to it: `node.card` and `spirit.job.create` are refused 403 `no-face-here`, and a star does not open it.

The face on the owned relay is set before the owner mark goes in (the relay restarted on its folder, as over ssh):
`relay.face` on a relay that already owns the node answers no text today, a fault of its own.

### What its test must try to break

- `faceOwned` answering true for every relay, or never; `faceSet` answering true for every relay.
- A relay's report putting the star back.

### On the real stream

What a page reads from its stream, the call `spirit.relay.faceEvents` at `POST /spirit` (goal/G49.25; `GET /face/stream` is gone), with its cookie and Origin. The star goes on first, since a relay with no faceable mark gets no
stream (Q19), and the stream opens with the node's file tree. Starred: the running job, the job deleted, the bundle and the join steps arrive. From the
starred face, `contact.faceable` of another relay and of its own star are refused and change nothing; `relay.face` through it is
not refused, and the face answers at its new name. The star off: the node holds no face on that relay any more. Relay events are judged in `spirit/contact/faceHome/test/script.js`, on stand-ins.

## The starApps part: a star shows every app

Once `./faceHome-starApps.js`, now a section of `./script.js`. goal/G41.33, Q9. Andy, of *"Should a star show every app on the face, Text Editor and Media Viewer too, or does each app's
face mark stay yours to set?"*: *"yes. for now."* A real Chrome reads the desktop, at home and on a real face. What a face is
handed, by its relay's star, is `spirit/contact/faceHome/script.js`'s, so it is judged beside it (goal/G43.28; moved from
`shell/test/navigationWrapper-faceStarApps.js`; its relay row section is
the relayOnFace part of `spirit/element/search/contact/row/test/script.js`).

### Requirements

- **Text Editor and Media Viewer are switched on at home first**: since goal/G43.17 they are apps of their own, not
  intrinsic, so a fresh node shows them only once active.
- **No star, nothing** (goal/G43.18, box v29: *"A face is whole, or there is none"*; Andy, Q18: *"yes"*): the face
  draws none of the apps of the home desktop.
- **The star: every app the home desktop shows is on the face's**, the home's own first tile aside, named apart on each;
  Join among them, an app like every other (goal/G43.26).
- **An app it shows opens**: pressing Text Editor's tile throws nothing in the page.
- **The star off: nothing again**, on the next drawing of the desktop.

### What its test must try to break

- A star that shows the two apps named and misses another.
- A face with no star that shows any app of the home desktop.
- A tile that is drawn and dies when pressed.

- A quiet face stream carries a beat each second (box v148): in 4 s with nothing to send, no gap between its writes to the relay is longer than 1.5 s.
