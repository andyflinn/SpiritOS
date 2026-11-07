# spirit/netFence.js

The fence that keeps net.fetch off this machine (goal/G29.20; Andy, 2026-10-18: *"fetch will not be able to reach
ports on this machine, and agents may use it."*). The node asks `isThisMachine` of the target's hostname as `new URL`
gives it (`spirit/server.js:588`), before anything is sent; a name is checked again on the address it resolves to, at
connect (`netFence.lookup`).

## Requirements

- **This machine is refused, however its address is written.** Every case is asked as the node asks it: a URL parsed by
  `new URL`, its hostname lower-cased and handed over as it comes.
  - 127.x, 0.0.0.0, localhost and names under .localhost;
  - IPv6 loopback and the any address, short and written in full;
  - **IPv4-mapped and IPv4-compatible forms** (goal/G41.30, the reported failure: *"isThisMachine('::ffff:7f00:1') is
    false, and new URL rewrites [::ffff:127.0.0.1] to that form, so an IPv4-mapped literal passes the gate"*):
    `[::ffff:127.0.0.1]`, `[0:0:0:0:0:ffff:127.0.0.1]`, `[::ffff:7f00:1]`, `[::127.0.0.1]`, `[::ffff:0.0.0.0]`.
- **Another machine stays reachable**: an internet address, a name, an IPv6 internet address, and an IPv4-mapped
  address of another machine.

Not here: the LAN (RFC1918), link-local and the cloud metadata address stay open (Andy: *"ok, we block only loopback
on the same machine."*, `netFence.js:7`). This machine's own interface addresses are refused too (`netFence.js:22`), but
this test does not ask them.

## What its test must try to break

- An IPv4-mapped or -compatible loopback literal let through because `new URL` wrote it in hex.
- Another machine refused by a fence made too wide.
