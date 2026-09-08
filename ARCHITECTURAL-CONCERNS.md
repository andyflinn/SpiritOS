# Architectural Concerns

Proof-of-concept holds. Relay Chat (RC) does not. Three jobs share one window, and that is the unease.

Underneath they are already separate: whoBook is perception, hub is transport, `relayChat.js` is a view. There is only one view, so identity and contacts accreted there.

## What RC is doing today

1. **Public identity** — invite onto a mailbox, redeem a token. Binding a key to a public relay (owned or not).
2. **Address book** — whoBook: public key, public label, my label, relays.
3. **Chat** — one client of the message path.

Those should be three apps. RC should only be (3).

## What should be true

The first thing a human sees is the app that **binds this personal node to a public relay** and then **keeps the list** of known and owned relays. Stop.

If there is no binding, the rest of the shell does not appear. `firstRun()` already picks one app. It names RC only because the claim fields live there. Move claim into the binder and the gate follows — a constant, not a redesign.

After that, every app uses:

```
sendMessagePacket(toId, payloadObject)
api.onPacket(appId, handler)
```

- `toId` is a public key. Labels stay in the address book.
- The app never signs and never names `/api/hub/send`.
- RC is one caller. Chess, Bridge, a contact card — same door.

## Envelope — inside `text`, no wire change

Today the mailbox carries `{from, to, text}` and signs `send\nfrom\nto\ntext`. Keep that.

```
text = JSON.stringify({
  app: "app/chess",
  v: 1,
  id: "…",
  body: { … }
})
```

No `relay.js` change. No spirit-3 cutover. Inbox-sig already taught what dual-format costs.

`MAX_TEXT` is 1024 bytes on the relay. A chess move, a bid, a contact card fit. A picture does not. Chunking is a later wire sitting.

Hub still adds `from` / `to` / time / the existing send signature. Do not put a second signature inside the JSON until something needs it.

## The real work (not send)

1. **Fan-in.** One mailbox, many apps. Route by `app`. A packet for an app that is missing, closed, or unknown: drop, hold, or notify. Hold needs a store. Decide before the second client.
2. **History.** `peerfile-<key>.json` is chat: one archive per peer. Chess does not belong in that file. Packet layer: per-peer-per-app, or a separate hold. Decide before Chess. No migration of old chat logs into a new shape unless Andy asks.
3. **Quiet / unread.** `quiet()` is RC’s today. If any app can receive, mute is a shell gate. Design before the second client.

## Address book on the wire

A contact card is a payload. That is how a network outruns phone calls.

A card that arrives in a packet is a **candidate**, never a contact. Visible, marked, not listened to, until a human accepts. Rank `vouched` below `handle`. Ranks do not fall.

Current trust is six characters spoken. A forwarded card is somebody else’s six characters.

## Defer

- **Relay countersign.** A receipt. Nobody asks for one. Costs a sign and a verify per message on a 1 GB box. Skip until a dispute exists.
- **Multi-relay send.** Hub still uses `relays.json[0]`. Two people on different mailboxes cannot play chess. Name that as a v1 wall, not a surprise.

## Split

| Job | Lives in | Notes |
| --- | --- | --- |
| Bind + list relays | one intrinsic app (Andy names it) | Gate. Natter is the seed. Claim / invite leave RC. |
| Address book | its own app | whoBook only. No mint, no chat log. |
| Chat | RC | First `sendMessagePacket` client. Local peerfile stays chat-only. |

## Sequence

1. `sendMessagePacket` / `onPacket`, envelope inside `text`. RC stays working.
2. Address book app — lift UI off RC.
3. Binder — claim, invite, relay list; first-run points here.
4. Chess, as proof the envelope is real.

2 or 3 before 1 moves the same code twice.

## Not tonight

- Implementing Chess.
- Countersign.
- Renaming Natter.
- Moving Spirit out of `index.html`.
- Invite consume / first-owner.
- Raising `MAX_TEXT` or chunking.

## When it becomes work

Andy names the sitting. First sitting is (1). Nothing of this is backlog until that word.
