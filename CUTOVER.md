# CUTOVER.md — names-mode → keys-mode on spirit-3

Playbook only. Nothing here has been run. Claude has no shell on
spirit-3 and did not run `install-public-relay.js` anywhere (`AGENT.md`:
Kamatera cutover is Andy's, and Claude has no spirit-3).

Every command below runs **as root on spirit-3**, from `/root/SpiritOS`,
except where a step says *work box*.

---

## What the cutover changes

| | before | after |
|---|---|---|
| `relay-state/allow.json` | `{ "names": [...] }` — names-mode | `{ "keys": [{ name, publicKey }] }` — keys-mode |
| `relay-state/mailbox.json` | whatever has claimed so far | absent, then one peer: `andy` |
| `relay-state/pending-owner.json` | absent | `andy`, until the first claim burns it |
| Who may claim | any listed name, no key | the owner key; anyone else needs a live invite |

The mode is **not edited by hand**. `pending-owner.json` plus an empty
mailbox makes the next signed claim the first-owner claim, and
`becomeOwner()` writes `allow.json` in keys form (`relay.js`). Editing
`allow.json` yourself is how you get a mailbox whose allow list and
mailbox disagree.

Two facts that make the order matter:

- **The mailbox must be empty.** `claim()` clears a stale
  `pending-owner.json` the moment any peer already exists, and
  `firstOwner` is only true while `listPeers()` is empty. A cutover that
  leaves `mailbox.json` in place does nothing at all.
- **Stop the unit first.** The relay holds peers and messages in memory
  and rewrites `mailbox.json` on every claim and send. Deleting state
  under a running process just means the process writes it back.

---

## 0. Before you start (work box)

The key that takes the first claim owns that mailbox for good. Losing it
means losing the owner: reclaiming needs the same key
(`allow.json.byName[owner] === publicKey`).

```
# work box, not spirit-3
copy spirit\run\relay-state\identity.json  <somewhere off this machine>
```

Also decide the answer to "who is `andy` here": the claim must come from
the personal node whose `identity.json` you just backed up, through
Relay Chat, at `http://127.0.0.1:65432`.

---

## 1. Land the code the box will run

```
cd /root/SpiritOS
./bash/update          # fetch + reset --hard origin/master, restarts the unit
./bash/status          # HEAD == origin/master, unit active, runs as root
```

`./bash/update` never touches `relay-state/` — it is a product-code
update only. Do the cutover on the code you intend to keep.

---

## 2. Take the update cron out, then stop the relay

```
./bash/cron-remove
crontab -l | grep spirit-host-update    # expect: no output
./bash/stop
systemctl is-active spirit-relay        # expect: inactive
```

The cron runs `./bash/update` **every ten minutes**, and `update`
restarts the unit whenever `origin/master` has moved. During a cutover
that is a relay starting itself back up while you are deleting the state
underneath it: it would reload the old `mailbox.json` into memory and
write it back, or take the pending-owner window before you claim from
the work box. Remove it first, put it back in step 6 once the box is the
one you meant to build.

Nothing is served now: Caddy will answer 502 on
`https://spirit.andyflinn.com` until step 5. That gap is the cutover.

---

## 3. Back up the whole state directory

Outside the clone, so no later `git reset --hard` or `rm -rf` in the
repo can reach it:

```
cp -a /root/SpiritOS/spirit/run/relay-state \
      /root/relay-state-backup-$(date +%Y%m%d-%H%M%S)
ls -la /root/relay-state-backup-*
```

This backup **is** the rollback (step 7). Do not skip it because the
box "has nothing important yet" — it holds every message anyone has
sent to that mailbox.

---

## 4. Empty the mailbox and arm the pending owner

```
cd /root/SpiritOS/spirit/run/relay-state
rm -f mailbox.json allow.json invites.json
ls -la                      # expect: nothing but what you meant to keep
```

- `mailbox.json` — the peers and messages. Removing it is what makes the
  next claim a first claim.
- `allow.json` — the old names list. Remove it as well: if a claim goes
  wrong with it still present, the box quietly stays in names-mode and
  looks like it worked. Absent = open mode, and open + empty is also a
  first-owner path, so the pending owner still decides who wins.
- `invites.json` — stale tokens minted against the old world. A token
  that survives a cutover is a door you did not mean to leave open.
- `identity.json`, if present: a **relay** does not need one (identities
  belong to personal nodes). Leaving it changes nothing; the backup has
  it either way.

Then arm the name:

```
cd /root/SpiritOS
node install-public-relay.js andy
```

That writes `spirit/run/relay-state/pending-owner.json` and chmods the
state dir to 700.

> **Watch this:** run as root on Linux, `install-public-relay.js` then
> execs `./bash/http-to-https`, which reinstalls the unit, re-runs
> `bash/firewall` and `bash/tls`, and **starts** the relay. On a box
> where Caddy and the firewall are already right that is a no-op you did
> not ask for, and it means step 5 may already have happened. Read its
> output. If it did start the unit, skip `./bash/start` and go to
> step 6.

---

## 5. Start the relay

```
./bash/start
./bash/status
```

Expect: unit active, enabled at boot, running as root, node on
`127.0.0.1:65430`, and `HEAD == origin/master`.

---

## 6. Take the mailbox (work box)

From the browser on the work box — **not** from spirit-3:

1. `http://127.0.0.1:65432` → Relay Chat.
2. Claim `andy`.
3. Expect **201**. Any 403 here means the pending owner and the name you
   typed disagree, or `mailbox.json` was not actually empty.

Then confirm the shape, in this order:

| Check | Where | Expect |
|---|---|---|
| Owner badge | Natter row for `spirit.andyflinn.com` | badge present (a signed `GET /api/relay/status` came back 200 with a report) |
| Create-invitation | Relay Chat | the invite panel appears at all — it is shown only when a Natter row is owned |
| Census | Relay Chat, send to `relay` | a reply naming `mode=keys owner=andy peers=1` |
| Keys lock | second key, no token | `403 invite required` |
| Invite round trip | mint a token, redeem it from another node | claim accepted, token burned, second use refused |

From either box, the outside view:

```
node relayLab/probe.js
```

HTTPS on the public name, and (on spirit-3 only) `127.0.0.1:65430`. It
never writes state.

Only when every check above has passed, put the update cron back:

```
./bash/cron-install
crontab -l | grep spirit-host-update
```

Not before. Until the checks pass you may still want step 7, and a cron
that resets the clone to `origin/master` and restarts the relay every
ten minutes is the one thing that can move the box out from under a
rollback you are in the middle of. If you decide to stay stopped
overnight and finish tomorrow, leave the cron off and say so somewhere
you will read — a relay whose auto-update is off looks identical to one
whose auto-update is working.

---

## 7. Rollback

Any point after step 3, if the claim will not take or the census reads
wrong:

```
./bash/stop
rm -rf /root/SpiritOS/spirit/run/relay-state
cp -a /root/relay-state-backup-<stamp> /root/SpiritOS/spirit/run/relay-state
chmod 700 /root/SpiritOS/spirit/run/relay-state
./bash/start
./bash/status
./bash/cron-install     # only once you are done rolling back
```

The box is back in names-mode with its old peers and messages. Nothing
about the cutover is one-way **until** a friend has claimed against the
new mailbox — after that, rolling back also unclaims them.

---

## What this playbook does not do

- **No SSH from Claude, and no installer run.** Steps 1–5 and 7 are
  Andy's hands on spirit-3.
- **No `X-Forwarded-For`.** Behind Caddy every caller is `127.0.0.1` to
  the rate limiter, which is a known and accepted shape, not something
  to fix during a cutover (`AGENT.md`).
- **No firewall or TLS change.** `ufw` still denies 65430 from the
  world; Caddy still terminates 443. If `install-public-relay.js`
  re-ran `bash/firewall` and `bash/tls` as a side effect, that is the
  same configuration re-applied, not a new one.
- **No labMaster, ever, on that box.**

## After a successful cutover

Two documents state the old mode as fact and will be wrong:

- `AGENT.md` — "Live Kamatera stays names-mode until Andy cuts over (as
  of 2026-09-07)".
- `DICTIONARY.md` — **Names-mode**, "Live Kamatera as of cycle 4 still
  this unless cut over".

Both are one-line edits, and both are Andy's to open as a sitting — a
cutover that nobody wrote down is a cutover the next session will
undo in good faith.
