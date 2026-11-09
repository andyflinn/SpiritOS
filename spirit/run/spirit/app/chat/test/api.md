# spirit/app/chat/api.js

The interface of the branch chat: every verb its server serves, each argument with its rule. goal/G43.31, the box: *"nodeChat.js ... its verbs as api.js lists them"*, and *"The branch name is the folder's: chat ... the verbs are chat.<verb>"*.

## How it is tested

Read from the disc; then on a scratch node of its own with the app switched on, the node's own answer for the branch and every listed verb asked as the owner asks it on loopback.

## Requirements

- It lists its verbs, `line.write`, `line.receive`, `chat.read`, `chat.search` and `chats.search` among them, and requires no code.
- `api {family: chat}` answers this file word for word; `api {family: chatClerver}` answers none.
- Every verb it lists is a verb of the node as `chat.<verb>`: none answers no-such-verb.

## What its test must try to break

- A verb it lists that the node does not serve under chat; the old branch name still answered.
- A call missing an argument its rules require (`chat.read` with no peer, `line.write` with no to), or carrying one they do not list, let through: each is refused 400.
