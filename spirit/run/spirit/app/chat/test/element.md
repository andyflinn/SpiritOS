# spirit/app/chat/element.js

The chat app's element. goal/G43.31, the box: *"The app's element is spirit/app/chat/element.js"* (Andy: *"the app-element must be spirit/app/chat/element.js"*): `spirit.element.spirit.app.chat.element.create(container, { open })`. *"It is today's chatter.js, working as it does, made an element: no activateApp and no handed api, the server through spirit itself, node.card through spirit.ready."*

## How it is tested

Its code read from the disc; then mounted alone in a box of a real Chrome on a scratch node's face page, the app switched on, every call the page sends (fetch and XMLHttpRequest bodies) recorded as it leaves.

## Requirements

- Its code reaches no old shell (no `activateApp`, no `spirit.shell`) and names no chatClerver.
- It loads through `spirit.require('spirit/app/chat/element.js')`, and `spirit.element.spirit.app.chat.element.create(container, {})` answers `{ destroy }`.
- It draws today's chatter: the chat's input saying *Enter sends, Shift+Enter a new line*, and its contacts pane, the contact search.
- At mount it asks `chat.chats.search`, and never a `chatClerver.<verb>`; its lines are `spirit.data.chat`.
- `destroy` empties its container; the page throws nothing.

## What its test must try to break

- An element that needs the old shell or an api handed to it to mount; one still asking the old branch.
- A destroy that leaves its panes behind.
