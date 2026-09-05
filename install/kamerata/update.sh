#!/bin/bash
set -e
cd /root/SpiritOS
git fetch origin
git reset --hard origin/master
systemctl restart spirit-relay