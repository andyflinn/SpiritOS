#!/bin/sh
# design/protocol/examples/hello.sh
#
# THE WHOLE CLAIM, IN A SHELL SCRIPT WITH NO DEPENDENCIES.
#
# A SpiritOS node is a local HTTP port. There is no SDK, no library and
# no language commitment: anything that can POST JSON can use it. This
# file exists because until it did, "any language" was prose.
#
#   sh hello.sh                      ask this node about itself
#   sh hello.sh <public-key> "hi"    and send somebody a sealed message
#
# Nothing here is SpiritOS-specific except the verb names.

NODE="${SPIRIT_NODE:-http://127.0.0.1:65432}"

ask() {
  curl -s -m 15 -X POST "$NODE/api/spirit" \
       -H 'content-type: application/json' -d "$1"
}

echo "== who am I =="
ask '{"verb":"node.card"}'
echo

echo "== who can I reach =="
ask '{"verb":"peer.list"}'
echo

if [ -n "$1" ]; then
  echo "== sending =="
  # THE TEXT IS A PACKET, and the node seals it to the recipient's
  # cipher key before it signs it. This script never sees a key.
  ask "{\"verb\":\"peer.post\",\"to\":\"$1\",\"text\":\"{\\\"app\\\":\\\"hello\\\",\\\"v\\\":1,\\\"body\\\":{\\\"say\\\":\\\"${2:-hello}\\\"}}\"}"
  echo
else
  echo "== not sending: give a public key as the first argument =="
fi
