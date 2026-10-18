# net: the node's call to the internet, for agents

The `net` namespace is net.fetch, the node's one outbound HTTP call: a url, a
method, headers and a body, the outside answer handed back as it comes.

Described to agents since goal/G29.20. Andy, 2026-10-18, reversing goal/G19.9:
"fetch will not be able to reach ports on this machine, and agents may use it."
A target on this machine (loopback, localhost, 0.0.0.0, ::) is refused with
403, code this-machine, checked on the address a name resolves to; nothing is
sent. Secret keys go only where the owner's proxy list allows (namespace proxy).
