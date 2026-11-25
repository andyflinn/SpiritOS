# spirit/streamBundle/script.js — its tests (goal/G48.7)

Andy: *"spirit/server/app/script.js and console would need to share the module that unpacks the collated stream packages, i
would NOT want that to be done in two places"*; Q1: *"the module is spirit/streamBundle/script.js"*. The box: one module, both
halves of a bundle and nothing else.

A delivery is the bundle's JSON as the json string of a listener request, and its room is the app server's own: half a
sealed packet less 512 bytes for its envelope (`BUNDLE_ROOM` in spirit/server/app/script.js).

## pack

- keeps the entries in order: what it packs is the first of them, as they came;
- fits one delivery: given more entries than one holds, it cuts them, and what it packs fits;
- takes every entry when they all fit;
- a single entry too big for one delivery still goes, alone.

## unpack

- returns the entries of a bundle, each a plain object, in order;
- gives null for a delivery that is no JSON, and for JSON that is no array;
- what pack packs, unpack gives back the same.

## its users, the app server

- spirit/server/app/script.js requires spirit/streamBundle/script.js;
- it parses no delivery's json itself;
- it packs with the module and keeps no bundleOf of its own.

The app server's own suite stays green on the build; the console's use comes with goal/G48.6.
