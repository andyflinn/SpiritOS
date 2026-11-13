# spirit/app/deskClient/data.js — its own test

What a client knows of the deskClient family (goal/G41.28): nothing yet. Andy: *"WSL, make sure you assert that every
family in the api tree HAS a clientCacheManager"*; a page finds it by the family's name (`spirit.cacheManager`). Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in a window of its own
beside the real `spirit/data.js`; in node it is asked through `spirit.cacheManager('deskClient')`.

- It stands at `spirit.data.deskClient`, its reads at `spirit.data.deskClient.data`, and it has none yet.
- It keeps nothing and names no branch: its cache is empty, and a deskClient job on the stream writes nothing.
- In node, `spirit.cacheManager('deskClient')` finds it, and the family stands.

## What its test must try to break

The family made under another name; a read or a translator added without a branch named here.
