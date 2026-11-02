# spirit/faceHome.js

How a home node answers its face. This test holds goal/G41.30, the review's RC1: *"any relay a node is connected to can
run every owner verb on that node by sending a face event, including jobs.create with any command."* Andy, Q3: *"Shall
we fix RC1, RC2, RH1, RH3 and RH4 in this item, taking jobs, fs, fileServer and net.fetch off the face until faces can
prove they are the owner?"* *"yes."* `createFaceHome` runs on stand-ins that keep what reached them.

## The option it needs

**`faceSet(url)`: true when this node set a face on that relay.** No such option exists today: `createFaceHome` is told
nothing of which relay holds this node's face. `spirit/server.js` gives it from the relay's row, `face` in the seen table
(`nodeStore.js`). With no `faceSet` given it refuses: closed, not open.

## Requirements

- **A relay where this node set no face gets nothing** (the review: *"accept face* events only from a relay where this
  node set a face"*): a call, allowed or not, unsealed, sealed or in pieces, never reaches the door and is answered a
  refusal, a 4xx with a `code`; a file is not served; the keys are not answered; face-open starts no stream.
- **The relay where this node set a face works as before**: `node.card` reaches the door, sealed too; a file is served;
  the keys are answered; face-open starts the stream.
- **Even there, jobs, fs, fileServer and net.fetch are off the face**: every verb `spirit/jobs/api.js`, `spirit/fs/api.js`
  and `process/js/fileServer/family/api.js` declare, each family's `FS` group, and `net.fetch`, unsealed, sealed and in
  pieces: refused with a code, never at the door. `fs.annotate` writes no sidecar by its side way (`annotateFace`), and a
  save in parts (`{upload}`) writes no file.

- **A face login alone changes no grant and no key of the node** (RH2 of the review; Andy: *"we fix the red from
  goal/G41.30 AND all the review items here in this item."*; the review: *"a step-up the node itself asks for before
  anything that runs code or changes grants."*). No step-up exists yet, so `auth.grant`, `auth.revoke`, `auth.bundle`,
  `auth.branch` and `node.rotateCipher` are refused from the face, sealed or not, and never reach the door.

- **Every family's FS group is off the face too; one read stays** (Andy, Q4: *"every FS group off the face, fs.annotations
  stays for the icons"* *"yes."*): `<family>.FS.loadFile`, `saveFile` and `saveJsonValue` of the node's families and of each app
  server never reach the door from the face; `fs.annotations` does, since the face desktop draws its apps by it.

- **Your face on a relay you own gets everything back** (Andy: *"your face on a relay you own gets everything back,
  jobs, files, grants, puppets, under your login as it is now. On a relay you do not own, the limits stay until G42."*).
  `faceOwned(url)`, exactly true, says this node owns that relay, from something the node did itself, never the relay's
  own word. With it and a face there, every verb otherwise off the face reaches the door, and a save in parts goes on.
  Without it, or with no face there, the limits above stand.

## What its test must try to break

- A shell run from a relay holding no face of this node's, by any form of request.
- A verb taken off the face reached sealed or in pieces.
- A fix so wide that the face stops working on its own relay.
