# spirit/app/chat/data.js

What a page knows of its chats (goal/G4.9 on). goal/G43.31, the box: *"The branch name is the folder's: chat"* (Andy: *"The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is motherfucking <name> in spirit/app/<name>...."*), *"chatClerver goes everywhere: the cache is spirit.data.chat"*.

## How it is tested

In a window of its own beside the real spirit.data (`spirit/data.js`), which it writes into; the server's lines handed in as the node's stream hands them, jobs of module `spirit.app.chat` whose `app.line` is the line.

## Requirements

- **The branch is chat**: it makes `spirit.data.chat`, its reads on `.data`, and no `spirit.data.chatClerver`; its lines live on a branch named chat.
- **A published line is kept** under its peer: `lines(peer)` oldest first, `line(peer, sent, seq)` finds one; its readers (`published(fn)`) are told after it is kept, fresh the first time; the same line again is told not fresh and kept once; a reader that went is told nothing more.
- **chats.search's answer** is kept by `keepChats`: one row per peer, found by `chat(peer)`.

## What its test must try to break

- A line in another job's publish (`spirit.app.desk`, or the old `spirit.app.chatClerver`) kept as a chat line; a line with no peer kept; one peer's lines mixed into another's.
- A row whose label is no record kept.
