# net: the internet, for agents

The `net` namespace has one verb, net.fetch, which forwards an HTTP request
to any website for the caller, filling in the secret keys the owner's proxy
list allows (`wire: true`: being offline fails it).

No verb here has a file, so none is described to agents (goal/G10.5): a
fetch that spends the owner's keys is his to open, one site at a time.
