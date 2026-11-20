# spirit/app/chat/server/server.js

The chat server (goal/G4), faceless and p2p: this node's record of the chats it is a party to. goal/G43.31, the box: *"chat/server/server.js is today's chatClerver.js, working as it does, its verbs as api.js lists them. Its database is chat.db in the node's state"* (Andy: *"how about calling the db chat.db ??????"*, and *"that ruling is replaced."*, G4's *"it is called memory.db"*); *"The branch name is the folder's: chat"*; *"No old chat data is rescued"* (Andy: *"don't even THINK of rescuing any old chat data, that an ABSOLUTE NO."*).

## How it is tested

A scratch node of its own; the app switched on (`app.active {key: chat}`); every verb asked over HTTP as the owner asks it on loopback. A line written to a key nobody answers is kept and stays unsent, so one node judges all of it.

## Requirements

- **No held path** (goal/G43.23, the checks of the old chatClerver-noHeld.js, one test file per module): its code asks nothing `held` and calls no `contact.accept`.
- **The branch is chat**: switched on, it answers `chat.chats.search`, and its job `spirit.app.chat` runs; `chatClerver.<verb>` is no verb of the node.
- **chat.db, started empty**: `chat.db` is in `spirit/state/chat/data/`; `chats.search` answers no chat at the start.
- **A line written is kept**: `line.write` to a key nobody answers answers `seq` 1, `refused` or `pending`; `chat.read` holds it (written here, its text, marked unsent); `chats.search` then has that chat; the next line is `seq` 2.
- **A line is the grant to answer** (G4.6): after it, `auth.query` says the key may `chat.line.receive`, and never `chatClerver.line.receive`.
- **chat.search** finds the written line by its text with who `me`, and none with who `them`.

## What its test must try to break

- A server that names its database otherwise.
- A branch still answering as chatClerver, or a grant path still chatClerver's.
- A line with no `to` taken as the node's fault (it is refused 4xx); a line too large to travel kept (it is refused `line-too-large`, and the chat keeps only its lines).
