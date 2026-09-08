# SpiritOS

A personal node on your machine and a public mailbox at [spirit.andyflinn.com](https://spirit.andyflinn.com).

**Start here:** [PAMPHLET.md](PAMPHLET.md)

```
git clone https://github.com/andyflinn/SpiritOS.git
cd SpiritOS
npm start
```

Then open `http://localhost:65432`. No `npm install` — the server uses Node built-ins only. A personal node binds loopback. `npm start` is `cd spirit/run && node js/server.js` (that `cd` is required).

Public relay: from `spirit/run/`, `node js/server.js --relay`. Personal nodes never take `--relay`.

Website: [andyflinn.com](https://andyflinn.com) · Andy Flinn
