# Bones — identity vs perception (lab only)

Not spirit-3. Not pretty UI.

## What this pack is

- `spirit/run/js/whoBook.js` — private who list on a personal node
- `spirit/test/identityPerception.js` — two johns as two keys; captions stay local
- labMaster recipe below — sticks, not a new framework

## Unit test

```
node spirit/test/identityPerception.js
```

## labMaster recipe (laptop)

```
node spirit/test/labMaster/labMaster.js
```

Panel: `http://127.0.0.1:65420`

Create:

| name | type | port |
|---|---|---|
| lab-relay | relay | 65410 |
| annie | avatar | 65411 |
| john-a | avatar | 65412 |
| john-b | avatar | 65413 |
| jim | avatar | 65414 |

Point each avatar `app/natter/relays.json` at `http://127.0.0.1:65410` (loopback HTTP is allowed).

`node install-public-relay.js annie` against the **lab relay home**, not Kamatera.

Claim annie first from her shell, then the others as distinct **claim strings** (`john-a`, `john-b`) until peers are keyed by public key. In each avatar’s `who.json`, both public labels can be `john`; annie sets `lovelyJohn` / `john-work`.

## Not yet

- Two claims of the literal string `john` on one mailbox
- Title-bar rename UI
- To dropdown

Those wait until this test is boring and peer-by-key lands in `relay.js`.
