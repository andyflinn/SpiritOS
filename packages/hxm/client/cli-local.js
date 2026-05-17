// packages/hxm/client/cli-local.js

const fs = require('fs');
const { applyTransform } = require('../src/core.js');

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error("Usage: node client/cli-local.js <state.json> <request.json>");
  process.exit(1);
}

const [stateFile, requestFile] = args;

try {
  const current = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf-8'));

  console.log("=== Current Server State ===");
  console.dir(current, { depth: null });

  const result = applyTransform(current, request);

  if (result.success) {
    console.log("\n=== New State After Transform ===");
    console.dir(result.state, { depth: null });
    console.log("\n✅ Transform successful.");
  } else {
    console.error("\n❌ Transform failed:");
    console.error(result.error);
    process.exit(1);
  }

} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}