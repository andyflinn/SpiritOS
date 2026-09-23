#!/usr/bin/env python3
"""design/protocol/examples/hello.py

THE SAME THING IN PYTHON, STANDARD LIBRARY ONLY — no pip, no package.

A SpiritOS node is a local HTTP port. This file is not a client library
and is not meant to become one: it is forty lines showing that a program
in any language gets signed, sealed peer-to-peer messaging by making a
POST. If it ever grows into a package, the claim it exists to prove has
been quietly given up.

    python3 hello.py                      ask this node about itself
    python3 hello.py <public-key> "hi"    and send somebody a message

THE KEYS NEVER COME NEAR THIS SCRIPT. The node holds the signing key and
the cipher key, seals the packet to the recipient's card, signs what
travels and hashes that. A caller says what it wants to say and to whom.
"""

import json
import os
import sys
import urllib.error
import urllib.request

NODE = os.environ.get("SPIRIT_NODE", "http://127.0.0.1:65432")


def ask(verb, **args):
    """One door, and the verb is in the body — never in the path.

    A REFUSAL IS AN ANSWER, and the body carries it whatever the status
    line says. This was written the obvious way first, and posting to a
    peer whose card holds no cipher key produced a Python traceback
    instead of the sentence the node had gone to the trouble of writing:
    "no cipher key for that peer — ask for their card first". Every
    language has this trap in some form; a reader copying these forty
    lines inherits whichever version is here, so it is the handled one.
    """
    body = json.dumps(dict(verb=verb, **args)).encode()
    req = urllib.request.Request(
        NODE + "/api/spirit", data=body,
        headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def main():
    me = ask("node.card")
    print("I am:", me.get("name"), "-", me.get("publicKey", "")[:24] + "...")

    reach = ask("peer.list")
    print("relay:", reach.get("relay"))

    if len(sys.argv) < 2:
        print("not sending: give a public key as the first argument")
        return

    # The text is a PACKET. The node seals it before it signs it, so a
    # message is unreadable to the relay that carries it — proved in
    # spirit/test/guarantees.js by searching the relay for the words.
    packet = json.dumps({"app": "hello", "v": 1,
                         "body": {"say": sys.argv[2] if len(sys.argv) > 2 else "hello"}})
    out = ask("peer.post", to=sys.argv[1], text=packet)
    print("sent:", out.get("ok"), out.get("status"), out.get("error", ""))


if __name__ == "__main__":
    main()
