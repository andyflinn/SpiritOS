# spirit/spirit.js: a page finds data.js by the folder shape

goal/G43.27, requirement 6. Its test is `./spirit-cacheManager.js`: spirit.js read as it is, comments stripped, and a real
page (headless Chrome) of a scratch node with the agent app switched on, never a live one.

Andy: "spirit.js can be fixed, no? it knows the difference between an app and a system branch?"

## Requirements

- **6. A page finds `data.js` by the folder shape.** spirit.js's cacheManager asks no `FS.path`, and spirit.js asks
  `FS.path` nowhere. On a real page of a scratch node, every family the node names whose data.js is in the tree is loaded
  by `spirit.cacheManager`, contact among them (an app and a system family share that name).
