# spirit/app/chat/chat.js

The chat app, laid out as Desk is. goal/G43.31, the box: *"chat.json: identity icon 💬, label "Chat", not intrinsic; shell.mount true, with a tile; node.mount true, because the server runs on the node"* (Andy: *"app icon remains the same. manifest shows node:mount AND shell:mount"*), and *"chat.js is the one file the node and the page load"* (Andy: *"chat.js splits between browser and node.... the usual pattern"*): *"In node it requires nodeChat.js. On a page it brings element.js and draws it."*

## How it is tested

Its json and code read from the disc; then a scratch node of its own with the app switched on: the process the node runs for its job, and its tile in a real Chrome, opened as a user opens it.

## Requirements

- `chat.json`: icon 💬, label Chat, not intrinsic; `shell.mount` true with a tile; `node.mount` true.
- `chat.js` names `nodeChat.js` for the node and `element.js` for a page, and draws nothing itself.
- Switched on, its server answers `chat.chats.search`, and the process the node runs for the job `spirit.app.chat` is `spirit/app/chat/chat.js`.
- Its tile shows Chat and 💬, and opens the chat with its input; the page throws nothing.

## What its test must try to break

- A manifest that loses its icon or either mount; a chat.js that draws itself or reaches the old shell.
- A node that runs some other file for the app; a tile that opens nothing.
