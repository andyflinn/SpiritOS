# net: the internet, for agents

The `net` namespace has one verb, net.fetch, which forwards an HTTP request
to any website for the caller, filling in the secret keys the owner's proxy
list allows (`wire: true`: being offline fails it).

net.fetch is described to agents by its file, fetch.json (goal/G14.6; Andy,
2026-10-10: "there is only key for very few fetches"): a key is filled in
only for the hosts on the owner's list, every other fetch spends nothing,
and the list still gates every call, so a site or key he closed is refused
in his words.
